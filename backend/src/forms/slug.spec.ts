import { suggestSlug, validateSlug } from './slug';

describe('validateSlug — نشانی اختصاصی فرم', () => {
  it('نشانی درست را می‌پذیرد', () => {
    expect(validateSlug('nazarsanji-1405')).toEqual({
      valid: true,
      reason: null,
      normalized: 'nazarsanji-1405',
    });
  });

  it('حروف بزرگ و فاصله‌ی اطراف را یکسان‌سازی می‌کند', () => {
    expect(validateSlug('  Customer-Survey  ').normalized).toBe(
      'customer-survey',
    );
  });

  it('نشانی کوتاه‌تر از ۳ نویسه را رد می‌کند', () => {
    expect(validateSlug('ab').reason).toContain('۳ نویسه');
  });

  it('نشانی بلندتر از ۶۰ نویسه را رد می‌کند', () => {
    expect(validateSlug('a'.repeat(61)).reason).toContain('۶۰ نویسه');
  });

  it('نویسه‌ی غیرمجاز را رد می‌کند', () => {
    expect(validateSlug('نظرسنجی').valid).toBe(false);
    expect(validateSlug('my survey').valid).toBe(false);
    expect(validateSlug('my_survey').valid).toBe(false);
    expect(validateSlug('my/survey').valid).toBe(false);
  });

  it('خط تیره در ابتدا یا انتها را رد می‌کند', () => {
    expect(validateSlug('-survey').valid).toBe(false);
    expect(validateSlug('survey-').valid).toBe(false);
    expect(validateSlug('a--b').valid).toBe(false);
  });

  it('نشانی رزروشده را رد می‌کند', () => {
    expect(validateSlug('admin').reason).toBe('این نشانی رزرو شده است');
    expect(validateSlug('API').reason).toBe('این نشانی رزرو شده است');
  });

  it('نشانی خالی را رد می‌کند', () => {
    expect(validateSlug('   ').reason).toBe('نشانی خالی است');
  });
});

describe('suggestSlug', () => {
  it('عنوان لاتین را به نشانی تبدیل می‌کند', () => {
    expect(suggestSlug('Customer Experience 2026', 'fallback')).toBe(
      'customer-experience-2026',
    );
  });

  it('برای عنوان فارسی به شناسه‌ی جایگزین برمی‌گردد', () => {
    expect(suggestSlug('نظرسنجی رضایت مشتری', 'form-abc123')).toBe(
      'form-abc123',
    );
  });

  it('نشانی پیشنهادی همیشه معتبر است', () => {
    const suggestion = suggestSlug('  My   Great   Survey!!  ', 'x');
    expect(validateSlug(suggestion).valid).toBe(true);
  });
});
