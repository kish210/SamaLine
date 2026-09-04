import { DEFAULT_THEME, resolveTheme } from './theme';

describe('resolveTheme — ظاهر فرم', () => {
  it('بدون تنظیمات، تم پیش‌فرض می‌دهد', () => {
    expect(resolveTheme({})).toEqual(DEFAULT_THEME);
  });

  it('تم آماده را اعمال می‌کند', () => {
    const theme = resolveTheme({ theme: { preset: 'ocean' } });
    expect(theme.primaryColor).toBe('#0369a1');
    // مقادیر تعیین‌نشده‌ی تم آماده از پیش‌فرض می‌آیند.
    expect(theme.cornerRadius).toBe(DEFAULT_THEME.cornerRadius);
  });

  it('رنگ دلخواه بر تم آماده اولویت دارد', () => {
    const theme = resolveTheme({
      theme: { preset: 'ocean', primaryColor: '#ff0000' },
    });
    expect(theme.primaryColor).toBe('#ff0000');
  });

  it('تم آماده‌ی ناشناخته را به پیش‌فرض برمی‌گرداند', () => {
    expect(resolveTheme({ theme: { preset: 'ناموجود' } })).toEqual(
      DEFAULT_THEME,
    );
  });

  it('با داده‌ی قدیمی که theme را رشته ذخیره می‌کرد کار می‌کند', () => {
    expect(resolveTheme({ theme: 'forest' }).primaryColor).toBe('#047857');
  });

  describe('پاک‌سازی ورودی', () => {
    it('رنگ نامعتبر را نمی‌پذیرد', () => {
      for (const bad of ['قرمز', '#fff', 'red', 'rgb(0,0,0)', '#12345g', 42]) {
        expect(
          resolveTheme({ theme: { primaryColor: bad } }).primaryColor,
        ).toBe(DEFAULT_THEME.primaryColor);
      }
    });

    it('رنگ شش‌رقمی معتبر را می‌پذیرد', () => {
      expect(resolveTheme({ theme: { textColor: '#AbCdEf' } }).textColor).toBe(
        '#AbCdEf',
      );
    });

    it('نشانی javascript را رد می‌کند', () => {
      // این مقدار مستقیم در style صفحه‌ی پاسخ‌دهنده می‌نشیند.
      expect(
        resolveTheme({ theme: { logoUrl: 'javascript:alert(1)' } }).logoUrl,
      ).toBe('');
    });

    it('نشانی http و https را می‌پذیرد', () => {
      expect(
        resolveTheme({ theme: { logoUrl: 'https://cdn.test/logo.png' } })
          .logoUrl,
      ).toBe('https://cdn.test/logo.png');
    });

    it('تصویر data: را می‌پذیرد', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      expect(resolveTheme({ theme: { logoUrl: dataUrl } }).logoUrl).toBe(
        dataUrl,
      );
    });

    it('data غیرتصویری را رد می‌کند', () => {
      expect(
        resolveTheme({ theme: { logoUrl: 'data:text/html,<script>' } }).logoUrl,
      ).toBe('');
    });

    it('گردی گوشه را در بازه‌ی مجاز نگه می‌دارد', () => {
      expect(resolveTheme({ theme: { cornerRadius: 999 } }).cornerRadius).toBe(
        40,
      );
      expect(resolveTheme({ theme: { cornerRadius: -5 } }).cornerRadius).toBe(
        0,
      );
      expect(
        resolveTheme({ theme: { cornerRadius: 'زیاد' } }).cornerRadius,
      ).toBe(DEFAULT_THEME.cornerRadius);
    });

    it('نام قلم بلند را کوتاه می‌کند', () => {
      const theme = resolveTheme({ theme: { fontFamily: 'ا'.repeat(500) } });
      expect(theme.fontFamily.length).toBeLessThanOrEqual(120);
    });

    it('گرادیان و حالت تک‌سوالی را می‌خواند', () => {
      const theme = resolveTheme({
        theme: {
          gradientColor: '#8ccbf0',
          gradientAngle: 45,
          oneQuestionPerStep: true,
        },
      });
      expect(theme.gradientColor).toBe('#8ccbf0');
      expect(theme.gradientAngle).toBe(45);
      expect(theme.oneQuestionPerStep).toBe(true);
    });

    it('زاویه‌ی گرادیان را در بازه‌ی ۰ تا ۳۶۰ نگه می‌دارد', () => {
      expect(
        resolveTheme({ theme: { gradientAngle: 400 } }).gradientAngle,
      ).toBe(40);
      expect(
        resolveTheme({ theme: { gradientAngle: -30 } }).gradientAngle,
      ).toBe(330);
      expect(
        resolveTheme({ theme: { gradientAngle: 'کج' } }).gradientAngle,
      ).toBe(25);
    });

    it('تم آسمانی گرادیان دارد', () => {
      const theme = resolveTheme({ theme: { preset: 'sky' } });
      expect(theme.gradientColor).toBe('#8ccbf0');
      expect(theme.primaryColor).toBe('#3ebfea');
    });

    it('تصویر پس‌زمینه را هم پاک‌سازی می‌کند', () => {
      expect(
        resolveTheme({ theme: { backgroundImageUrl: 'javascript:x' } })
          .backgroundImageUrl,
      ).toBe('');
    });
  });
});
