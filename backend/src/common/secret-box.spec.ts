import {
  decryptHeaders,
  decryptSecret,
  encryptHeaders,
  encryptSecret,
  isEncrypted,
} from './secret-box';

describe('secret-box — رمزنگاری راز در سطح ستون', () => {
  const original = process.env.SECRET_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SECRET_ENCRYPTION_KEY = 'test-encryption-key';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.SECRET_ENCRYPTION_KEY;
    else process.env.SECRET_ENCRYPTION_KEY = original;
  });

  it('رفت و برگشت مقدار را حفظ می‌کند', () => {
    const secret = 'Bearer super-secret-api-key';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('مقدار رمزشده شبیه مقدار اصلی نیست', () => {
    const encrypted = encryptSecret('Bearer secret');
    expect(encrypted).not.toContain('secret');
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it('هر بار رمزنگاری خروجی متفاوت می‌دهد', () => {
    // بردار اولیه تصادفی است، پس دو رمزنگاری از یک مقدار یکسان نیستند.
    expect(encryptSecret('یکسان')).not.toBe(encryptSecret('یکسان'));
  });

  it('مقدار رمزشده را دوباره رمز نمی‌کند', () => {
    const once = encryptSecret('راز');
    expect(encryptSecret(once)).toBe(once);
    expect(decryptSecret(once)).toBe('راز');
  });

  it('مقدار رمزنشده را دست‌نخورده برمی‌گرداند', () => {
    // داده‌ی قدیمی که پیش از این قابلیت ذخیره شده باید کار کند.
    expect(decryptSecret('کلید خام قدیمی')).toBe('کلید خام قدیمی');
  });

  it('مقدار خالی را دست‌نخورده می‌گذارد', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('متن فارسی را درست رمز و باز می‌کند', () => {
    const secret = 'کلید مخفی سازمان ۱۴۰۵';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('دستکاری داده‌ی رمزشده را تشخیص می‌دهد', () => {
    const encrypted = encryptSecret('راز اصلی');
    // یک نویسه از بخش داده عوض می‌شود؛ GCM باید بگیرد.
    const tampered =
      encrypted.slice(0, -2) + (encrypted.endsWith('A') ? 'B=' : 'A=');

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('با کلید متفاوت قابل بازگشایی نیست', () => {
    const encrypted = encryptSecret('راز');
    process.env.SECRET_ENCRYPTION_KEY = 'کلید-دیگر';

    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it('ساختار نامعتبر را رد می‌کند', () => {
    expect(() => decryptSecret('enc:v1:خراب')).toThrow(
      'مقدار رمزشده ساختار معتبری ندارد',
    );
  });

  describe('هدرها', () => {
    it('همه‌ی مقادیر را رمز و باز می‌کند', () => {
      const headers = {
        authorization: 'Bearer abc123',
        'x-api-key': 'secret-key',
      };

      const encrypted = encryptHeaders(headers);
      expect(encrypted.authorization).not.toContain('abc123');
      expect(decryptHeaders(encrypted)).toEqual(headers);
    });

    it('نام هدر را دست‌نخورده نگه می‌دارد', () => {
      const encrypted = encryptHeaders({ authorization: 'x' });
      expect(Object.keys(encrypted)).toEqual(['authorization']);
    });

    it('شیء خالی را اداره می‌کند', () => {
      expect(encryptHeaders({})).toEqual({});
      expect(decryptHeaders({})).toEqual({});
    });
  });
});
