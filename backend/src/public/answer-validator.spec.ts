import type { FormQuestionNode } from '../forms/logic-types';
import { validateAnswers } from './answer-validator';

/** همه‌ی سوال‌ها دیده شده‌اند، مگر خلافش گفته شود. */
const allVisible = (questions: FormQuestionNode[]) =>
  new Set(questions.map((q) => q.id));

function check(
  questions: FormQuestionNode[],
  answers: Record<string, unknown>,
  visible?: Set<string>,
) {
  return validateAnswers(questions, answers, visible ?? allVisible(questions));
}

describe('validateAnswers — اعتبارسنجی پاسخ', () => {
  describe('اجباری بودن', () => {
    const questions: FormQuestionNode[] = [
      { id: 'q1', type: 'short_text', title: 'نام', required: true },
      { id: 'q2', type: 'short_text', title: 'نام خانوادگی' },
    ];

    it('سوال اجباریِ خالی خطا می‌دهد', () => {
      const errors = check(questions, {});
      expect(errors).toHaveLength(1);
      expect(errors[0].questionId).toBe('q1');
    });

    it('رشته‌ی فقط فاصله، خالی حساب می‌شود', () => {
      expect(check(questions, { q1: '   ' })).toHaveLength(1);
    });

    it('آرایه‌ی خالی هم خالی حساب می‌شود', () => {
      const multi: FormQuestionNode[] = [
        { id: 'm', type: 'multiple_choice', title: 'چند', required: true },
      ];
      expect(check(multi, { m: [] })).toHaveLength(1);
    });

    it('سوال غیراجباری خالی مشکلی ندارد', () => {
      expect(check(questions, { q1: 'علی' })).toHaveLength(0);
    });

    it('سوال پنهان، حتی اگر اجباری باشد، بررسی نمی‌شود', () => {
      // منطق شرطی سوال را پنهان کرده؛ اجبار روی چیزی که دیده نشده بی‌معناست.
      expect(check(questions, {}, new Set(['q2']))).toHaveLength(0);
    });

    it('متن ثابت پاسخ نمی‌خواهد', () => {
      const q: FormQuestionNode[] = [
        { id: 's', type: 'static_text', title: 'توضیح', required: true },
      ];
      expect(check(q, {})).toHaveLength(0);
    });
  });

  describe('عدد', () => {
    const q: FormQuestionNode[] = [
      {
        id: 'n',
        type: 'number',
        title: 'شماره اتاق',
        meta: { min: 1, max: 999 },
      },
    ];

    it('حروف پذیرفته نمی‌شود', () => {
      // همان موردی که در آزمون دستی دیده شد: حرف در فیلد عددی قبول می‌شد.
      expect(check(q, { n: 'سلام' })).toHaveLength(1);
      expect(check(q, { n: 'abc' })).toHaveLength(1);
    });

    it('عدد درست پذیرفته می‌شود', () => {
      expect(check(q, { n: 301 })).toHaveLength(0);
      expect(check(q, { n: '301' })).toHaveLength(0);
    });

    it('ارقام فارسی هم عدد شمرده می‌شوند', () => {
      expect(check(q, { n: '۳۰۱' })).toHaveLength(0);
    });

    it('خارج از بازه خطا می‌دهد', () => {
      expect(check(q, { n: 0 })).toHaveLength(1);
      expect(check(q, { n: 1000 })).toHaveLength(1);
    });
  });

  describe('موبایل و تلفن', () => {
    const q: FormQuestionNode[] = [
      { id: 'm', type: 'mobile', title: 'موبایل' },
      { id: 'p', type: 'phone', title: 'تلفن' },
    ];

    it('موبایل معتبر', () => {
      expect(check(q, { m: '09121234567' })).toHaveLength(0);
      expect(check(q, { m: '0912 123 4567' })).toHaveLength(0);
      expect(check(q, { m: '۰۹۱۲۱۲۳۴۵۶۷' })).toHaveLength(0);
    });

    it('موبایل نامعتبر', () => {
      expect(check(q, { m: '12345' })).toHaveLength(1);
      expect(check(q, { m: '9121234567' })).toHaveLength(1);
      expect(check(q, { m: 'سلام' })).toHaveLength(1);
    });

    it('تلفن ثابت با کد شهر', () => {
      expect(check(q, { p: '07644441234' })).toHaveLength(0);
      expect(check(q, { p: '123' })).toHaveLength(1);
    });
  });

  describe('ایمیل و نشانی', () => {
    const q: FormQuestionNode[] = [
      { id: 'e', type: 'email', title: 'ایمیل' },
      { id: 'u', type: 'url', title: 'سایت' },
    ];

    it('ایمیل', () => {
      expect(check(q, { e: 'a@b.com' })).toHaveLength(0);
      expect(check(q, { e: 'بدون-اتساین' })).toHaveLength(1);
      expect(check(q, { e: 'a@b' })).toHaveLength(1);
    });

    it('نشانی فقط http/https', () => {
      expect(check(q, { u: 'https://kishwifi.com' })).toHaveLength(0);
      expect(check(q, { u: 'javascript:alert(1)' })).toHaveLength(1);
      expect(check(q, { u: 'همینجوری' })).toHaveLength(1);
    });
  });

  describe('تاریخ', () => {
    const q: FormQuestionNode[] = [{ id: 'd', type: 'date', title: 'تاریخ' }];

    it('قالب میلادی ISO', () => {
      expect(check(q, { d: '2026-09-04' })).toHaveLength(0);
      expect(check(q, { d: '1405/06/13' })).toHaveLength(1);
      expect(check(q, { d: 'دیروز' })).toHaveLength(1);
    });
  });

  describe('امتیاز و NPS', () => {
    const q: FormQuestionNode[] = [
      { id: 'n', type: 'nps', title: 'توصیه' },
      { id: 'r', type: 'rating', title: 'امتیاز', meta: { min: 1, max: 5 } },
    ];

    it('NPS بین ۰ تا ۱۰', () => {
      expect(check(q, { n: 0 })).toHaveLength(0);
      expect(check(q, { n: 10 })).toHaveLength(0);
      expect(check(q, { n: 11 })).toHaveLength(1);
      expect(check(q, { n: -1 })).toHaveLength(1);
    });

    it('امتیاز در بازه‌ی تعریف‌شده‌ی خودش', () => {
      expect(check(q, { r: 5 })).toHaveLength(0);
      expect(check(q, { r: 6 })).toHaveLength(1);
      expect(check(q, { r: 'خوب' })).toHaveLength(1);
    });

    it('امتیاز بدون بازه‌ی تعریف‌شده، بازه‌اش بررسی نمی‌شود', () => {
      /*
       * فرض یک بازه‌ی پیش‌فرض، پاسخ‌های معتبرِ فرم‌های موجود را رد می‌کند.
       * این آزمون همان تصمیم را قفل می‌کند: بدون meta، فقط «عدد بودن».
       */
      const free: FormQuestionNode[] = [
        { id: 'x', type: 'rating', title: 'امتیاز آزاد' },
      ];
      expect(check(free, { x: 9 })).toHaveLength(0);
      expect(check(free, { x: 100 })).toHaveLength(0);
      expect(check(free, { x: 'خوب' })).toHaveLength(1);
    });
  });

  describe('گزینه‌ای', () => {
    const q: FormQuestionNode[] = [
      {
        id: 'c',
        type: 'multiple_choice',
        title: 'رنگ',
        options: ['قرمز', 'آبی'],
      },
      { id: 'b', type: 'boolean', title: 'بله/خیر' },
    ];

    it('گزینه باید در فهرست باشد', () => {
      // جلوگیری از فرستادن مقدار دلخواه با درخواست مستقیم به API.
      expect(check(q, { c: 'قرمز' })).toHaveLength(0);
      expect(check(q, { c: 'سبز' })).toHaveLength(1);
    });

    it('چندانتخابی، همه‌ی گزینه‌ها بررسی می‌شوند', () => {
      expect(check(q, { c: ['قرمز', 'آبی'] })).toHaveLength(0);
      expect(check(q, { c: ['قرمز', 'بنفش'] })).toHaveLength(1);
    });

    it('بله/خیر هر دو نگارش فارسی و انگلیسی را می‌پذیرد', () => {
      // فرم‌های موجود «بله/خیر» ذخیره کرده‌اند و رندرر «yes/no» می‌فرستد؛
      // سخت‌گیری روی یکی از این دو، فرم‌های قدیمی را می‌شکند.
      for (const value of ['yes', 'no', 'بله', 'خیر', 'true', 'false']) {
        expect(check(q, { b: value })).toHaveLength(0);
      }
      expect(check(q, { b: 'شاید' })).toHaveLength(1);
    });

    it('سوال گزینه‌ای بدون فهرست، بررسی نمی‌شود', () => {
      const free: FormQuestionNode[] = [
        { id: 'x', type: 'dropdown', title: 'آزاد' },
      ];
      expect(check(free, { x: 'هرچیزی' })).toHaveLength(0);
    });
  });

  it('پیام خطا عنوان سوال را دارد نه شناسه‌اش', () => {
    const q: FormQuestionNode[] = [
      { id: 'q_room', type: 'number', title: 'شماره اتاق' },
    ];
    expect(check(q, { q_room: 'الف' })[0].message).toContain('شماره اتاق');
  });
});
