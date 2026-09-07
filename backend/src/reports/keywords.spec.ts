import { extractKeywords, normalizePersian } from './keywords';

describe('normalizePersian', () => {
  it('ی و ک عربی را به فارسی تبدیل می‌کند', () => {
    // کاربر با صفحه‌کلید عربی می‌نویسد و همان واژه دوبار شمرده می‌شد.
    expect(normalizePersian('كيفيت')).toBe('کیفیت');
  });

  it('نیم‌فاصله را فاصله می‌کند', () => {
    expect(normalizePersian('می‌شود')).toBe('می شود');
  });

  it('ارقام فارسی را لاتین می‌کند', () => {
    expect(normalizePersian('اتاق ۱۴۰۹')).toBe('اتاق 1409');
  });
});

describe('extractKeywords', () => {
  it('پرتکرارترین واژه‌ها را می‌دهد', () => {
    const words = extractKeywords([
      'صبحانه خیلی خوب بود',
      'صبحانه ضعیف بود',
      'صبحانه عالی',
    ]);
    expect(words[0]).toEqual({ word: 'صبحانه', count: 3 });
  });

  it('حرف اضافه و واژه‌ی پرکاربرد را نمی‌شمارد', () => {
    const words = extractKeywords([
      'از رستوران راضی بودم',
      'از رستوران راضی بودم',
      'از رستوران راضی بودم',
    ]).map((k) => k.word);

    expect(words).toContain('رستوران');
    // «از» و «بود» بدون فهرست ایست، همیشه صدرنشین نمودار می‌شدند.
    expect(words).not.toContain('از');
    expect(words).not.toContain('بود');
  });

  it('تکرار یک واژه در یک پاسخ آن را بالا نمی‌برد', () => {
    // یک نفر پرحرف نباید کل نمودار را تعیین کند.
    const words = extractKeywords([
      'استخر استخر استخر استخر استخر',
      'رستوران خوب بود',
    ]);
    expect(words.find((k) => k.word === 'استخر')?.count).toBe(1);
  });

  it('نگارش عربی و فارسی یک واژه را یکی می‌شمارد', () => {
    const words = extractKeywords(['كيفيت غذا', 'کیفیت غذا', 'کیفیت اتاق']);
    expect(words.find((k) => k.word === 'کیفیت')?.count).toBe(3);
  });

  it('واژه‌ی کوتاه و عدد خالص را کنار می‌گذارد', () => {
    const words = extractKeywords(['اتاق 1409 تمیز بود', 'اتاق 205 تمیز']).map(
      (k) => k.word,
    );
    expect(words).toContain('اتاق');
    expect(words).not.toContain('1409');
  });

  it('در نمونه‌ی بزرگ فقط واژه‌های تکرارشده را می‌آورد', () => {
    /*
     * با ده‌ها پاسخ، واژه‌ای که فقط یک‌بار آمده نویز است؛ نگه داشتنش فهرست
     * را پر می‌کند بدون آنکه الگویی نشان بدهد.
     */
    const texts = [
      'صبحانه خوب',
      'صبحانه عالی',
      'پارکینگ کوچک',
      'یکتاواژه',
      'رستوران تمیز',
    ];
    const words = extractKeywords(texts).map((k) => k.word);
    expect(words).toContain('صبحانه');
    expect(words).not.toContain('یکتاواژه');
  });

  it('فهرست خالی خروجی خالی می‌دهد', () => {
    expect(extractKeywords([])).toEqual([]);
  });
});
