import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  otpauthUrl,
  timeStep,
  totpCode,
  verifyTotp,
} from './totp';

// کلید آزمون RFC 6238 (پیوست B): رشته‌ی ASCII «12345678901234567890».
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('بردار آزمون RFC 6238 در لحظه‌ی %i', (seconds, expected) => {
    expect(totpCode(RFC_SECRET, timeStep(seconds * 1000), 8)).toBe(expected);
  });

  it('base32 رفت و برگشت سالم است', () => {
    const buffer = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base32Decode(base32Encode(buffer))).toEqual(buffer);
  });

  it('کلید تازه ۳۲ نویسه‌ی base32 است', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(secret);
  });

  it('کد جاری و یک بازه قبل/بعد پذیرفته می‌شود', () => {
    const now = 1_790_000_000_000;
    const step = timeStep(now);
    expect(
      verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), { nowMs: now }),
    ).toBe(step);
    expect(
      verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), { nowMs: now }),
    ).toBe(step - 1);
    expect(
      verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 2), { nowMs: now }),
    ).toBeNull();
  });

  it('کد مصرف‌شده دوباره پذیرفته نمی‌شود', () => {
    const now = 1_790_000_000_000;
    const step = timeStep(now);
    const code = totpCode(RFC_SECRET, step);
    expect(
      verifyTotp(RFC_SECRET, code, { nowMs: now, lastUsedStep: step }),
    ).toBeNull();
  });

  it('ارقام فارسی و فاصله پذیرفته می‌شوند', () => {
    const now = 1_790_000_000_000;
    const code = totpCode(RFC_SECRET, timeStep(now));
    const persian = code.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
    const spaced = `${persian.slice(0, 3)} ${persian.slice(3)}`;
    expect(verifyTotp(RFC_SECRET, spaced, { nowMs: now })).not.toBeNull();
  });

  it('ورودی نامعتبر رد می‌شود', () => {
    expect(verifyTotp(RFC_SECRET, '12345')).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abcdef')).toBeNull();
    expect(verifyTotp(RFC_SECRET, '')).toBeNull();
  });

  it('نشانی otpauth استاندارد است', () => {
    const url = otpauthUrl('ABC', 'a@b.c');
    expect(url.startsWith('otpauth://totp/SamaLine%3Aa%40b.c?')).toBe(true);
    expect(url).toContain('secret=ABC');
    expect(url).toContain('issuer=SamaLine');
  });
});
