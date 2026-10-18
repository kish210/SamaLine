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
    {
      id: 'h_room',
      type: 'number',
      title: 'شماره اتاق',
      required: false,
      meta: { min: 1, max: 9999 },
    },
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
          // بدون سقف، «نرخ شاخص» در گزارش قابل محاسبه نیست؛ سوال‌های
          // امتیازی این قالب همه مقیاس ۰ تا ۱۰ دارند.
          maxScore: 10,
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

/** گزینه‌های سوال دروازه‌ای «آیا از این خدمت استفاده کرده‌اید؟». */
const USED = 'استفاده کردم';
const NOT_USED = 'استفاده نکردم';

/**
 * خدمت دروازه‌دار: اول می‌پرسیم استفاده کرده یا نه، و فقط اگر کرده باشد
 * امتیازش را می‌گیریم.
 *
 * این با الگوی «همه‌چیز را امتیاز بده» فرق دارد و مهم است: مهمانی که اصلا
 * به استخر نرفته، اگر مجبور شود امتیاز بدهد یا عدد الکی می‌زند یا فرم را
 * رها می‌کند — هر دو داده را خراب می‌کند.
 */
function gatedService(
  id: string,
  gateTitle: string,
  ratingTitle: string,
): {
  questions: NonNullable<FormPageNode['questions']>;
  rule: Record<string, unknown>;
  ratingId: string;
} {
  const ratingId = `${id}_sat`;
  return {
    ratingId,
    questions: [
      {
        id,
        type: 'multiple_choice',
        title: gateTitle,
        required: true,
        options: [USED, NOT_USED],
      },
      rating(ratingId, ratingTitle),
    ],
    rule: {
      targetQuestionId: ratingId,
      when: {
        combinator: 'and',
        conditions: [{ source: id, operator: 'equals', value: USED }],
      },
    },
  };
}

/** خدمت‌های دروازه‌دار هتل: شناسه، متن سوال دروازه، متن سوال امتیاز. */
const GATED_SERVICES: Array<[string, string, string]> = [
  [
    't_transfer',
    'آیا از ترانسفر فرودگاهی استفاده کرده‌اید؟',
    'میزان رضایتمندی شما در خصوص ترانسفر فرودگاهی؟',
  ],
  [
    't_house',
    'آیا از خدمات نظافت اتاق استفاده کرده‌اید؟',
    'میزان رضایتمندی شما از نظافت اتاق',
  ],
  [
    't_restaurant',
    'آیا از رستوران هتل استفاده کرده‌اید؟',
    'کیفیت نوشیدنی و غذا در رستوران',
  ],
  [
    't_cafe',
    'آیا از کافی‌شاپ هتل استفاده کرده‌اید؟',
    'کیفیت خدمات کافی‌شاپ',
  ],
  [
    't_roomservice',
    'آیا از روم سرویس هتل استفاده کرده‌اید؟',
    'کیفیت خدمات روم سرویس',
  ],
  [
    't_spa',
    'آیا از باشگاه ورزشی، اسپا، ماساژ و استخر هتل استفاده کرده‌اید؟',
    'کیفیت باشگاه ورزشی، اسپا، ماساژ و استخر',
  ],
  ['t_shop', 'آیا از فروشگاه هتل استفاده کرده‌اید؟', 'فروشگاه‌ها'],
  ['t_photo', 'آیا از عکاسی هتل استفاده کرده‌اید؟', 'کیفیت خدمات عکاسی'],
  [
    't_hall',
    'آیا از سالن همایش / سمینار / رویدادهای اجتماعی استفاده کرده‌اید؟',
    'کیفیت سالن همایش و رویدادها',
  ],
];

/**
 * نظرسنجی هتل با ساختار دروازه‌ای — بازسازی یک نظرسنجی واقعی گروه هتل‌ها.
 *
 * تفاوتش با قالب اول این است که به‌جای پرسیدن علت نارضایتی، اول می‌پرسد
 * مهمان از کدام خدمت‌ها اصلا استفاده کرده و بقیه را نمی‌پرسد. برای هتلی که
 * خدمات متنوع دارد، مسیر پاسخ‌دهی خیلی کوتاه‌تر می‌شود.
 */
