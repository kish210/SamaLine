import { validateGeneratedForm } from './form-schema.validator';

describe('validateGeneratedForm', () => {
  const validForm = {
    title: 'نظرسنجی رضایت',
    language: 'fa',
    pages: [
      {
        id: 'p1',
        title: 'صفحه اول',
        questions: [
          { id: 'q1', type: 'short_text', title: 'نام شما؟', required: true },
          {
            id: 'q2',
            type: 'multiple_choice',
            title: 'کدام خدمت؟',
            options: ['الف', 'ب'],
          },
        ],
      },
    ],
  };

  it('ساختار درست را می‌پذیرد و نرمال می‌کند', () => {
    const result = validateGeneratedForm(validForm);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.normalized?.pages[0].questions).toHaveLength(2);
  });

  it('خروجی غیرشیء را رد می‌کند', () => {
    expect(validateGeneratedForm('سلام').valid).toBe(false);
    expect(validateGeneratedForm(null).errors).toContain(
      'خروجی مدل یک شیء نیست',
    );
  });

  it('فرم بدون عنوان را رد می‌کند', () => {
    const result = validateGeneratedForm({ ...validForm, title: '  ' });
    expect(result.errors).toContain('عنوان فرم موجود نیست');
    expect(result.normalized).toBeNull();
  });

  it('فرم بدون صفحه را رد می‌کند', () => {
    expect(validateGeneratedForm({ ...validForm, pages: [] }).errors).toContain(
      'فرم هیچ صفحه‌ای ندارد',
    );
  });

  it('نوع سوال ناشناخته را رد می‌کند', () => {
    const result = validateGeneratedForm({
      ...validForm,
      pages: [
        {
          id: 'p1',
          title: 'ص',
          questions: [{ id: 'q1', type: 'تله‌پاتی', title: 'x' }],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('پشتیبانی نمی‌شود');
  });

  it('سوال بدون عنوان را رد می‌کند', () => {
    const result = validateGeneratedForm({
      ...validForm,
      pages: [
        {
          id: 'p1',
          title: 'ص',
          questions: [{ id: 'q1', type: 'short_text', title: '' }],
        },
      ],
    });
    expect(result.errors).toContain('سوال «q1» عنوان ندارد');
  });

  it('شناسه‌ی تکراری سوال را رد می‌کند', () => {
    const result = validateGeneratedForm({
      ...validForm,
      pages: [
        {
          id: 'p1',
          title: 'ص',
          questions: [
            { id: 'q1', type: 'short_text', title: 'الف' },
            { id: 'q1', type: 'short_text', title: 'ب' },
          ],
        },
      ],
    });
    expect(result.errors).toContain('شناسه سوال «q1» تکراری است');
  });

  it('صفحه‌ی بدون سوال را رد می‌کند', () => {
    const result = validateGeneratedForm({
      ...validForm,
      pages: [{ id: 'p1', title: 'خالی', questions: [] }],
    });
    expect(result.errors).toContain('صفحه p1 هیچ سوالی ندارد');
  });

  it('شناسه و عنوان جاافتاده را خودش می‌سازد', () => {
    const result = validateGeneratedForm({
      title: 'فرم',
      pages: [
        { questions: [{ type: 'short_text', title: 'سوال بدون شناسه' }] },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.normalized?.pages[0].id).toBe('page_1');
    expect(result.normalized?.pages[0].questions[0].id).toBe('page_1_q1');
  });

  it('فیلدهای ناشناخته‌ی مدل را دور می‌ریزد', () => {
    const result = validateGeneratedForm({
      title: 'فرم',
      pages: [
        {
          id: 'p1',
          title: 'ص',
          questions: [
            {
              id: 'q1',
              type: 'short_text',
              title: 'س',
              حمله: '<script>alert(1)</script>',
            },
          ],
        },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.normalized?.pages[0].questions[0]).not.toHaveProperty('حمله');
  });
});

describe('validateGeneratedForm — نام‌های رایجِ نوعِ سوال', () => {
  it('text/radio/checkbox را به نوعِ سامانه برمی‌گرداند', () => {
    const r = validateGeneratedForm({
      title: 'نظرسنجی',
      pages: [
        {
          id: 'p1',
          title: 'صفحه',
          questions: [
            { id: 'a', type: 'text', title: 'نام' },
            { id: 'b', type: 'Radio', title: 'رضایت', options: ['بله', 'خیر'] },
            { id: 'c', type: 'checkbox', title: 'خدمات', options: ['صبحانه'] },
          ],
        },
      ],
    });
    expect(r.valid).toBe(true);
    const types = r.normalized!.pages[0].questions.map((q) => q.type);
    expect(types).toEqual(['short_text', 'multiple_choice', 'multiple_choice']);
  });
});
