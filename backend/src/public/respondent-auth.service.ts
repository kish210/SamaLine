import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { LessThan, Repository } from 'typeorm';
import { OtpChallengeEntity } from '../database/entities/otp-challenge.entity';
import {
  PublicationAuthMode,
  PublicationEntity,
} from '../database/entities/publication.entity';
import { MessagingService } from '../messaging/messaging.service';

const OTP_TTL_MS = Number(process.env.OTP_TTL_MS ?? 3 * 60 * 1000);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
// نوع expiresIn در jsonwebtoken یک literal است، پس مقدار محیطی
// به ثانیه تبدیل می‌شود تا هم تایپ‌سالم بماند هم قابل تنظیم.
const ACCESS_TTL_SECONDS = Number(
  process.env.RESPONDENT_TOKEN_TTL_SECONDS ?? 2 * 60 * 60,
);

export interface RespondentTokenPayload {
  publicationId: string;
  respondentKey: string | null;
  mode: PublicationAuthMode;
}

/**
 * احراز هویت پاسخ‌دهنده پیش از دیدن فرم (بند ۷ سند).
 *
 * تا پیش از این `authMode` روی انتشار ذخیره می‌شد ولی هرگز بررسی
 * نمی‌شد؛ یعنی فرم «رمزدار» عملا برای همه باز بود.
 */
@Injectable()
export class RespondentAuthService {
  constructor(
    @InjectRepository(OtpChallengeEntity)
    private readonly otpRepo: Repository<OtpChallengeEntity>,
    private readonly messaging: MessagingService,
    private readonly jwt: JwtService,
  ) {}

  /** آیا این انتشار اصلا نیاز به احراز هویت دارد؟ */
  requiresAuth(publication: PublicationEntity): boolean {
    return (
      publication.authMode === PublicationAuthMode.PASSWORD ||
      publication.authMode === PublicationAuthMode.OTP
    );
  }

  /**
   * بررسی توکن دسترسی پاسخ‌دهنده.
   * توکن باید برای همین انتشار صادر شده باشد تا با یک لینک نتوان به
   * فرم دیگری وارد شد.
   */
  verifyAccess(
    publication: PublicationEntity,
    accessToken?: string,
  ): RespondentTokenPayload | null {
    if (!this.requiresAuth(publication)) return null;

    if (!accessToken) {
      throw new UnauthorizedException({
        message: 'برای دیدن این فرم باید احراز هویت کنید',
        authMode: publication.authMode,
      });
    }

    let payload: RespondentTokenPayload;
    try {
      payload = this.jwt.verify<RespondentTokenPayload>(accessToken);
    } catch {
      throw new UnauthorizedException({
        message: 'اعتبار دسترسی شما تمام شده است؛ دوباره وارد شوید',
        authMode: publication.authMode,
      });
    }

    if (payload.publicationId !== publication.id) {
      throw new UnauthorizedException({
        message: 'این اعتبار برای فرم دیگری صادر شده است',
        authMode: publication.authMode,
      });
    }

    return { ...payload, respondentKey: payload.respondentKey || null };
  }

  /** ورود با رمز عبوری که سازنده‌ی فرم تعیین کرده است. */
  async loginWithPassword(publication: PublicationEntity, password: string) {
    if (publication.authMode !== PublicationAuthMode.PASSWORD) {
      throw new BadRequestException('این فرم با رمز عبور محافظت نمی‌شود');
    }

    const config = publication.config as { passwordHash?: string };
    if (!config.passwordHash) {
      throw new BadRequestException('برای این فرم رمزی تعیین نشده است');
    }

    const matches = await bcrypt.compare(password, config.passwordHash);
    if (!matches) throw new UnauthorizedException('رمز عبور نادرست است');

    return this.issueToken(publication, null);
  }

  /** ارسال کد یک‌بارمصرف به موبایل یا ایمیل پاسخ‌دهنده. */
  async requestOtp(publication: PublicationEntity, destination: string) {
    if (publication.authMode !== PublicationAuthMode.OTP) {
      throw new BadRequestException('این فرم کد تایید نمی‌خواهد');
    }

    const normalized = destination.trim().toLowerCase();
    if (!normalized) throw new BadRequestException('گیرنده مشخص نیست');

    await this.pruneExpired();

    const code = randomInt(100000, 999999).toString();
    const channel = normalized.includes('@') ? 'email' : 'sms';

    await this.otpRepo.save(
      this.otpRepo.create({
        publicationId: publication.id,
        destination: normalized,
        codeHash: await bcrypt.hash(code, 8),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        attempts: 0,
        consumed: false,
      }),
    );

    await this.messaging.send(
      {
        channel,
        recipient: normalized,
        subject: 'کد ورود به نظرسنجی',
        body: `کد ورود شما: ${code}\nاین کد تا ${Math.round(OTP_TTL_MS / 60000)} دقیقه معتبر است.`,
        meta: { purpose: 'otp' },
      },
      publication.id,
    );

    return {
      sent: true,
      channel,
      expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
    };
  }

  /** بررسی کد و صدور اعتبار دسترسی. */
  async verifyOtp(
    publication: PublicationEntity,
    destination: string,
    code: string,
  ) {
    const normalized = destination.trim().toLowerCase();

    const challenge = await this.otpRepo.findOne({
      where: {
        publicationId: publication.id,
        destination: normalized,
        consumed: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!challenge) {
      throw new UnauthorizedException('کدی برای این شماره ارسال نشده است');
    }
    if (challenge.expiresAt < new Date()) {
      throw new UnauthorizedException('کد منقضی شده است؛ کد تازه بگیرید');
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException(
        'تعداد تلاش‌های ناموفق زیاد است؛ کد تازه بگیرید',
      );
    }

    const matches = await bcrypt.compare(code.trim(), challenge.codeHash);
    if (!matches) {
      challenge.attempts += 1;
      await this.otpRepo.save(challenge);
      throw new UnauthorizedException('کد نادرست است');
    }

    challenge.consumed = true;
    await this.otpRepo.save(challenge);

    // شماره‌ی تاییدشده کلید پاسخ‌دهنده می‌شود تا کنترل تکرار و
    // «ارسال مجدد به بی‌پاسخ‌ها» بر همان مبنا کار کند.
    return this.issueToken(publication, normalized);
  }

  private issueToken(
    publication: PublicationEntity,
    respondentKey: string | null,
  ) {
    // امضای JWT مقدار null را در payload نمی‌پذیرد، پس نبودِ کلید را
    // با رشته‌ی خالی نشان می‌دهیم و هنگام خواندن دوباره null می‌کنیم.
    return {
      accessToken: this.jwt.sign(
        {
          publicationId: publication.id,
          respondentKey: respondentKey ?? '',
          mode: publication.authMode,
        },
        { expiresIn: ACCESS_TTL_SECONDS },
      ),
      respondentKey,
    };
  }

  /** پاک کردن کدهای منقضی تا جدول بی‌جهت رشد نکند. */
  private async pruneExpired() {
    await this.otpRepo.delete({ expiresAt: LessThan(new Date()) });
  }
}
