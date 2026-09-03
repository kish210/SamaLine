import {
  extractItems,
  mapRecord,
  mapRecords,
  normalizeMobile,
  readPath,
} from './source-mapper';

describe('readPath', () => {
  it('مقدار تو در تو را می‌خواند', () => {
    expect(
      readPath({ user: { profile: { phone: '0912' } } }, 'user.profile.phone'),
    ).toBe('0912');
  });

  it('مسیر خالی خود شیء را برمی‌گرداند', () => {
    const obj = { a: 1 };
    expect(readPath(obj, '')).toBe(obj);
  });

  it('مسیر ناموجود undefined می‌دهد نه خطا', () => {
    expect(readPath({ a: 1 }, 'b.c.d')).toBeUndefined();
  });
});

describe('extractItems', () => {
  it('پاسخی که خودش آرایه است را می‌پذیرد', () => {
    const result = extractItems([{ name: 'الف' }, { name: 'ب' }], '');
    expect(result.items).toHaveLength(2);
    expect(result.error).toBeNull();
  });

  it('آرایه را از مسیر مشخص بیرون می‌کشد', () => {
    const result = extractItems({ data: { items: [{ id: 1 }] } }, 'data.items');
    expect(result.items).toHaveLength(1);
  });

  it('عناصر غیرشیء را دور می‌ریزد', () => {
    const result = extractItems(['متن', 42, { name: 'الف' }], '');
    expect(result.items).toEqual([{ name: 'الف' }]);
  });

  it('وقتی پاسخ آرایه نیست، کلیدهای آرایه‌ای را پیشنهاد می‌دهد', () => {
    const result = extractItems({ users: [{ a: 1 }], meta: { total: 1 } }, '');
    expect(result.items).toHaveLength(0);
    expect(result.error).toContain('users');
  });

  it('مسیر اشتباه را با پیام روشن گزارش می‌کند', () => {
    const result = extractItems({ data: {} }, 'data.rows');
    expect(result.error).toContain('data.rows');
  });
});

describe('normalizeMobile', () => {
  it('شماره‌ی استاندارد را دست‌نخورده نگه می‌دارد', () => {
    expect(normalizeMobile('09121234567')).toBe('09121234567');
  });

  it('پیش‌شماره‌ی کشوری را به صفر تبدیل می‌کند', () => {
    expect(normalizeMobile('+989121234567')).toBe('09121234567');
    expect(normalizeMobile('00989121234567')).toBe('09121234567');
    expect(normalizeMobile('989121234567')).toBe('09121234567');
  });

  it('شماره‌ی بدون صفر ابتدایی را کامل می‌کند', () => {
    expect(normalizeMobile('9121234567')).toBe('09121234567');
  });

  it('جداکننده‌ها را حذف می‌کند', () => {
    expect(normalizeMobile('0912-123-4567')).toBe('09121234567');
    expect(normalizeMobile('0912 123 4567')).toBe('09121234567');
  });

  it('ارقام فارسی را تبدیل می‌کند', () => {
    expect(normalizeMobile('۰۹۱۲۱۲۳۴۵۶۷')).toBe('09121234567');
  });

  it('ارقام عربی را تبدیل می‌کند', () => {
    expect(normalizeMobile('٠٩١٢١٢٣٤٥٦٧')).toBe('09121234567');
  });

  it('عدد را هم می‌پذیرد', () => {
    expect(normalizeMobile(9121234567)).toBe('09121234567');
  });

  it('مقدار خالی undefined می‌دهد', () => {
    expect(normalizeMobile('')).toBeUndefined();
    expect(normalizeMobile(null)).toBeUndefined();
    expect(normalizeMobile('بدون شماره')).toBeUndefined();
  });
});

describe('mapRecord', () => {
  const mapping = { fullName: 'name', mobile: 'phone', email: 'mail' };

  it('فیلدها را طبق نگاشت برمی‌دارد', () => {
    expect(
      mapRecord(
        { name: 'مریم رضایی', phone: '+989121234567', mail: 'M@Test.Local' },
        mapping,
      ),
    ).toMatchObject({
      fullName: 'مریم رضایی',
      mobile: '09121234567',
      email: 'm@test.local',
    });
  });

  it('کلیدهای نگاشت‌نشده را متغیر شخصی‌سازی می‌کند', () => {
    const result = mapRecord(
      { name: 'علی', phone: '09120000001', branch: 'تهران', score: 42 },
      mapping,
    );
    expect(result.variables).toEqual({ branch: 'تهران', score: 42 });
  });

  it('مقدار تو در تو را با مسیر نقطه‌ای می‌خواند', () => {
    expect(
      mapRecord(
        { profile: { first: 'سارا' }, contact: { cell: '09123333333' } },
        { fullName: 'profile.first', mobile: 'contact.cell' },
      ),
    ).toMatchObject({ fullName: 'سارا', mobile: '09123333333' });
  });

  it('شیء تو در تو را به‌عنوان متغیر نمی‌فرستد', () => {
    const result = mapRecord(
      { name: 'الف', phone: '0912', address: { city: 'تهران' } },
      mapping,
    );
    expect(result.variables).not.toHaveProperty('address');
  });
});

describe('mapRecords', () => {
  const mapping = { fullName: 'name', mobile: 'phone', email: 'mail' };

  it('رکورد بدون موبایل و ایمیل را کنار می‌گذارد', () => {
    const result = mapRecords(
      [
        { name: 'مریم', phone: '09121111111' },
        { name: 'بی‌نشانی' },
        { name: 'علی', mail: 'ali@test.local' },
      ],
      mapping,
    );

    expect(result.contacts).toHaveLength(2);
    expect(result.unusable).toBe(1);
  });

  it('فهرست خالی را بدون خطا اداره می‌کند', () => {
    expect(mapRecords([], mapping)).toEqual({ contacts: [], unusable: 0 });
  });
});