function hotelGatedTemplate(): FormTemplate {
  const questions: NonNullable<FormPageNode['questions']> = [
    {
      id: 't_name',
      type: 'short_text',
      title: 'نام و نام خانوادگی',
      required: true,
    },
    { id: 't_checkin', type: 'date', title: 'تاریخ ورود', required: false },
    { id: 't_checkout', type: 'date', title: 'تاریخ خروج', required: false },
    {
      id: 't_room',
      type: 'number',
      title: 'شماره اتاق',
      required: false,
      meta: { min: 1, max: 9999 },
    },
    { id: 't_mobile', type: 'mobile', title: 'تلفن همراه', required: false },
    {
      id: 't_agency',
      type: 'short_text',
      title: 'نام آژانسی که از آن تور تهیه کرده‌اید',
      required: false,
    },
    rating(
      't_agency_rating',
      'به‌طور کلی رضایتمندی شما در خصوص تور و آژانس چگونه است؟',
    ),
    rating('t_reception', 'نحوه عملکرد و سرعت پذیرشگر در هنگام ورود'),
    rating('t_bellboy', 'میزان رضایتمندی شما در خصوص اطلاع‌رسانی و توضیحات بل‌بوی'),
  ];

  const display: Array<Record<string, unknown>> = [];
  const ratingIds = ['t_agency_rating', 't_reception', 't_bellboy'];

  for (const [id, gateTitle, ratingTitle] of GATED_SERVICES) {
    const service = gatedService(id, gateTitle, ratingTitle);
    questions.push(...service.questions);
    display.push(service.rule);
    ratingIds.push(service.ratingId);
  }

  for (const [id, title] of [
    ['t_tourism', 'کیفیت خدمات گردشگری'],
    [
      't_comfort',
      'میزان راحتی شما در بخش اقامت از نظر نزدیکی به معیار خواسته‌های شما',
    ],
    ['t_services', 'میزان رضایتمندی شما از دریافت خدمات'],
    [
      't_overall',
      'به‌طور کلی رضایتمندی شما در خصوص اقامت اخیر خود چگونه است؟',
    ],
  ]) {
    questions.push(rating(id, title));
    ratingIds.push(id);
  }

  questions.push({
    id: 't_recommend',
    type: 'boolean',
    title: 'آیا این هتل را به دوستان و آشنایان خود پیشنهاد می‌کنید؟',
    required: false,
  });
  questions.push({
    id: 't_suggestion',
    type: 'long_text',
    title:
      'آیا پیشنهادی در خصوص ارائه خدمات و اقامتی خاطره‌انگیزتر برای ما دارید؟',
    required: false,
  });
  questions.push({
    id: 't_contact',
    type: 'mobile',
    title: 'اطلاعات تماس',
    required: false,
  });

  return {
    key: 'hotel-gated',
    title: 'نظرسنجی هتل ۲ — پرسش بر پایه‌ی خدمات استفاده‌شده',
    summary:
      'اول می‌پرسد مهمان از کدام خدمت استفاده کرده و فقط همان‌ها را امتیاز می‌گیرد؛ ترانسفر، رستوران، کافی‌شاپ، روم‌سرویس، اسپا، فروشگاه، عکاسی و سالن همایش.',
    category: 'گردشگری و هتلداری',
    icon: '🛎',
    structure: {
      pages: [{ id: 'p1', title: 'نظرسنجی اقامت', questions }],
      logic: { display },
      scoreIndexes: [
        {
          id: 'stay',
          key: 'رضایت کلی',
          method: 'avg',
          maxScore: 10,
          // فقط امتیازهای پرسیده‌شده وارد میانگین می‌شوند؛ خدمتی که مهمان
          // استفاده نکرده پاسخی ندارد و میانگین را پایین نمی‌کشد.
          questionIds: ratingIds,
        },
      ],
    },
    settings: {
      startPageEnabled: true,
      startPageText:
        'مهمان گرانقدر، نظر شما درباره‌ی اقامتتان راهنمای ما برای بهتر شدن است.',
      endPageText: 'از همراهی شما سپاسگزاریم. تا دیدار بعدی!',
      theme: { preset: 'aseman', oneQuestionPerStep: true },
    },
  };
}

