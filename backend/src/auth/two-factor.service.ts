import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { decryptSecret, encryptSecret } from '../common/secret-box';
import { UserEntity } from '../database/entities/user.entity';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp';

/** سقف کد اشتباه پیاپی، و مدت قفل پس از رسیدن به آن. */
const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60 * 1000;

/**
 * ورود دومرحله‌ای کاربران پنل (TOTP).
 *
 * اگر رمز عبور کسی لو برود، بدون گوشیِ او وارد نمی‌شود. اختیاری است و هر
 * کاربر خودش از «تنظیمات» روشنش می‌کند. اگر کسی گوشی‌اش را گم کند،
 * گرداننده از خط فرمان سرور خاموشش می‌کند:
 * `npm run reset-2fa -- user@example.com`.
 */
@Injectable()
export class TwoFactorService {
  /*
   * شمارش کد اشتباه در حافظه‌ی همین فرایند.
   *
   * شش رقم یعنی یک میلیون حالت؛ بدون سقف، کسی که رمز را دارد می‌تواند کد
   * را حدس بزند. سامانه تک‌نمونه‌ای اجرا می‌شود، پس حافظه کافی است و جدول
   * تازه نمی‌خواهد؛ با ری‌استارت پاک شدنش هم خطری نمی‌سازد.
   */
  private readonly failures = new Map<
    string,
    { count: number; until: number }
  >();

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async status(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    return { enabled: user.totpEnabled };
  }

  /** ساخت کلید تازه؛ تا تایید اولین کد فعال نمی‌شود. */
  async setup(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    if (user.totpEnabled) {
      throw new BadRequestException(
        'ورود دومرحله‌ای از قبل فعال است؛ برای کلید تازه اول آن را خاموش کنید',
      );
    }

    const secret = generateTotpSecret();
    await this.users.update(user.id, {
      totpSecret: encryptSecret(secret),
      totpLastStep: null,
    });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  async enable(userId: string, code: string) {
    const user = await this.loadWithSecret(userId);
    if (user.totpEnabled) return { enabled: true };
    if (!user.totpSecret) {
      throw new BadRequestException('ابتدا «راه‌اندازی» را بزنید');
    }
    await this.consume(user, code);
    await this.users.update(user.id, { totpEnabled: true });
    return { enabled: true };
  }

  async disable(userId: string, code: string) {
    const user = await this.loadWithSecret(userId);
    if (!user.totpEnabled) return { enabled: false };
    await this.consume(user, code);
    await this.users.update(user.id, {
      totpEnabled: false,
      totpSecret: null,
      totpLastStep: null,
    });
    return { enabled: false };
  }

  /** سنجش کد هنگام ورود؛ فقط برای کاربری که ۲FA را روشن کرده. */
  async verifyLogin(userId: string, code: string) {
    const user = await this.loadWithSecret(userId);
    await this.consume(user, code);
  }

  private async loadWithSecret(userId: string) {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect(['user.totpSecret', 'user.totpLastStep'])
      .where('user.id = :id', { id: userId })
      .getOne();
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    return user;
  }

  /** سنجش کد با سقف تلاش و جلوگیری از استفاده‌ی دوباره. */
  private async consume(user: UserEntity, code: string) {
    const now = Date.now();
    const record = this.failures.get(user.id);
    if (record && record.until > now) {
      throw new HttpException(
        'تلاش‌های ناموفق زیاد بود؛ چند دقیقه‌ی دیگر دوباره امتحان کنید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const secret = user.totpSecret ? decryptSecret(user.totpSecret) : '';
    const step = secret
      ? verifyTotp(secret, code ?? '', { lastUsedStep: user.totpLastStep })
      : null;

    if (step === null) {
      // قفلی که مهلتش گذشته، شمارش را از نو شروع می‌کند.
      const lockExpired = record && record.until > 0 && record.until <= now;
      const count = (!record || lockExpired ? 0 : record.count) + 1;
      this.failures.set(user.id, {
        count,
        until: count >= MAX_FAILURES ? now + LOCK_MS : 0,
      });
      throw new UnauthorizedException('کد تایید دومرحله‌ای نادرست است');
    }

    this.failures.delete(user.id);
    await this.users.update(user.id, { totpLastStep: step });
  }
}
