jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import * as bcrypt from 'bcrypt';
import type { DataSource } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import type { OutboundMessage } from '../messaging/messaging.types';
import { createTestDataSource } from '../testing/test-database';
import { issuedAfterPasswordChange } from './session-validity';
import {
  hashResetToken,
  passwordChangeInstant,
  PasswordService,
  RESET_REQUESTED_MESSAGE,
} from './password.service';

describe('PasswordService — تغییر و بازیابی رمز', () => {
  let ds: DataSource;
  let service: PasswordService;
  let sent: OutboundMessage[];
  let userId: string;

  beforeEach(async () => {
    ds = await createTestDataSource();
    sent = [];
    const messaging = {
      send: (message: OutboundMessage) => {
        sent.push(message);
        return Promise.resolve({ status: 'sent', providerMessage: null });
      },
    };
    service = new PasswordService(
      ds.getRepository(UserEntity),
      messaging as never,
    );
    userId = (
      await ds.getRepository(UserEntity).save({
        fullName: 'مریم',
        email: 'maryam@example.com',
        passwordHash: await bcrypt.hash('OldPass123', 4),
      })
    ).id;
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const stored = () =>
    ds
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .addSelect(['u.passwordResetHash', 'u.passwordResetExpiresAt'])
      .where('u.id = :id', { id: userId })
      .getOneOrFail();

  /** توکن را از متن ایمیل بیرون می‌کشد، همان‌طور که کاربر روی لینک می‌زند. */
  const tokenFromEmail = () =>
    /token=([0-9a-f]{64})/.exec(sent[sent.length - 1].body)![1];

  describe('تغییر رمز', () => {
    it('با رمز فعلی درست، رمز عوض و زمان تغییر ثبت می‌شود', async () => {
      await service.change(userId, 'OldPass123', 'NewPass456');
      const user = await stored();
      expect(await bcrypt.compare('NewPass456', user.passwordHash)).toBe(true);
      expect(user.passwordChangedAt).toBeInstanceOf(Date);
    });

    it('رمز فعلی نادرست رد می‌شود', async () => {
      await expect(
        service.change(userId, 'wrong', 'NewPass456'),
      ).rejects.toThrow('رمز عبور فعلی درست نیست');
    });

    it('رمز کوتاه یا تکراری رد می‌شود', async () => {
      await expect(
        service.change(userId, 'OldPass123', 'short'),
      ).rejects.toThrow('دست‌کم ۸');
      await expect(
        service.change(userId, 'OldPass123', 'OldPass123'),
      ).rejects.toThrow('باید با رمز فعلی فرق کند');
    });
  });

  describe('بازیابی رمز', () => {
    it('برای ایمیل موجود لینک می‌فرستد و فقط هش توکن را نگه می‌دارد', async () => {
      const result = await service.requestReset(
        ' Maryam@Example.com ',
        'https://survey.example.com/',
      );
      expect(result.message).toBe(RESET_REQUESTED_MESSAGE);
      expect(sent).toHaveLength(1);
      expect(sent[0].recipient).toBe('maryam@example.com');
      expect(sent[0].body).toContain(
        'https://survey.example.com/panel/reset-password?token=',
      );

      const token = tokenFromEmail();
      const user = await stored();
      expect(user.passwordResetHash).toBe(hashResetToken(token));
      expect(user.passwordResetHash).not.toBe(token);
    });

    it('برای ایمیل ناموجود همان پاسخ را می‌دهد و چیزی نمی‌فرستد', async () => {
      const result = await service.requestReset(
        'nobody@example.com',
        'https://x',
      );
      expect(result.message).toBe(RESET_REQUESTED_MESSAGE);
      expect(sent).toHaveLength(0);
    });

    it('بیش از ۳ درخواست در ۱۵ دقیقه ایمیل تازه نمی‌فرستد', async () => {
      for (let i = 0; i < 5; i += 1) {
        await service.requestReset('maryam@example.com', 'https://x');
      }
      expect(sent).toHaveLength(3);
    });

    it('با توکن درست رمز عوض می‌شود و لینک یک‌بارمصرف است', async () => {
      await service.requestReset('maryam@example.com', 'https://x');
      const token = tokenFromEmail();

      await service.resetWithToken(token, 'BrandNew789');
      const user = await stored();
      expect(await bcrypt.compare('BrandNew789', user.passwordHash)).toBe(true);
      expect(user.passwordResetHash).toBeNull();

      await expect(service.resetWithToken(token, 'Another000')).rejects.toThrow(
        'نامعتبر یا منقضی',
      );
    });

    it('توکن منقضی یا ساختگی پذیرفته نمی‌شود', async () => {
      await service.requestReset('maryam@example.com', 'https://x');
      const token = tokenFromEmail();
      await ds.getRepository(UserEntity).update(userId, {
        passwordResetExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetWithToken(token, 'BrandNew789'),
      ).rejects.toThrow('نامعتبر یا منقضی');
      await expect(
        service.resetWithToken('f'.repeat(64), 'BrandNew789'),
      ).rejects.toThrow('نامعتبر یا منقضی');
    });

    it('تغییر رمز لینک بازیابی معلق را هم باطل می‌کند', async () => {
      await service.requestReset('maryam@example.com', 'https://x');
      const token = tokenFromEmail();
      await service.change(userId, 'OldPass123', 'NewPass456');
      await expect(
        service.resetWithToken(token, 'BrandNew789'),
      ).rejects.toThrow('نامعتبر یا منقضی');
    });
  });
});

describe('ابطال نشست‌ها پس از تغییر رمز', () => {
  it('توکن صادرشده پیش از تغییر رمز رد می‌شود', () => {
    const changedAt = passwordChangeInstant(1_790_000_005_500);
    expect(issuedAfterPasswordChange(1_790_000_004, changedAt)).toBe(false);
  });

  it('توکن تازه‌ی همان ثانیه و بعد از آن پذیرفته می‌شود', () => {
    const changedAt = passwordChangeInstant(1_790_000_005_500);
    expect(issuedAfterPasswordChange(1_790_000_005, changedAt)).toBe(true);
    expect(issuedAfterPasswordChange(1_790_000_060, changedAt)).toBe(true);
  });

  it('بدون تغییر رمز همه‌ی توکن‌ها معتبرند؛ توکن بی‌iat پس از تغییر نه', () => {
    expect(issuedAfterPasswordChange(1, null)).toBe(true);
    expect(issuedAfterPasswordChange(undefined, new Date())).toBe(false);
  });
});
