import type { FormPageNode } from '../forms/logic-types';

/** یک قالب آماده‌ی فرم. */
export interface FormTemplate {
  key: string;
  title: string;
  /** یک خط توضیح برای کارت قالب در پنل. */
  summary: string;
  /** دسته‌بندی، برای گروه‌بندی در فهرست قالب‌ها. */
  category: string;
  /** ایموجی نمایشی روی کارت. */
  icon: string;
  structure: {
    pages: FormPageNode[];
    logic?: Record<string, unknown>;
    scoreIndexes?: Array<Record<string, unknown>>;
  };
  settings?: Record<string, unknown>;
}

/**
 * سوال «علت نارضایتی» که فقط با امتیاز پایین پرسیده می‌شود.
 *
 * الگوی رایج نظرسنجی رضایت: امتیاز عددی می‌گیریم و اگر پایین بود دلیلش را
 * می‌پرسیم. بدون این، داده‌ی عددی هست ولی هیچ سرنخی برای بهبود نیست.
 */
function reason(id: string, title: string) {
  return { id, type: 'long_text', title, required: false };
}

function rating(id: string, title: string) {
  return {
    id,
    type: 'rating',
    title,
    required: true,
    meta: { min: 0, max: 10, labels: { start: 'خیلی بد', end: 'عالی' } },
  };
}

/** قانون نمایش «علت نارضایتی» وقتی امتیاز زیر ۵ باشد. */
function reasonRule(sourceQuestionId: string, targetQuestionId: string) {
  return {
    targetQuestionId,
    when: {
      combinator: 'and',
      conditions: [{ source: sourceQuestionId, operator: 'lt', value: 5 }],
    },
  };
}

/** بخش‌های امتیازی نظرسنجی هتل: شناسه، عنوان امتیاز، عنوان علت. */
const HOTEL_ASPECTS: Array<[string, string, string]> = [
  [
    'h_airport',
    'میزان رضایت از استقبال فرودگاهی',
    'علت نارضایتی از استقبال فرودگاهی',
  ],
  ['h_staff', 'نحوه برخورد پرسنل', 'علت نارضایتی از برخورد پرسنل'],
  ['h_reception', 'عملکرد کارکنان پذیرش', 'علت نارضایتی از عملکرد پذیرش'],
  ['h_housekeeping', 'عملکرد کارکنان خانه‌داری', 'علت نارضایتی از خانه‌داری'],
  [
    'h_public',
    'نظافت و پاکیزگی فضای عمومی هتل',
    'علت نارضایتی از نظافت فضای عمومی',
  ],
  ['h_room_quality', 'کیفیت و نظافت اتاق', 'علت نارضایتی از نظافت اتاق'],
  ['h_cafe', 'کیفیت خدمات کافی‌شاپ', 'علت نارضایتی از کافی‌شاپ'],
  ['h_restaurant', 'کیفیت خدمات رستوران', 'علت نارضایتی از رستوران'],
  ['h_speed', 'دقت و سرعت در ارائه خدمات', 'علت نارضایتی از سرعت خدمات'],
  [
    'h_extra',
    'کیفیت خدمات جانبی (گردشگری، عکاسی، رنت‌کار)',
    'علت نارضایتی از خدمات جانبی',
  ],
];

function hotelTemplate(): FormTemplate {
  const questions: NonNullable<FormPageNode['questions']> = [
    {
      id: 'h_name',
      type: 'short_text',
      title: 'نام و نام خانوادگی',
      required: true,
    },
    { id: 'h_room', type: 'short_text', title: 'شماره اتاق', required: false },
    { id: 'h_checkin', type: 'date', title: 'تاریخ ورود', required: false },
    { id: 'h_checkout', type: 'date', title: 'تاریخ خروج', required: false },
    { id: 'h_mobile', type: 'mobile', title: 'شماره تماس', required: false },
  ];

  const display: Array<Record<string, unknown>> = [];

  for (const [id, label, reasonLabel] of HOTEL_ASPECTS) {
    questions.push(rating(id, label));
    questions.push(reason(`${id}_why`, reasonLabel));
    display.push(reasonRule(id, `${id}_why`));
  }

  questions.push({
    id: 'h_again',
    type: 'boolean',
    title: 'آیا مجدداً این هتل را برای سفر انتخاب می‌کنید؟',
    required: false,
  });
  questions.push({
    id: 'h_suggestion',
    type: 'long_text',
    title: 'پیشنهاد شما برای دیدار بعدی چیست؟',
    required: false,
  });
  questions.push({
    id: 'h_experience',
    type: 'long_text',
    title: 'تجربه اقامت خود را با ما به اشتراک بگذارید',
    required: false,
  });

  return {
    key: 'hotel-satisfaction',
    title: 'نظرسنجی رضایت مهمانان هتل',
    summary:
      'ارزیابی کامل اقامت: استقبال، پذیرش، اتاق، رستوران و خدمات جانبی. با امتیاز زیر ۵، علت نارضایتی پرسیده می‌شود.',
    category: 'گردشگری و هتلداری',
    icon: '🏨',
    structure: {
      pages: [{ id: 'p1', title: 'نظرسنجی اقامت', questions }],
      logic: { display },
      scoreIndexes: [
        {
          id: 'satisfaction',
          key: 'رضایت کلی',
          method: 'avg',
          questionIds: HOTEL_ASPECTS.map(([id]) => id),
        },
      ],
    },
    settings: {
      startPageEnabled: true,
      startPageText:
        'از اینکه وقت می‌گذارید و تجربه اقامتتان را با ما در میان می‌گذارید سپاسگزاریم.',
      endPageText: 'از همراهی شما سپاسگزاریم. تا دیدار بعدی!',
      theme: { preset: 'aseman', oneQuestionPerStep: true },
    },
  };
}

