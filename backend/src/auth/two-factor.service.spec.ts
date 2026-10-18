jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { createTestDataSource } from '../testing/test-database';
import { timeStep, totpCode } from './totp';
import { TwoFactorService } from './two-factor.service';

describe('TwoFactorService — ورود دومرحله‌ای', () => {
  let ds: DataSource;
  let service: TwoFactorService;
  let userId: string;

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new TwoFactorService(ds.getRepository(UserEntity));
    userId = (
      await ds.getRepository(UserEntity).save({
        fullName: 'کاربر',
        email: 'u@test.local',
        passwordHash: 'x',
      })
    ).id;
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const codeFor = (secret: string, offset = 0) =>
    totpCode(secret, timeStep(Date.now()) + offset);

  it('راه‌اندازی تا تایید اولین کد، ۲FA را روشن نمی‌کند', async () => {
    const { secret, otpauthUrl } = await service.setup(userId);
    expect(otpauthUrl).toContain(secret);
    await expect(service.status(userId)).resolves.toEqual({ enabled: false });

    await service.enable(userId, codeFor(secret));
    await expect(service.status(userId)).resolves.toEqual({ enabled: true });
  });

  it('کلید رمزشده ذخیره می‌شود نه خام', async () => {
    const { secret } = await service.setup(userId);
    const row = await ds
      .getRepository(UserEntity)
      .createQueryBuilder('u')
      .addSelect('u.totpSecret')
      .where('u.id = :id', { id: userId })
      .getOneOrFail();
    expect(row.totpSecret).not.toContain(secret);
    expect(row.totpSecret?.startsWith('enc:v1:')).toBe(true);
  });

  it('کد نادرست رد می‌شود و ۲FA روشن نمی‌شود', async () => {
    await service.setup(userId);
    await expect(service.enable(userId, '000000')).rejects.toThrow(
      'کد تایید دومرحله‌ای نادرست است',
    );
    await expect(service.status(userId)).resolves.toEqual({ enabled: false });
  });

  it('یک کد دو بار پذیرفته نمی‌شود', async () => {
    const { secret } = await service.setup(userId);
    const code = codeFor(secret);
    await service.enable(userId, code);
    await expect(service.verifyLogin(userId, code)).rejects.toThrow(
      'کد تایید دومرحله‌ای نادرست است',
    );
    // کد بازه‌ی بعد پذیرفته است.
    await expect(
      service.verifyLogin(userId, codeFor(secret, 1)),
    ).resolves.toBeUndefined();
  });

  it('پس از پنج کد اشتباه، حتی کد درست هم موقتا رد می‌شود', async () => {
    const { secret } = await service.setup(userId);
    await service.enable(userId, codeFor(secret));
    for (let i = 0; i < 5; i += 1) {
      await expect(service.verifyLogin(userId, '000000')).rejects.toThrow(
        'نادرست',
      );
    }
    await expect(
      service.verifyLogin(userId, codeFor(secret, 1)),
    ).rejects.toThrow('تلاش‌های ناموفق زیاد بود');
  });

  it('خاموش کردن کد جاری می‌خواهد و کلید را پاک می‌کند', async () => {
    const { secret } = await service.setup(userId);
    await service.enable(userId, codeFor(secret));
    await expect(service.disable(userId, '000000')).rejects.toThrow('نادرست');

    await service.disable(userId, codeFor(secret, 1));
    await expect(service.status(userId)).resolves.toEqual({ enabled: false });
  });

  it('راه‌اندازی دوباره روی ۲FA روشن مجاز نیست', async () => {
    const { secret } = await service.setup(userId);
    await service.enable(userId, codeFor(secret));
    await expect(service.setup(userId)).rejects.toThrow('از قبل فعال است');
  });
});
