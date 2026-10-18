import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { AttemptLimiter } from '../common/attempt-limiter';
import { UserEntity } from '../database/entities/user.entity';
import { MessagingService } from '../messaging/messaging.service';

/** حداقل طول رمز عبور تازه. */
export const MIN_PASSWORD_LENGTH = 8;

/** مدت اعتبار لینک بازیابی. */
const RESET_TTL_MS = 30 * 60 * 1000;

/** پاسخ یکسان درخواست بازیابی، چه حساب باشد چه نباشد. */
export const RESET_REQUESTED_MESSAGE =
  'اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی رمز برایش فرستاده شد.';

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * لحظه‌ی تغییر رمز، گرد به ثانیه.
 *
 * `iat` توکن JWT ثانیه‌ای است؛ با گرد کردن، توکنی که در همان ثانیه برای
 * خود کاربر صادر می‌شود معتبر می‌ماند و همه‌ی توکن‌های قبلی باطل می‌شوند.
 */
export function passwordChangeInstant(now = Date.now()): Date {
  return new Date(Math.floor(now / 1000) * 1000);
}

function assertStrong(password: string) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(
      `رمز عبور باید دست‌کم ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه باشد`,
    );
  }
}

/**
 * تغییر و بازیابی رمز عبور کاربران پنل.
 *
 * - بازیابی: لینک یک‌بارمصرف ۳۰ دقیقه‌ای به ایمیل؛ فقط هش توکن ذخیره می‌شود،
 *   پس نسخه‌ی پشتیبان لو رفته‌ی دیتابیس لینک معتبری نمی‌دهد.
 * - پاسخ درخواست بازیابی برای ایمیل موجود و ناموجود یکسان است تا نشود با آن
 *   فهمید چه کسی حساب دارد.
 * - پس از هر تغییر یا بازیابی، همه‌ی نشست‌های قبلی باطل می‌شوند.
 * - ورود دومرحله‌ای با بازیابی رمز خاموش نمی‌شود.
 */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  /** حداکثر ۳ ایمیل بازیابی برای یک نشانی در ۱۵ دقیقه. */
  private readonly resetLimiter = new AttemptLimiter(
    3,
    15 * 60_000,
    15 * 60_000,
  );
  /** حدس زدن رمز فعلی هنگام تغییر رمز هم سقف دارد. */
  private readonly changeLimiter = new AttemptLimiter(
    10,
    15 * 60_000,
    15 * 60_000,
  );

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly messaging: MessagingService,
  ) {}

  async change(userId: string, currentPassword: string, newPassword: string) {
    if (this.changeLimiter.isLocked(userId)) {
      throw new HttpException(
        'تلاش ناموفق زیاد بود؛ چند دقیقه‌ی دیگر دوباره امتحان کنید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('حساب کاربری یافت نشد');

    if (!(await bcrypt.compare(currentPassword ?? '', user.passwordHash))) {
      this.changeLimiter.fail(userId);
      throw new BadRequestException('رمز عبور فعلی درست نیست');
    }
    this.changeLimiter.succeed(userId);
    assertStrong(newPassword);
    if (newPassword === currentPassword) {
      throw new BadRequestException('رمز تازه باید با رمز فعلی فرق کند');
    }

    return this.setPassword(user, newPassword);
  }

  /** درخواست لینک بازیابی. هرگز نمی‌گوید حساب وجود دارد یا نه. */
  async requestReset(rawEmail: string, publicUrl: string) {
    const email = (rawEmail ?? '').trim().toLowerCase();
    if (!email || this.resetLimiter.isLocked(email)) {
      return { message: RESET_REQUESTED_MESSAGE };
    }
    // هر درخواست شمرده می‌شود، چه حساب باشد چه نباشد؛ وگرنه سقف خودش
    // وجود حساب را لو می‌داد.
    this.resetLimiter.fail(email);

    const user = await this.users.findOne({ where: { email } });
    if (!user) return { message: RESET_REQUESTED_MESSAGE };

    const token = randomBytes(32).toString('hex');
    await this.users.update(user.id, {
      passwordResetHash: hashResetToken(token),
      passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
    });

    const link = `${publicUrl.replace(/\/+$/, '')}/panel/reset-password?token=${token}`;
    const result = await this.messaging.send({
      channel: 'email',
      recipient: user.email,
      subject: 'بازیابی رمز عبور',
      body: [
        `${user.fullName} عزیز،`,
        '',
        'برای تعیین رمز تازه روی لینک زیر بزنید. این لینک ۳۰ دقیقه و فقط یک بار معتبر است:',
        link,
        '',
        'اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید؛ رمز فعلی‌تان تغییری نمی‌کند.',
      ].join('\n'),
    });
    if (result.status === 'failed') {
      this.logger.warn(
        `ایمیل بازیابی رمز فرستاده نشد: ${result.providerMessage ?? ''}`,
      );
    }
    return { message: RESET_REQUESTED_MESSAGE };
  }

  /** تعیین رمز تازه با توکن لینک بازیابی. */
  async resetWithToken(token: string, newPassword: string) {
    assertStrong(newPassword);
    const hash = hashResetToken(token ?? '');
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect(['user.passwordResetHash', 'user.passwordResetExpiresAt'])
      .where('user.passwordResetHash = :hash', { hash })
      .getOne();

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'لینک بازیابی نامعتبر یا منقضی است؛ دوباره درخواست دهید',
      );
    }

    await this.setPassword(user, newPassword);
    return { ok: true };
  }

  private async setPassword(user: UserEntity, newPassword: string) {
    const changedAt = passwordChangeInstant();
    await this.users.update(user.id, {
      passwordHash: await bcrypt.hash(newPassword, 10),
      passwordChangedAt: changedAt,
      // لینک بازیابی یک‌بارمصرف است و پس از هر تغییر رمز باطل می‌شود.
      passwordResetHash: null,
      passwordResetExpiresAt: null,
    });
    return { ...user, passwordChangedAt: changedAt };
  }
}