/** قالب‌های آماده‌ی سامانه. */
export const FORM_TEMPLATES: FormTemplate[] = [
  hotelTemplate(),

  {
    key: 'nps',
    title: 'سنجش وفاداری مشتری (NPS)',
    summary:
      'سوال استاندارد NPS به‌همراه پرسش علت، برای اندازه‌گیری وفاداری در طول زمان.',
    category: 'تجربه مشتری',
    icon: '📈',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'نظر شما',
          questions: [
            {
              id: 'nps',
              type: 'nps',
              title: 'چقدر احتمال دارد ما را به دوستانتان معرفی کنید؟',
              required: true,
              meta: { labels: { start: 'اصلاً', end: 'خیلی زیاد' } },
            },
            { id: 'nps_why', type: 'long_text', title: 'دلیل امتیازتان چیست؟' },
          ],
        },
      ],
      logic: { display: [reasonRule('nps', 'nps_why')] },
    },
    settings: { theme: { preset: 'oghyanus', oneQuestionPerStep: true } },
  },

  {
    key: 'employee-engagement',
    title: 'نظرسنجی رضایت کارکنان',
    summary:
      'سنجش رضایت شغلی، مدیریت، تعادل کار و زندگی و مسیر رشد، به‌صورت ناشناس.',
    category: 'منابع انسانی',
    icon: '👥',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'رضایت شغلی',
          questions: [
            {
              id: 'e_dept',
              type: 'dropdown',
              title: 'واحد سازمانی شما',
              options: [
                'فنی',
                'فروش',
                'مالی',
                'پشتیبانی',
                'منابع انسانی',
                'سایر',
              ],
              required: true,
            },
            rating('e_job', 'از شغل فعلی خود چقدر رضایت دارید؟'),
            rating('e_manager', 'از تعامل با مدیر مستقیم خود چقدر راضی هستید؟'),
            rating('e_balance', 'تعادل کار و زندگی شما چطور است؟'),
            rating('e_growth', 'از فرصت‌های رشد و یادگیری چقدر راضی هستید؟'),
            reason('e_improve', 'به نظر شما چه چیزی باید بهتر شود؟'),
          ],
        },
      ],
      scoreIndexes: [
        {
          id: 'engagement',
          key: 'شاخص رضایت کارکنان',
          method: 'avg',
          questionIds: ['e_job', 'e_manager', 'e_balance', 'e_growth'],
        },
      ],
    },
    settings: {
      startPageText:
        'پاسخ‌های شما ناشناس است و فقط به‌صورت تجمیعی گزارش می‌شود.',
      theme: { preset: 'jangal', oneQuestionPerStep: true },
    },
  },

  {
    key: 'event-feedback',
    title: 'بازخورد رویداد و همایش',
    summary: 'ارزیابی محتوا، سخنرانان، پذیرایی و محل برگزاری پس از رویداد.',
    category: 'رویداد',
    icon: '🎤',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'بازخورد رویداد',
          questions: [
            rating('v_content', 'کیفیت محتوای ارائه‌شده'),
            rating('v_speaker', 'کیفیت سخنرانان'),
            rating('v_venue', 'محل برگزاری و امکانات'),
            rating('v_catering', 'پذیرایی'),
            {
              id: 'v_again',
              type: 'boolean',
              title: 'در رویداد بعدی ما شرکت می‌کنید؟',
            },
            reason('v_note', 'نکته یا پیشنهاد دیگری دارید؟'),
          ],
        },
      ],
    },
    settings: { theme: { preset: 'kahkeshan', oneQuestionPerStep: true } },
  },

  {
    key: 'contact-form',
    title: 'فرم تماس و درخواست',
    summary: 'فرم ساده‌ی دریافت پیام، مناسب صفحه‌ی تماس با ما.',
    category: 'عمومی',
    icon: '✉️',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'تماس با ما',
          questions: [
            {
              id: 'c_name',
              type: 'short_text',
              title: 'نام و نام خانوادگی',
              required: true,
            },
            {
              id: 'c_mobile',
              type: 'mobile',
              title: 'شماره تماس',
              required: true,
            },
            { id: 'c_email', type: 'email', title: 'ایمیل' },
            {
              id: 'c_subject',
              type: 'dropdown',
              title: 'موضوع',
              options: ['پشتیبانی فنی', 'فروش', 'شکایت', 'پیشنهاد', 'سایر'],
              required: true,
            },
            {
              id: 'c_message',
              type: 'long_text',
              title: 'متن پیام',
              required: true,
            },
          ],
        },
      ],
    },
    settings: { theme: { preset: 'khakestar' } },
  },

  {
    key: 'blank',
    title: 'فرم خالی',
    summary: 'از صفر شروع کنید.',
    category: 'عمومی',
    icon: '📄',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'صفحه ۱',
          questions: [
            { id: 'q1', type: 'short_text', title: 'سوال اول', required: false },
          ],
        },
      ],
    },
  },
];

/** قالب را با کلیدش پیدا می‌کند. */
export function findTemplate(key: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((template) => template.key === key);
}