/** قالب‌های آماده‌ی سامانه. */
export const FORM_TEMPLATES: FormTemplate[] = [
  hotelTemplate(),
  hotelGatedTemplate(),

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
          maxScore: 10,
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
    key: 'job-application',
    title: 'فرم استخدام و درخواست همکاری',
    summary:
      'جمع‌آوری اطلاعات داوطلب استخدام: مشخصات، سابقه، تحصیلات، مهارت، حقوق درخواستی و رزومه.',
    category: 'منابع انسانی',
    icon: '💼',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'مشخصات فردی',
          questions: [
            {
              id: 'j_name',
              type: 'short_text',
              title: 'نام و نام خانوادگی',
              required: true,
            },
            { id: 'j_mobile', type: 'mobile', title: 'شماره موبایل', required: true },
            { id: 'j_email', type: 'email', title: 'ایمیل', required: false },
            { id: 'j_birth', type: 'date', title: 'تاریخ تولد', required: false },
            {
              id: 'j_gender',
              type: 'multiple_choice',
              title: 'جنسیت',
              options: ['مرد', 'زن'],
              required: false,
            },
            {
              id: 'j_military',
              type: 'dropdown',
              title: 'وضعیت نظام وظیفه',
              options: ['معاف', 'پایان خدمت', 'مشمول', 'در حال خدمت', 'مشمول نیست'],
              required: false,
            },
            {
              id: 'j_city',
              type: 'short_text',
              title: 'شهر محل سکونت',
              required: false,
            },
          ],
        },
        {
          id: 'p2',
          title: 'سابقه و تحصیلات',
          questions: [
            {
              id: 'j_position',
              type: 'short_text',
              title: 'عنوان شغلی موردنظر',
              required: true,
            },
            {
              id: 'j_education',
              type: 'dropdown',
              title: 'بالاترین مدرک تحصیلی',
              options: [
                'زیر دیپلم',
                'دیپلم',
                'کاردانی',
                'کارشناسی',
                'کارشناسی ارشد',
                'دکتری',
              ],
              required: true,
            },
            {
              id: 'j_field',
              type: 'short_text',
              title: 'رشته تحصیلی',
              required: false,
            },
            {
              id: 'j_experience',
              type: 'number',
              title: 'سابقه کار مرتبط (سال)',
              meta: { min: 0, max: 60 },
              required: false,
            },
            {
              id: 'j_skills',
              type: 'long_text',
              title: 'مهارت‌ها و توانمندی‌های اصلی',
              required: false,
            },
            {
              id: 'j_lastjob',
              type: 'short_text',
              title: 'آخرین محل کار و سمت',
              required: false,
            },
          ],
        },
        {
          id: 'p3',
          title: 'شرایط همکاری',
          questions: [
            {
              id: 'j_salary',
              type: 'number',
              title: 'حقوق درخواستی (تومان)',
              meta: { min: 0 },
              required: false,
            },
            {
              id: 'j_cooperation',
              type: 'multiple_choice',
              title: 'نوع همکاری موردنظر',
              options: ['تمام‌وقت', 'پاره‌وقت', 'دورکاری', 'پروژه‌ای'],
              required: false,
            },
            {
              id: 'j_start',
              type: 'dropdown',
              title: 'زمان آمادگی برای شروع کار',
              options: ['فوری', 'تا یک هفته', 'تا یک ماه', 'بیش از یک ماه'],
              required: false,
            },
            {
              id: 'j_resume',
              type: 'file_upload',
              title: 'بارگذاری رزومه',
              required: false,
            },
            {
              id: 'j_about',
              type: 'long_text',
              title: 'چرا مایل به همکاری با ما هستید؟',
              required: false,
            },
          ],
        },
      ],
    },
    settings: {
      startPageText:
        'از علاقه‌ی شما به همکاری سپاسگزاریم. لطفاً اطلاعات زیر را تکمیل کنید.',
      endPageText: 'درخواست شما ثبت شد. در صورت تطابق با نیاز ما تماس می‌گیریم.',
      theme: { preset: 'jangal' },
    },
  },

  {
    key: 'restaurant-satisfaction',
    title: 'نظرسنجی رضایت مشتری رستوران',
    summary:
      'کیفیت غذا، سرعت سرویس، برخورد کارکنان، نظافت و قیمت؛ با پرسش علت نارضایتی.',
    category: 'اصناف',
    icon: '🍽',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'نظر شما درباره‌ی رستوران',
          questions: [
            rating('r_food', 'کیفیت و طعم غذا'),
            reason('r_food_why', 'علت نارضایتی از کیفیت غذا'),
            rating('r_speed', 'سرعت آماده‌سازی و سرویس'),
            rating('r_staff', 'برخورد و پذیرایی کارکنان'),
            rating('r_clean', 'نظافت محیط و میزها'),
            rating('r_price', 'تناسب قیمت با کیفیت'),
            {
              id: 'r_order',
              type: 'multiple_choice',
              title: 'نوع سفارش شما',
              options: ['حضوری', 'بیرون‌بر', 'آنلاین / پیک'],
              required: false,
            },
            {
              id: 'r_again',
              type: 'boolean',
              title: 'آیا دوباره به ما سر می‌زنید؟',
            },
            reason('r_note', 'پیشنهاد یا انتقاد شما'),
          ],
        },
      ],
      logic: { display: [reasonRule('r_food', 'r_food_why')] },
      scoreIndexes: [
        {
          id: 'rsat',
          key: 'رضایت کلی',
          method: 'avg',
          maxScore: 10,
          questionIds: ['r_food', 'r_speed', 'r_staff', 'r_clean', 'r_price'],
        },
      ],
    },
    settings: {
      startPageText: 'نظر شما به ما کمک می‌کند طعم و خدماتمان را بهتر کنیم.',
      endPageText: 'نوش جان! از همراهی شما سپاسگزاریم.',
      theme: { preset: 'holu', oneQuestionPerStep: true },
    },
  },

  {
    key: 'retail-shop',
    title: 'نظرسنجی فروشگاه و خرده‌فروشی',
    summary:
      'تجربه‌ی خرید در فروشگاه: تنوع کالا، قیمت، راهنمایی فروشنده، نظافت و صف صندوق.',
    category: 'اصناف',
    icon: '🛍',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'تجربه‌ی خرید شما',
          questions: [
            rating('s_variety', 'تنوع و موجودی کالا'),
            rating('s_price', 'مناسب بودن قیمت‌ها'),
            rating('s_staff', 'راهنمایی و برخورد فروشندگان'),
            rating('s_clean', 'نظم و نظافت فروشگاه'),
            rating('s_checkout', 'سرعت صندوق و تسویه‌حساب'),
            {
              id: 's_found',
              type: 'boolean',
              title: 'آیا آنچه می‌خواستید را پیدا کردید؟',
            },
            reason('s_missing', 'چه کالایی را نیافتید یا کم بود؟'),
            reason('s_note', 'پیشنهاد شما برای بهتر شدن'),
          ],
        },
      ],
      logic: {
        display: [
          {
            targetQuestionId: 's_missing',
            when: {
              combinator: 'and',
              conditions: [{ source: 's_found', operator: 'equals', value: false }],
            },
          },
        ],
      },
      scoreIndexes: [
        {
          id: 'ssat',
          key: 'رضایت کلی',
          method: 'avg',
          maxScore: 10,
          questionIds: ['s_variety', 's_price', 's_staff', 's_clean', 's_checkout'],
        },
      ],
    },
    settings: { theme: { preset: 'oghyanus', oneQuestionPerStep: true } },
  },

  {
    key: 'clinic-patient',
    title: 'نظرسنجی رضایت بیمار (مطب و کلینیک)',
    summary:
      'رضایت از نوبت‌دهی، برخورد پرسنل، توضیح پزشک، نظافت و زمان انتظار.',
    category: 'درمانی',
    icon: '🩺',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'رضایت از خدمات درمانی',
          questions: [
            rating('m_booking', 'سهولت نوبت‌دهی و پذیرش'),
            rating('m_wait', 'زمان انتظار تا ویزیت'),
            rating('m_staff', 'برخورد پرسنل و منشی'),
            rating('m_doctor', 'توضیح و دقت پزشک'),
            rating('m_clean', 'نظافت و بهداشت محیط'),
            {
              id: 'm_recommend',
              type: 'boolean',
              title: 'آیا ما را به دیگران توصیه می‌کنید؟',
            },
            reason('m_note', 'نظر یا پیشنهاد شما'),
          ],
        },
      ],
      scoreIndexes: [
        {
          id: 'msat',
          key: 'رضایت بیمار',
          method: 'avg',
          maxScore: 10,
          questionIds: ['m_booking', 'm_wait', 'm_staff', 'm_doctor', 'm_clean'],
        },
      ],
    },
    settings: {
      startPageText: 'سلامت و رضایت شما برای ما مهم است.',
      theme: { preset: 'barf', oneQuestionPerStep: true },
    },
  },

  {
    key: 'beauty-salon',
    title: 'نظرسنجی سالن زیبایی و آرایشگاه',
    summary:
      'رضایت از کیفیت خدمات، مهارت پرسنل، بهداشت، قیمت و رزرو نوبت.',
    category: 'اصناف',
    icon: '💇',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'نظر شما درباره‌ی خدمات',
          questions: [
            {
              id: 'b_service',
              type: 'dropdown',
              title: 'از کدام خدمت استفاده کردید؟',
              options: ['کوتاهی مو', 'رنگ و مش', 'میکاپ', 'ناخن', 'پوست', 'سایر'],
              required: false,
            },
            rating('b_quality', 'کیفیت خدمت دریافتی'),
            rating('b_skill', 'مهارت و دقت پرسنل'),
            rating('b_hygiene', 'رعایت بهداشت و ضدعفونی'),
            rating('b_booking', 'سهولت رزرو نوبت'),
            rating('b_price', 'تناسب قیمت با کیفیت'),
            {
              id: 'b_again',
              type: 'boolean',
              title: 'آیا دوباره مراجعه می‌کنید؟',
            },
            reason('b_note', 'پیشنهاد شما'),
          ],
        },
      ],
      scoreIndexes: [
        {
          id: 'bsat',
          key: 'رضایت کلی',
          method: 'avg',
          maxScore: 10,
          questionIds: ['b_quality', 'b_skill', 'b_hygiene', 'b_booking', 'b_price'],
        },
      ],
    },
    settings: { theme: { preset: 'bahar', oneQuestionPerStep: true } },
  },

  {
    key: 'gym-fitness',
    title: 'نظرسنجی باشگاه ورزشی',
    summary:
      'رضایت از تجهیزات، مربیان، نظافت رختکن، ساعات کاری و شلوغی سالن.',
    category: 'اصناف',
    icon: '🏋',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'نظر شما درباره‌ی باشگاه',
          questions: [
            rating('g_equipment', 'کیفیت و کفایت تجهیزات'),
            rating('g_coach', 'دانش و برخورد مربیان'),
            rating('g_clean', 'نظافت سالن و رختکن'),
            rating('g_hours', 'مناسب بودن ساعات کاری'),
            rating('g_crowd', 'وضعیت شلوغی و نوبت دستگاه‌ها'),
            {
              id: 'g_renew',
              type: 'boolean',
              title: 'آیا عضویت خود را تمدید می‌کنید؟',
            },
            reason('g_note', 'پیشنهاد شما برای بهبود'),
          ],
        },
      ],
      scoreIndexes: [
        {
          id: 'gsat',
          key: 'رضایت اعضا',
          method: 'avg',
          maxScore: 10,
          questionIds: ['g_equipment', 'g_coach', 'g_clean', 'g_hours', 'g_crowd'],
        },
      ],
    },
    settings: { theme: { preset: 'jangal', oneQuestionPerStep: true } },
  },

  {
    key: 'cafe-feedback',
    title: 'نظرسنجی کافه و قهوه‌خانه',
    summary:
      'کیفیت نوشیدنی، سرعت سرویس، فضا و موسیقی، قیمت و اینترنت.',
    category: 'اصناف',
    icon: '☕',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'تجربه‌ی شما در کافه',
          questions: [
            rating('c_drink', 'کیفیت و طعم نوشیدنی'),
            rating('c_speed', 'سرعت سرویس'),
            rating('c_space', 'فضا، دکوراسیون و موسیقی'),
            rating('c_staff', 'برخورد کارکنان'),
            rating('c_price', 'تناسب قیمت با کیفیت'),
            {
              id: 'c_wifi',
              type: 'boolean',
              title: 'آیا از اینترنت کافه استفاده کردید؟',
            },
            reason('c_note', 'پیشنهاد یا نظر شما'),
          ],
        },
      ],
      scoreIndexes: [
        {
          id: 'csat',
          key: 'رضایت کلی',
          method: 'avg',
          maxScore: 10,
          questionIds: ['c_drink', 'c_speed', 'c_space', 'c_staff', 'c_price'],
        },
      ],
    },
    settings: { theme: { preset: 'ghorub', oneQuestionPerStep: true } },
  },

  {
    key: 'course-evaluation',
    title: 'ارزیابی دوره‌ی آموزشی',
    summary:
      'نظرسنجی پایان دوره: کیفیت محتوا، تسلط مدرس، امکانات و تحقق اهداف.',
    category: 'آموزش',
    icon: '🎓',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'ارزیابی دوره',
          questions: [
            {
              id: 'd_course',
              type: 'short_text',
              title: 'نام دوره',
              required: false,
            },
            rating('d_content', 'کیفیت و کاربردی بودن محتوا'),
            rating('d_teacher', 'تسلط و روش تدریس مدرس'),
            rating('d_facility', 'امکانات آموزشی و کلاس'),
            rating('d_goal', 'میزان تحقق اهداف دوره'),
            {
              id: 'd_recommend',
              type: 'boolean',
              title: 'آیا این دوره را به دیگران پیشنهاد می‌کنید؟',
            },
            reason('d_improve', 'چه چیزی باید بهتر شود؟'),
          ],
        },
      ],
      scoreIndexes: [
        {
          id: 'dsat',
          key: 'کیفیت دوره',
          method: 'avg',
          maxScore: 10,
          questionIds: ['d_content', 'd_teacher', 'd_facility', 'd_goal'],
        },
      ],
    },
    settings: { theme: { preset: 'madrese', oneQuestionPerStep: true } },
  },

  {
    key: 'realestate-inquiry',
    title: 'فرم درخواست املاک',
    summary:
      'ثبت درخواست خرید، فروش یا اجاره‌ی ملک با نوع، منطقه، بودجه و اطلاعات تماس.',
    category: 'اصناف',
    icon: '🏠',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'درخواست شما',
          questions: [
            {
              id: 're_name',
              type: 'short_text',
              title: 'نام و نام خانوادگی',
              required: true,
            },
            { id: 're_mobile', type: 'mobile', title: 'شماره تماس', required: true },
            {
              id: 're_deal',
              type: 'multiple_choice',
              title: 'نوع درخواست',
              options: ['خرید', 'فروش', 'رهن و اجاره', 'اجاره'],
              required: true,
            },
            {
              id: 're_type',
              type: 'dropdown',
              title: 'نوع ملک',
              options: ['آپارتمان', 'ویلایی', 'زمین', 'مغازه / تجاری', 'اداری', 'سایر'],
              required: true,
            },
            {
              id: 're_area',
              type: 'short_text',
              title: 'منطقه / محله‌ی موردنظر',
              required: false,
            },
            {
              id: 're_size',
              type: 'number',
              title: 'متراژ تقریبی (متر مربع)',
              meta: { min: 0 },
              required: false,
            },
            {
              id: 're_budget',
              type: 'short_text',
              title: 'بودجه‌ی تقریبی',
              required: false,
            },
            reason('re_note', 'توضیحات بیشتر'),
          ],
        },
      ],
    },
    settings: {
      startPageText: 'درخواست خود را ثبت کنید تا کارشناسان ما با شما تماس بگیرند.',
      endPageText: 'درخواست شما ثبت شد. به‌زودی با شما تماس می‌گیریم.',
      theme: { preset: 'sakhteman' },
    },
  },

  {
    key: 'all-types',
    title: 'نمونه‌ی همه‌ی انواع سوال',
    summary:
      'هر ۲۴ نوع سوال در یک فرم، برای دیدن ظاهر و رفتار هرکدام پیش از ساخت فرم واقعی.',
    category: 'عمومی',
    icon: '🧪',
    structure: {
      pages: [
        {
          id: 'p1',
          title: 'متن و اطلاعات تماس',
          questions: [
            {
              id: 't_short',
              type: 'short_text',
              title: 'متن کوتاه — نام شما',
              required: true,
            },
            {
              id: 't_long',
              type: 'long_text',
              title: 'متن بلند — درباره‌ی خودتان بنویسید',
            },
            {
              id: 't_static',
              type: 'static_text',
              title:
                'متن ثابت — این یک توضیح است و پاسخی نمی‌گیرد.',
            },
            { id: 't_email', type: 'email', title: 'ایمیل' },
            { id: 't_url', type: 'url', title: 'وب‌سایت' },
            { id: 't_mobile', type: 'mobile', title: 'موبایل' },
            { id: 't_phone', type: 'phone', title: 'تلفن ثابت' },
            {
              id: 't_number',
              type: 'number',
              title: 'عدد — سن',
              meta: { min: 1, max: 120 },
            },
            { id: 't_date', type: 'date', title: 'تاریخ (تقویم شمسی)' },
          ],
        },
        {
          id: 'p2',
          title: 'انتخابی',
          questions: [
            { id: 't_bool', type: 'boolean', title: 'دو گزینه‌ای — موافقید؟' },
            {
              id: 't_choice',
              type: 'multiple_choice',
              title: 'چندگزینه‌ای (تک‌انتخابی)',
              options: ['گزینه اول', 'گزینه دوم', 'گزینه سوم'],
            },
            {
              id: 't_multi',
              type: 'multiple_choice',
              title: 'چندگزینه‌ای (چندانتخابی)',
              options: ['قرمز', 'آبی', 'سبز', 'زرد'],
              meta: { multiple: true },
            },
            {
              id: 't_dropdown',
              type: 'dropdown',
              title: 'لیست بازشو — استان',
              options: ['هرمزگان', 'تهران', 'فارس', 'اصفهان'],
            },
            {
              id: 't_emoji',
              type: 'emoji',
              title: 'ایموجی — حس شما چیست؟',
            },
            {
              id: 't_image',
              type: 'image_choice',
              title: 'انتخابی عکس‌دار — کدام را می‌پسندید؟',
              options: [
                'https://dummyimage.com/300x200/3ebfea/ffffff&text=A|طرح الف',
                'https://dummyimage.com/300x200/b18a5a/ffffff&text=B|طرح ب',
                'https://dummyimage.com/300x200/2e7d52/ffffff&text=C|طرح ج',
              ],
            },
            {
              id: 't_rank',
              type: 'ranking',
              title: 'اولویت‌بندی — مهم‌ترین برای شما',
              options: ['قیمت', 'کیفیت', 'سرعت', 'پشتیبانی'],
            },
          ],
        },
        {
          id: 'p3',
          title: 'سنجش و امتیاز',
          questions: [
            {
              id: 't_stars',
              type: 'rating',
              title: 'امتیازی با ستاره (۱ تا ۵)',
              meta: {
                min: 1,
                max: 5,
                labels: { start: 'ضعیف', end: 'عالی' },
              },
            },
            {
              id: 't_stars10',
              type: 'rating',
              title: 'امتیازی با دکمه‌ی عددی (۱ تا ۱۰)',
              meta: { min: 1, max: 10, style: 'number' },
            },
            {
              id: 't_nps',
              type: 'nps',
              title: 'NPS — چقدر ما را توصیه می‌کنید؟',
              meta: { labels: { start: 'اصلاً', end: 'حتماً' } },
            },
            {
              id: 't_slider',
              type: 'slider',
              title: 'نوار شناور — بودجه‌ی شما',
              meta: { min: 0, max: 100, step: 5 },
            },
            {
              id: 't_matrix',
              type: 'matrix',
              title: 'ماتریس — هر مورد را ارزیابی کنید',
              meta: {
                rows: ['کیفیت', 'قیمت', 'پشتیبانی'],
                columns: ['ضعیف', 'متوسط', 'خوب', 'عالی'],
              },
            },
          ],
        },
        {
          id: 'p4',
          title: 'رسانه و فایل',
          questions: [
            { id: 't_file', type: 'file_upload', title: 'آپلود فایل' },
            { id: 't_camera', type: 'camera', title: 'دوربین — یک عکس بگیرید' },
            { id: 't_audio', type: 'audio_record', title: 'ضبط صوتی' },
            { id: 't_sign', type: 'signature', title: 'امضا' },
            { id: 't_location', type: 'location', title: 'موقعیت مکانی' },
          ],
        },
      ],
    },
    settings: {
      startPageText:
        'این فرم نمونه‌ی همه‌ی انواع سوال است؛ برای آزمایش ظاهر و رفتار هر نوع.',
      endPageText: 'پایان نمونه. سپاسگزاریم!',
      theme: { preset: 'aseman', oneQuestionPerStep: true },
    },
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
