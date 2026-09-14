import type { Question } from './types';

/**
 * یک سوال آماده در بانک.
 *
 * شناسه عمدا اینجا نیست: شناسه باید هنگام درج و بر اساس سوال‌های موجودِ همان
 * فرم ساخته شود، وگرنه دو سوال از بانک با یک شناسه وارد فرم می‌شوند و منطق
 * پرش و نمایش به سوال اشتباه اشاره می‌کند.
 */
export type BankQuestion = Omit<Question, 'id'>;

export interface BankGroup {
  title: string;
  questions: BankQuestion[];
}

const SCALE_10 = {
  min: 0,
  max: 10,
  labels: { start: 'خیلی بد', end: 'عالی' },
} as const;

/** یک سوال امتیاز ۰ تا ۱۰، با همان قراردادی که قالب‌های آماده دارند. */
function rate(title: string): BankQuestion {
  return { type: 'rating', title, required: true, meta: { ...SCALE_10 } };
}

/**
 * بانک سوالات آماده.
 *
 * هدفش این است که ساختن یک نظرسنجی از صفر، نوشتن سی عنوان فارسی از نو نباشد.
 * متن‌ها از همان لحن قالب‌های آماده پیروی می‌کنند تا فرمی که ترکیبی از بانک و
 * قالب است، یکدست بماند.
 */
export const QUESTION_BANK: BankGroup[] = [
  {
    title: 'رضایت کلی',
    questions: [
      rate('در مجموع چقدر از تجربه‌تان راضی بودید؟'),
      {
        type: 'nps',
        title: 'چقدر احتمال دارد ما را به دوستانتان معرفی کنید؟',
        required: true,
        meta: { labels: { start: 'اصلاً', end: 'خیلی زیاد' } },
      },
      {
        type: 'long_text',
        title: 'دلیل امتیازی که دادید چیست؟',
        description: 'هرچه بنویسید به بهتر شدن ما کمک می‌کند.',
      },
      {
        type: 'boolean',
        title: 'آیا دوباره از ما استفاده می‌کنید؟',
        options: ['بله', 'خیر'],
      },
      {
        type: 'long_text',
        title: 'اگر یک چیز را می‌توانستید تغییر دهید، چه بود؟',
      },
    ],
  },
  {
    title: 'هتل و اقامت',
    questions: [
      {
        type: 'multiple_choice',
        title: 'از کدام بخش‌ها استفاده کردید؟',
        description: 'می‌توانید چند مورد را انتخاب کنید.',
        options: ['رستوران', 'استخر', 'اتاق ورزش', 'اسپا', 'خدمات اتاق'],
        meta: { multiple: true },
      },
      rate('کیفیت نظافت اتاق'),
      rate('برخورد و رفتار کارکنان پذیرش'),
      rate('سرعت پذیرش و تحویل اتاق'),
      rate('آرامش و بی‌سروصدا بودن اتاق'),
      rate('کیفیت صبحانه'),
      rate('نسبت کیفیت به قیمت'),
      {
        type: 'dropdown',
        title: 'هدف از این سفر چه بود؟',
        options: ['تفریحی', 'کاری', 'درمانی', 'خانوادگی', 'سایر'],
      },
    ],
  },
  {
    title: 'رستوران و پذیرایی',
    questions: [
      rate('کیفیت و طعم غذا'),
      rate('تنوع منو'),
      rate('سرعت سرو غذا'),
      rate('نظافت محیط رستوران'),
      {
        type: 'long_text',
        title: 'کدام غذا را بیشتر پسندیدید و چرا؟',
      },
    ],
  },
  {
    title: 'پشتیبانی و خدمات',
    questions: [
      rate('سرعت پاسخ‌گویی پشتیبانی'),
      rate('دانش و توانایی کارشناس در حل مشکل'),
      {
        type: 'boolean',
        title: 'آیا مشکل شما در همان تماس اول حل شد؟',
        options: ['بله', 'خیر'],
      },
      {
        type: 'dropdown',
        title: 'از چه راهی با ما تماس گرفتید؟',
        options: ['تلفن', 'واتساپ', 'تلگرام', 'ایمیل', 'حضوری'],
      },
      {
        type: 'long_text',
        title: 'اگر مشکلتان حل نشد، لطفاً توضیح دهید چه اتفاقی افتاد.',
      },
    ],
  },
  {
    title: 'شناخت مخاطب',
    questions: [
      {
        type: 'dropdown',
        title: 'از کجا با ما آشنا شدید؟',
        options: [
          'معرفی دوستان',
          'جست‌وجوی اینترنتی',
          'شبکه‌های اجتماعی',
          'تبلیغات',
          'سایر',
        ],
      },
      {
        type: 'dropdown',
        title: 'گروه سنی شما',
        options: ['زیر ۱۸', '۱۸ تا ۲۵', '۲۶ تا ۳۵', '۳۶ تا ۵۰', 'بالای ۵۰'],
      },
      {
        type: 'dropdown',
        title: 'چند بار از خدمات ما استفاده کرده‌اید؟',
        options: ['اولین بار', 'دو تا سه بار', 'بیش از سه بار'],
      },
    ],
  },
  {
    title: 'اطلاعات تماس',
    questions: [
      { type: 'short_text', title: 'نام و نام خانوادگی' },
      { type: 'mobile', title: 'شماره موبایل' },
      { type: 'email', title: 'ایمیل' },
      {
        type: 'boolean',
        title: 'اجازه می‌دهید برای پیگیری با شما تماس بگیریم؟',
        options: ['بله', 'خیر'],
      },
    ],
  },
];

/** جست‌وجوی ساده روی عنوان و توضیح سوال‌ها. */
export function searchBank(needle: string): BankGroup[] {
  const query = needle.trim();
  if (!query) return QUESTION_BANK;

  return QUESTION_BANK.map((group) => ({
    ...group,
    questions: group.questions.filter(
      (q) =>
        q.title.includes(query) ||
        (q.description ?? '').includes(query) ||
        group.title.includes(query),
    ),
  })).filter((group) => group.questions.length > 0);
}
