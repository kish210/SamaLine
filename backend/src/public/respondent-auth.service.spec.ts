jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

jest.mock('@nestjs/jwt', () =>
  jest
    .requireActual<typeof import('../testing/jwt.mock')>('../testing/jwt.mock')
    .nestJwtModuleMock(),
);

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import { OtpChallengeEntity } from '../database/entities/otp-challenge.entity';
import {
  PublicationAuthMode,
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import type { MessagingService } from '../messaging/messaging.service';
import { createTestDataSource } from '../testing/test-database';
import { RespondentAuthService } from './respondent-auth.service';

describe('RespondentAuthService — احراز هویت پاسخ‌دهنده', () => {
  let ds: DataSource;
  let service: RespondentAuthService;
  let sendMock: jest.Mock;

  const publication = (
    authMode: PublicationAuthMode,
    config: Record<string, unknown> = {},
  ) =>
    ({
      id: 'pub-1',
      authMode,
      config,
      type: PublicationType.LINK,
    }) as unknown as PublicationEntity;

  /** آخرین کدی که به کاربر پیامک شد، از متن پیام بیرون کشیده می‌شود. */
  const lastSentCode = () => {
    const call = sendMock.mock.calls.at(-1) as [{ body: string }] | undefined;
    const body = call?.[0]?.body ?? '';
    return /(\d{6})/.exec(body)?.[1] ?? '';
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    sendMock = jest.fn().mockResolvedValue({ status: 'sent' });

    service = new RespondentAuthService(
      ds.getRepository(OtpChallengeEntity),
      { send: sendMock } as unknown as MessagingService,
      new JwtService({ secret: 'test-secret' }),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('requiresAuth', () => {
    it('فرم بدون احراز هویت را آزاد می‌داند', () => {
      expect(service.requiresAuth(publication(PublicationAuthMode.NONE))).toBe(
        false,
      );
    });

    it('حالت رمز و کد تایید را نیازمند احراز می‌داند', () => {
      expect(
        service.requiresAuth(publication(PublicationAuthMode.PASSWORD)),
      ).toBe(true);
      expect(service.requiresAuth(publication(PublicationAuthMode.OTP))).toBe(
        true,
      );
    });
  });

  describe('verifyAccess', () => {
    it('برای فرم آزاد چیزی نمی‌خواهد', () => {
      expect(
        service.verifyAccess(publication(PublicationAuthMode.NONE)),
      ).toBeNull();
    });

    it('بدون توکن، دسترسی را رد می‌کند', () => {
      expect(() =>
        service.verifyAccess(publication(PublicationAuthMode.PASSWORD)),
      ).toThrow('برای دیدن این فرم باید احراز هویت کنید');
    });

    it('توکن دستکاری‌شده را رد می‌کند', () => {
      expect(() =>
        service.verifyAccess(
          publication(PublicationAuthMode.PASSWORD),
          'not.a.token',
        ),
      ).toThrow('اعتبار دسترسی شما تمام شده است؛ دوباره وارد شوید');
    });

    it('توکن صادرشده برای فرم دیگر را رد می‌کند', async () => {
      const pub = publication(PublicationAuthMode.PASSWORD, {
        passwordHash: await bcrypt.hash('secret', 8),
      });
      const { accessToken } = await service.loginWithPassword(pub, 'secret');

      const otherPublication = {
        ...pub,
        id: 'pub-2',
      };

      expect(() => service.verifyAccess(otherPublication, accessToken)).toThrow(
        'این اعتبار برای فرم دیگری صادر شده است',
      );
    });
  });

  describe('ورود با رمز عبور', () => {
    const withPassword = async () =>
      publication(PublicationAuthMode.PASSWORD, {
        passwordHash: await bcrypt.hash('Passw0rd!', 8),
      });

    it('رمز درست اعتبار دسترسی می‌دهد', async () => {
      const pub = await withPassword();
      const result = await service.loginWithPassword(pub, 'Passw0rd!');

      expect(result.accessToken).toBeTruthy();
      expect(service.verifyAccess(pub, result.accessToken)).toMatchObject({
        publicationId: 'pub-1',
      });
    });

    it('رمز نادرست را رد می‌کند', async () => {
      const pub = await withPassword();
      await expect(service.loginWithPassword(pub, 'اشتباه')).rejects.toThrow(
        'رمز عبور نادرست است',
      );
    });

    it('فرمی که رمز ندارد را رد می‌کند', async () => {
      await expect(
        service.loginWithPassword(
          publication(PublicationAuthMode.PASSWORD),
          'x',
        ),
      ).rejects.toThrow('برای این فرم رمزی تعیین نشده است');
    });

    it('روی فرم غیررمزدار کار نمی‌کند', async () => {
      await expect(
        service.loginWithPassword(publication(PublicationAuthMode.NONE), 'x'),
      ).rejects.toThrow('این فرم با رمز عبور محافظت نمی‌شود');
    });
  });

  describe('کد یک‌بارمصرف', () => {
    const otpPublication = () => publication(PublicationAuthMode.OTP);

    it('کد را پیامک می‌کند و در دیتابیس هش‌شده می‌گذارد', async () => {
      const result = await service.requestOtp(otpPublication(), '09121234567');

      expect(result).toMatchObject({ sent: true, channel: 'sms' });
      expect(sendMock).toHaveBeenCalledTimes(1);

      const [challenge] = await ds.getRepository(OtpChallengeEntity).find();
      expect(challenge.destination).toBe('09121234567');
      // کد خام نباید در دیتابیس باشد.
      expect(challenge.codeHash).not.toContain(lastSentCode());
    });

    it('برای ایمیل، کانال را ایمیل انتخاب می‌کند', async () => {
      const result = await service.requestOtp(
        otpPublication(),
        'User@Test.Local',
      );
      expect(result.channel).toBe('email');
    });

    it('کد درست اعتبار دسترسی می‌دهد', async () => {
      const pub = otpPublication();
      await service.requestOtp(pub, '09121234567');

      const result = await service.verifyOtp(
        pub,
        '09121234567',
        lastSentCode(),
      );

      expect(result.respondentKey).toBe('09121234567');
      expect(service.verifyAccess(pub, result.accessToken)).toMatchObject({
        respondentKey: '09121234567',
      });
    });

    it('کد نادرست را رد می‌کند و تلاش را می‌شمارد', async () => {
      const pub = otpPublication();
      await service.requestOtp(pub, '09121234567');

      await expect(
        service.verifyOtp(pub, '09121234567', '000000'),
      ).rejects.toThrow('کد نادرست است');

      const [challenge] = await ds.getRepository(OtpChallengeEntity).find();
      expect(challenge.attempts).toBe(1);
    });

    it('پس از سقف تلاش، کد را قبول نمی‌کند حتی اگر درست باشد', async () => {
      const pub = otpPublication();
      await service.requestOtp(pub, '09121234567');
      const code = lastSentCode();

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.verifyOtp(pub, '09121234567', '000000'),
        ).rejects.toThrow();
      }

      await expect(service.verifyOtp(pub, '09121234567', code)).rejects.toThrow(
        'تعداد تلاش‌های ناموفق زیاد است؛ کد تازه بگیرید',
      );
    });

    it('کد مصرف‌شده دوباره کار نمی‌کند', async () => {
      const pub = otpPublication();
      await service.requestOtp(pub, '09121234567');
      const code = lastSentCode();

      await service.verifyOtp(pub, '09121234567', code);

      await expect(service.verifyOtp(pub, '09121234567', code)).rejects.toThrow(
        'کدی برای این شماره ارسال نشده است',
      );
    });

    it('کد منقضی‌شده را رد می‌کند', async () => {
      const pub = otpPublication();
      await service.requestOtp(pub, '09121234567');
      const code = lastSentCode();

      await ds
        .getRepository(OtpChallengeEntity)
        .update(
          { destination: '09121234567' },
          { expiresAt: new Date(Date.now() - 1000) },
        );

      await expect(service.verifyOtp(pub, '09121234567', code)).rejects.toThrow(
        'کد منقضی شده است؛ کد تازه بگیرید',
      );
    });

    it('کد یک شماره برای شماره‌ی دیگر کار نمی‌کند', async () => {
      const pub = otpPublication();
      await service.requestOtp(pub, '09121234567');
      const code = lastSentCode();

      await expect(service.verifyOtp(pub, '09129999999', code)).rejects.toThrow(
        'کدی برای این شماره ارسال نشده است',
      );
    });

    it('روی فرم بدون OTP کار نمی‌کند', async () => {
      await expect(
        service.requestOtp(publication(PublicationAuthMode.NONE), '0912'),
      ).rejects.toThrow('این فرم کد تایید نمی‌خواهد');
    });
  });
});
