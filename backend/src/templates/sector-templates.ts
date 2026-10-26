import type {
  FormPageNode,
  FormQuestionNode,
  LogicCondition,
} from '../forms/logic-types';
import type { FormTemplate } from './form-templates';

/**
 * کتابخانه‌ی قالب‌های آماده‌ی صنفی.
 *
 * هدف: هر کسب‌وکار یا سازمانی، هر صنفی که دارد، یک نقطه‌ی شروع آماده پیدا
 * کند که فقط لازم باشد نام خودش را رویش بگذارد. هر قالب:
 *
 * - سوال پیگیری شرطی دارد: «چرا؟» فقط وقتی پرسیده می‌شود که امتیاز پایین
 *   باشد یا کار انجام نشده باشد؛ پاسخ‌دهنده‌ی راضی سوال اضافه نمی‌بیند.
 * - شاخص امتیاز با سقف دارد تا «نرخ رضایت» در گزارش بی‌تنظیم دیده شود.
 * - حداکثر ۱۰ نوع سوال دارد تا روی پلن رایگان هم ساخته شود.
 * - تم هم‌خوان با صنف دارد.
 *
 * درستی همه‌ی این‌ها برای تک‌تک قالب‌ها در form-templates.spec.ts آزموده
 * می‌شود؛ قالب تازه‌ای که قانونی را اشتباه وصل کند، همان‌جا شکست می‌خورد.
 */

/** ترتیب نمایش دسته‌ها در پنل. */
export const TEMPLATE_CATEGORIES = [
  'عمومی',
  'تجربه مشتری',
  'فروشگاه و خرید آنلاین',
  'رستوران و کافه',
  'گردشگری و هتلداری',
  'بانک، بیمه و خدمات مالی',
  'درمان و سلامت',
  'آموزش',
  'منابع انسانی',
  'بازاریابی و پژوهش بازار',
  'رویداد',
  'خدمات عمومی و شهری',
  'ساختمان و املاک',
  'حمل‌ونقل و خودرو',
  'ورزش و تندرستی',
  'عملیات هتل',
] as const;

type Category = (typeof TEMPLATE_CATEGORIES)[number];

/**
 * سوال با شرط نمایش.
 *
 * `showWhen` کنار خود سوال نوشته می‌شود و هنگام ساخت قالب به قانون نمایش
 * تبدیل می‌شود؛ این‌طور شرط و سوالش هیچ‌وقت از هم جدا نمی‌شوند.
 */
type Question = FormQuestionNode & { showWhen?: LogicCondition };

// ─── سازنده‌های سوال ────────────────────────────────────────────

const STAR_LABELS = { start: 'خیلی ضعیف', end: 'عالی' };

/** امتیاز ۱ تا ۵ با ستاره؛ پرکاربردترین مقیاس رضایت. */
function stars(id: string, title: string, required = true): Question {
  return {
    id,
    type: 'rating',
    title,
    required,
    meta: { min: 1, max: 5, labels: STAR_LABELS },
  };
}

/** امتیاز ۰ تا ۱۰ با دکمه‌ی عددی. */
function scale10(id: string, title: string, labels = STAR_LABELS): Question {
  return {
    id,
    type: 'rating',
    title,
    required: true,
    meta: { min: 0, max: 10, style: 'number', labels },
  };
}

/** سنجش سهولت (CES) از ۱ «خیلی سخت» تا ۷ «خیلی آسان». */
function ease7(id: string, title: string): Question {
  return {
    id,
    type: 'rating',
    title,
    required: true,
    meta: {
      min: 1,
      max: 7,
      style: 'number',
      labels: { start: 'خیلی سخت', end: 'خیلی آسان' },
    },
  };
}

function nps(
  id: string,
  title = 'چقدر احتمال دارد ما را به دوستان و آشنایانتان معرفی کنید؟',
): Question {
  return {
    id,
    type: 'nps',
    title,
    required: true,
    meta: { labels: { start: 'اصلاً', end: 'حتماً' } },
  };
}

function single(
  id: string,
  title: string,
  options: string[],
  required = true,
): Question {
  return { id, type: 'multiple_choice', title, required, options };
}

function multi(
  id: string,
  title: string,
  options: string[],
  required = false,
): Question {
  return {
    id,
    type: 'multiple_choice',
    title,
    required,
    options,
    meta: { multiple: true },
  };
}

function list(
  id: string,
  title: string,
  options: string[],
  required = true,
): Question {
  return { id, type: 'dropdown', title, required, options };
}

function yesNo(id: string, title: string, required = true): Question {
  return { id, type: 'boolean', title, required };
}

function text(id: string, title: string, required = false): Question {
  return { id, type: 'short_text', title, required };
}

function longText(id: string, title: string, required = false): Question {
  return { id, type: 'long_text', title, required };
}

function mobile(
  id: string,
  title = 'شماره‌ی موبایل',
  required = true,
): Question {
  return { id, type: 'mobile', title, required };
}

function email(id: string, title = 'ایمیل', required = false): Question {
  return { id, type: 'email', title, required };
}

function date(id: string, title: string, required = false): Question {
  return { id, type: 'date', title, required };
}

function number(
  id: string,
  title: string,
  min: number,
  max: number,
  required = false,
): Question {
  return { id, type: 'number', title, required, meta: { min, max } };
}

function file(id: string, title: string, required = false): Question {
  return { id, type: 'file_upload', title, required };
}

function note(id: string, title: string): Question {
  return { id, type: 'static_text', title, required: false };
}

// ─── شرط‌ها ──────────────────────────────────────────────────────

/** امتیاز کمتر از مقدار داده‌شده (مثلا ۱ و ۲ از ۵ با `below(id, 3)`). */
function below(source: string, value: number): LogicCondition {
  return { source, operator: 'lt', value };
}

function is(source: string, value: unknown): LogicCondition {
  return { source, operator: 'equals', value };
}

/** «چرا؟» پس از امتیاز پایین ستاره‌ای (۱ یا ۲ از ۵). */
function whyLow(source: string, id: string, title: string): Question {
  return { ...longText(id, title), showWhen: below(source, 3) };
}

// ─── ساخت قالب ───────────────────────────────────────────────────

interface IndexDef {
  id: string;
  key: string;
  maxScore: number;
  questionIds: string[];
}

interface TemplateDef {
  key: string;
  title: string;
  summary: string;
  category: Category;
  icon: string;
  pages: Array<{ id: string; title: string; questions: Question[] }>;
  indexes?: IndexDef[];
  theme: string;
  /** تک‌سوالی برای نظرسنجی؛ برای فرم‌های اطلاعاتی بهتر است همه با هم بیایند. */
  oneAtATime?: boolean;
  startText?: string;
  endText?: string;
}

function build(def: TemplateDef): FormTemplate {
  const display: Array<Record<string, unknown>> = [];

  const pages: FormPageNode[] = def.pages.map((page) => ({
    id: page.id,
    title: page.title,
    questions: page.questions.map(({ showWhen, ...question }) => {
      if (showWhen) {
        display.push({
          targetQuestionId: question.id,
          when: { combinator: 'and', conditions: [showWhen] },
        });
      }
      return question;
    }),
  }));

  return {
    key: def.key,
    title: def.title,
    summary: def.summary,
    category: def.category,
    icon: def.icon,
    structure: {
      pages,
      ...(display.length ? { logic: { display } } : {}),
      ...(def.indexes?.length
        ? {
            scoreIndexes: def.indexes.map((index) => ({
              ...index,
              method: 'avg',
            })),
          }
        : {}),
    },
    settings: {
      startPageEnabled: Boolean(def.startText),
      ...(def.startText ? { startPageText: def.startText } : {}),
      endPageText: def.endText ?? 'از وقتی که گذاشتید سپاسگزاریم.',
      saveProgress: true,
      theme: { preset: def.theme, oneQuestionPerStep: def.oneAtATime ?? true },
    },
  };
}

/** شاخص رضایت از میانگین سوال‌های ستاره‌ای (سقف ۵). */
function starIndex(id: string, key: string, questionIds: string[]): IndexDef {
  return { id, key, maxScore: 5, questionIds };
}

// ─── قالب‌ها ─────────────────────────────────────────────────────

const TEMPLATES: TemplateDef[] = [
  // ── عمومی ──
  {
    key: 'suggestion-box',
    title: 'صندوق پیشنهاد و انتقاد (ناشناس)',
    summary:
      'دریافت پیشنهاد، انتقاد یا قدردانی بدون نیاز به معرفی؛ فقط اگر فرد بخواهد شماره‌اش پرسیده می‌شود.',
    category: 'عمومی',
    icon: '💡',
    theme: 'khakestar',
    oneAtATime: false,
    pages: [
      {
        id: 'p1',
        title: 'پیام شما',
        questions: [
          single('sb_type', 'نوع پیام', ['پیشنهاد', 'انتقاد', 'قدردانی']),
          list('sb_area', 'مربوط به کدام بخش است؟', [
            'خدمات و محصولات',
            'کارکنان',
            'فرایندها و قوانین',
            'محیط و امکانات',
            'سایر',
          ]),
          longText('sb_text', 'متن پیام', true),
          file('sb_file', 'فایل یا تصویر پیوست (اختیاری)'),
          yesNo('sb_contact', 'مایلید نتیجه‌ی رسیدگی را به شما اطلاع دهیم؟'),
          {
            ...mobile('sb_mobile', 'شماره‌ی موبایل برای اطلاع‌رسانی'),
            showWhen: is('sb_contact', true),
          },
        ],
      },
    ],
    endText: 'پیام شما ثبت شد. سپاسگزاریم که به بهتر شدن ما کمک می‌کنید.',
  },
  {
    key: 'quick-poll',
    title: 'نظرخواهی سریع (تک‌سوالی)',
    summary:
      'یک سوال گزینه‌ای و یک توضیح اختیاری؛ مناسب شبکه‌های اجتماعی، QR روی میز یا تصمیم‌گیری سریع تیمی.',
    category: 'عمومی',
    icon: '🗳',
    theme: 'aseman',
    pages: [
      {
        id: 'p1',
        title: 'نظر شما',
        questions: [
          single('qp_choice', 'کدام گزینه را ترجیح می‌دهید؟', [
            'گزینه‌ی اول',
            'گزینه‌ی دوم',
            'گزینه‌ی سوم',
          ]),
          longText('qp_why', 'دلیل انتخابتان (اختیاری)'),
        ],
      },
    ],
  },

  // ── تجربه مشتری ──
  {
    key: 'csat',
    title: 'رضایت مشتری (CSAT)',
    summary:
      'سنجش سریع رضایت کلی با یک امتیاز ستاره‌ای؛ با امتیاز پایین علت پرسیده می‌شود.',
    category: 'تجربه مشتری',
    icon: '⭐',
    theme: 'aftab',
    pages: [
      {
        id: 'p1',
        title: 'رضایت شما',
        questions: [
          stars('cs_overall', 'به‌طور کلی چقدر از خدمات ما راضی هستید؟'),
          whyLow('cs_overall', 'cs_why', 'چه چیزی باعث نارضایتی شما شد؟'),
          multi('cs_liked', 'کدام موارد را بیشتر پسندیدید؟', [
            'کیفیت',
            'قیمت مناسب',
            'سرعت',
            'برخورد کارکنان',
            'پشتیبانی',
          ]),
          longText('cs_note', 'پیشنهاد دیگری دارید؟'),
        ],
      },
    ],
    indexes: [starIndex('csat', 'رضایت مشتری', ['cs_overall'])],
  },
  {
    key: 'ces',
    title: 'سهولت انجام کار (CES)',
    summary:
      'چقدر برای مشتری آسان بود کارش را انجام دهد؛ بهترین پیش‌بینی‌کننده‌ی وفاداری پس از تماس یا مراجعه.',
    category: 'تجربه مشتری',
    icon: '🧭',
    theme: 'firuze',
    pages: [
      {
        id: 'p1',
        title: 'تجربه‌ی شما',
        questions: [
          single('ces_channel', 'از چه راهی اقدام کردید؟', [
            'وب‌سایت',
            'اپلیکیشن',
            'تماس تلفنی',
            'مراجعه‌ی حضوری',
          ]),
          ease7('ces_score', 'انجام کارتان با ما چقدر آسان بود؟'),
          {
            ...longText('ces_hard', 'کدام مرحله برایتان دشوار بود؟'),
            showWhen: below('ces_score', 4),
          },
          yesNo('ces_done', 'کارتان در همین مراجعه کامل انجام شد؟'),
          {
            ...longText('ces_block', 'چه چیزی مانع انجام کار شد؟'),
            showWhen: is('ces_done', false),
          },
        ],
      },
    ],
    indexes: [
      { id: 'ces', key: 'شاخص سهولت', maxScore: 7, questionIds: ['ces_score'] },
    ],
  },
  {
    key: 'product-feedback',
    title: 'بازخورد محصول',
    summary:
      'کیفیت، سهولت استفاده، ارزش در برابر قیمت، اولویت ویژگی‌ها و NPS؛ برای تیم محصول.',
    category: 'تجربه مشتری',
    icon: '📦',
    theme: 'mohandes',
    pages: [
      {
        id: 'p1',
        title: 'تجربه‌ی استفاده',
        questions: [
          list('pf_usage', 'چند وقت یک‌بار از محصول استفاده می‌کنید؟', [
            'هر روز',
            'چند بار در هفته',
            'چند بار در ماه',
            'کمتر از آن',
          ]),
          stars('pf_quality', 'کیفیت محصول'),
          stars('pf_ease', 'سهولت استفاده'),
          stars('pf_value', 'ارزش در برابر قیمت'),
          {
            id: 'pf_features',
            type: 'ranking',
            title: 'این ویژگی‌ها را به ترتیب اهمیت برای خودتان مرتب کنید',
            required: false,
            options: ['کیفیت ساخت', 'قیمت', 'طراحی', 'پشتیبانی', 'امکانات'],
          },
          longText('pf_missing', 'چه امکانی در محصول کم است؟'),
          nps(
            'pf_nps',
            'چقدر احتمال دارد این محصول را به دیگران پیشنهاد کنید؟',
          ),
          {
            ...longText('pf_nps_why', 'چه چیزی باعث می‌شود ما را توصیه نکنید؟'),
            showWhen: below('pf_nps', 7),
          },
        ],
      },
    ],
    indexes: [
      starIndex('product', 'رضایت از محصول', [
        'pf_quality',
        'pf_ease',
        'pf_value',
      ]),
    ],
  },
  {
    key: 'support-ticket',
    title: 'ارزیابی پشتیبانی پس از تماس',
    summary:
      'حل شدن مشکل، برخورد کارشناس، سرعت و سهولت؛ برای ارسال خودکار پس از بستن تیکت یا تماس.',
    category: 'تجربه مشتری',
    icon: '🎧',
    theme: 'oghyanus',
    pages: [
      {
        id: 'p1',
        title: 'ارزیابی پشتیبانی',
        questions: [
          yesNo('st_resolved', 'مشکل شما حل شد؟'),
          {
            ...longText('st_open', 'چه چیزی هنوز حل نشده است؟'),
            showWhen: is('st_resolved', false),
          },
          stars('st_agent', 'برخورد و دانش کارشناس'),
          stars('st_speed', 'سرعت پاسخگویی'),
          ease7('st_effort', 'حل مشکل چقدر برایتان آسان بود؟'),
          longText('st_note', 'نکته‌ی دیگری دارید؟'),
        ],
      },
    ],
    indexes: [
      starIndex('support', 'رضایت از پشتیبانی', ['st_agent', 'st_speed']),
    ],
  },
  {
    key: 'complaint',
    title: 'ثبت شکایت',
    summary:
      'فرم کامل ثبت شکایت با موضوع، تاریخ، شماره‌ی سفارش، شرح و پیوست مدرک؛ برای پیگیری منظم.',
    category: 'تجربه مشتری',
    icon: '📝',
    theme: 'khakestar',
    oneAtATime: false,
    pages: [
      {
        id: 'p1',
        title: 'ثبت شکایت',
        questions: [
          text('cp_name', 'نام و نام خانوادگی', true),
          mobile('cp_mobile'),
          email('cp_email'),
          list('cp_topic', 'موضوع شکایت', [
            'کیفیت محصول',
            'تاخیر در تحویل',
            'برخورد کارکنان',
            'صورت‌حساب و پرداخت',
            'خدمات پس از فروش',
            'سایر',
          ]),
          date('cp_date', 'تاریخ رخداد'),
          text('cp_ref', 'شماره‌ی سفارش یا فاکتور (در صورت وجود)'),
          longText('cp_desc', 'شرح شکایت', true),
          file('cp_file', 'تصویر یا مدرک (اختیاری)'),
          single('cp_reply', 'ترجیح می‌دهید چطور پاسخ بگیرید؟', [
            'تماس تلفنی',
            'پیامک',
            'ایمیل',
          ]),
        ],
      },
    ],
    endText:
      'شکایت شما ثبت شد و در کوتاه‌ترین زمان بررسی می‌شود. از صبر شما سپاسگزاریم.',
  },

  // ── فروشگاه و خرید آنلاین ──
  {
    key: 'post-purchase',
    title: 'رضایت پس از خرید اینترنتی',
    summary:
      'کیفیت کالا، سرعت ارسال، بسته‌بندی و تجربه‌ی سایت؛ برای ارسال خودکار چند روز پس از تحویل.',
    category: 'فروشگاه و خرید آنلاین',
    icon: '🛒',
    theme: 'holu',
    pages: [
      {
        id: 'p1',
        title: 'خرید شما',
        questions: [
          stars('pp_product', 'کالا چقدر مطابق انتظارتان بود؟'),
          whyLow('pp_product', 'pp_product_why', 'چه ایرادی در کالا بود؟'),
          stars('pp_delivery', 'سرعت ارسال'),
          stars('pp_packaging', 'بسته‌بندی'),
          stars('pp_site', 'سهولت خرید از سایت یا اپلیکیشن'),
          yesNo('pp_again', 'دوباره از ما خرید می‌کنید؟'),
          nps('pp_nps'),
        ],
      },
    ],
    indexes: [
      starIndex('shop', 'رضایت از خرید', [
        'pp_product',
        'pp_delivery',
        'pp_packaging',
        'pp_site',
      ]),
    ],
  },
  {
    key: 'store-visit',
    title: 'رضایت از فروشگاه حضوری',
    summary:
      'پیدا شدن کالا، برخورد فروشنده، قیمت، نظم فروشگاه و سرعت صندوق؛ مناسب QR کنار صندوق.',
    category: 'فروشگاه و خرید آنلاین',
    icon: '🏬',
    theme: 'ghorub',
    pages: [
      {
        id: 'p1',
        title: 'خرید امروز',
        questions: [
          single('sv_found', 'کالای مورد نظرتان را پیدا کردید؟', [
            'بله، کامل',
            'تا حدی',
            'خیر',
          ]),
          {
            ...text('sv_missing', 'دنبال چه کالایی بودید؟'),
            showWhen: is('sv_found', 'خیر'),
          },
          stars('sv_staff', 'برخورد و راهنمایی فروشنده'),
          stars('sv_price', 'قیمت‌ها'),
          stars('sv_clean', 'نظم و نظافت فروشگاه'),
          stars('sv_checkout', 'سرعت صندوق'),
          longText('sv_note', 'پیشنهادی برای ما دارید؟'),
        ],
      },
    ],
    indexes: [
      starIndex('store', 'رضایت از فروشگاه', [
        'sv_staff',
        'sv_price',
        'sv_clean',
        'sv_checkout',
      ]),
    ],
  },
  {
    key: 'website-feedback',
    title: 'بازخورد وب‌سایت و اپلیکیشن',
    summary:
      'هدف مراجعه، رسیدن به آن، سهولت، طراحی و سرعت؛ به‌همراه گزارش خطا از زبان کاربر.',
    category: 'فروشگاه و خرید آنلاین',
    icon: '🖥',
    theme: 'shab',
    pages: [
      {
        id: 'p1',
        title: 'تجربه‌ی شما',
        questions: [
          single('wf_goal', 'برای چه کاری آمدید؟', [
            'خرید',
            'کسب اطلاعات',
            'پیگیری سفارش',
            'پشتیبانی',
            'سایر',
          ]),
          yesNo('wf_done', 'به هدفتان رسیدید؟'),
          {
            ...longText('wf_block', 'کجا به مشکل خوردید؟'),
            showWhen: is('wf_done', false),
          },
          stars('wf_ease', 'سهولت استفاده'),
          stars('wf_design', 'ظاهر و طراحی'),
          stars('wf_speed', 'سرعت بارگذاری'),
          longText('wf_bug', 'اگر خطا یا مشکلی دیدید توضیح دهید'),
        ],
      },
    ],
    indexes: [
      starIndex('ux', 'رضایت از تجربه‌ی کاربری', [
        'wf_ease',
        'wf_design',
        'wf_speed',
      ]),
    ],
  },

  // ── رستوران و کافه ──
  {
    key: 'restaurant',
    title: 'نظرسنجی رستوران',
    summary:
      'طعم غذا، سرویس، نظافت، قیمت و تحویل؛ سوال نظافت فقط برای سرو در رستوران و سوال پیک فقط برای ارسال پرسیده می‌شود.',
    category: 'رستوران و کافه',
    icon: '🍽',
    theme: 'ghorub',
    pages: [
      {
        id: 'p1',
        title: 'تجربه‌ی شما',
        questions: [
          single('rs_type', 'نوع سفارش', [
            'سرو در رستوران',
            'بیرون‌بر',
            'ارسال با پیک',
          ]),
          stars('rs_food', 'کیفیت و طعم غذا'),
          whyLow('rs_food', 'rs_food_why', 'چه ایرادی در غذا بود؟'),
          stars('rs_service', 'برخورد و سرعت سرویس'),
          {
            ...stars('rs_clean', 'نظافت سالن و سرویس‌ها'),
            showWhen: is('rs_type', 'سرو در رستوران'),
          },
          {
            ...stars('rs_delivery', 'زمان و وضعیت تحویل سفارش'),
            showWhen: is('rs_type', 'ارسال با پیک'),
          },
          stars('rs_price', 'تناسب قیمت با کیفیت'),
          nps('rs_nps'),
          longText('rs_note', 'پیشنهاد یا نکته‌ی دیگری دارید؟'),
        ],
      },
    ],
    // فقط امتیازهای پرسیده‌شده در میانگین می‌آیند؛ سوال پنهان پاسخی ندارد.
    indexes: [
      starIndex('restaurant', 'رضایت از رستوران', [
        'rs_food',
        'rs_service',
        'rs_clean',
        'rs_delivery',
        'rs_price',
      ]),
    ],
  },
  {
    key: 'cafe-quick',
    title: 'نظرسنجی سریع کافه (QR روی میز)',
    summary:
      'یک ایموجی و یک جمله، در کمتر از ۱۵ ثانیه؛ برای QR روی میز یا کنار صندوق.',
    category: 'رستوران و کافه',
    icon: '☕',
    theme: 'choob',
    pages: [
      {
        id: 'p1',
        title: 'حال امروزتان',
        questions: [
          {
            id: 'cq_mood',
            type: 'emoji',
            title: 'تجربه‌ی امروزتان در کافه چطور بود؟',
            required: true,
          },
          longText('cq_note', 'حرفی با ما دارید؟'),
          mobile(
            'cq_mobile',
            'برای دریافت پیشنهادهای ویژه، شماره‌تان (اختیاری)',
            false,
          ),
        ],
      },
    ],
  },

  // ── گردشگری ──
  {
    key: 'tour-feedback',
    title: 'ارزیابی تور و آژانس مسافرتی',
    summary:
      'راهنما، برنامه‌ریزی، حمل‌ونقل، اقامت، پذیرایی و ارزش در برابر هزینه پس از بازگشت مسافر.',
    category: 'گردشگری و هتلداری',
    icon: '🧳',
    theme: 'sahel',
    pages: [
      {
        id: 'p1',
        title: 'سفر شما',
        questions: [
          text('tf_tour', 'نام تور یا مقصد'),
          stars('tf_guide', 'راهنمای تور'),
          stars('tf_plan', 'برنامه‌ریزی و زمان‌بندی'),
          stars('tf_transport', 'وسیله‌ی نقلیه'),
          stars('tf_stay', 'محل اقامت'),
          stars('tf_food', 'پذیرایی'),
          stars('tf_value', 'ارزش در برابر هزینه'),
          stars('tf_overall', 'رضایت کلی از سفر'),
          whyLow('tf_overall', 'tf_why', 'چه چیزی سفرتان را خراب کرد؟'),
          yesNo('tf_again', 'دوباره با ما سفر می‌کنید؟'),
        ],
      },
    ],
    indexes: [
      starIndex('tour', 'رضایت از تور', [
        'tf_guide',
        'tf_plan',
        'tf_transport',
        'tf_stay',
        'tf_food',
        'tf_value',
        'tf_overall',
      ]),
    ],
    endText: 'سفرتان بخیر! امیدواریم دوباره همسفرتان باشیم.',
  },

  // ── بانک، بیمه و خدمات مالی ──
  {
    key: 'bank-branch',
    title: 'رضایت مشتریان شعبه‌ی بانک',
    summary:
      'نوع خدمت، زمان انتظار، برخورد و دقت کارکنان، فضای شعبه و انجام شدن کار در یک مراجعه.',
    category: 'بانک، بیمه و خدمات مالی',
    icon: '🏦',
    theme: 'oghyanus',
    pages: [
      {
        id: 'p1',
        title: 'مراجعه‌ی شما',
        questions: [
          text('bb_branch', 'نام یا کد شعبه'),
          single('bb_service', 'برای چه خدمتی مراجعه کردید؟', [
            'افتتاح حساب',
            'تسهیلات و وام',
            'واریز و برداشت',
            'صدور کارت',
            'چک',
            'سایر',
          ]),
          single('bb_wait', 'چقدر منتظر ماندید؟', [
            'کمتر از ۵ دقیقه',
            '۵ تا ۱۵ دقیقه',
            '۱۵ تا ۳۰ دقیقه',
            'بیش از ۳۰ دقیقه',
          ]),
          stars('bb_staff', 'برخورد و راهنمایی کارکنان'),
          stars('bb_accuracy', 'دقت و درستی انجام کار'),
          stars('bb_env', 'فضا و نظم شعبه'),
          yesNo('bb_done', 'کارتان در همین مراجعه انجام شد؟'),
          {
            ...longText('bb_block', 'چه چیزی مانع انجام کار شد؟'),
            showWhen: is('bb_done', false),
          },
          nps('bb_nps', 'چقدر احتمال دارد این بانک را به دیگران پیشنهاد کنید؟'),
        ],
      },
    ],
    indexes: [
      starIndex('branch', 'رضایت از شعبه', [
        'bb_staff',
        'bb_accuracy',
        'bb_env',
      ]),
    ],
  },
  {
    key: 'insurance-claim',
    title: 'ارزیابی فرایند پرداخت خسارت بیمه',
    summary:
      'سهولت ثبت، شفافیت مدارک، سرعت رسیدگی و منصفانه بودن مبلغ؛ پس از پرداخت هر پرونده.',
    category: 'بانک، بیمه و خدمات مالی',
    icon: '🛡',
    theme: 'kuh',
    pages: [
      {
        id: 'p1',
        title: 'پرونده‌ی شما',
        questions: [
          single('ic_type', 'نوع بیمه', [
            'بدنه‌ی خودرو',
            'شخص ثالث',
            'درمان تکمیلی',
            'آتش‌سوزی و منزل',
            'عمر',
            'سایر',
          ]),
          stars('ic_ease', 'سهولت ثبت درخواست خسارت'),
          stars('ic_docs', 'روشن بودن مدارک لازم'),
          stars('ic_speed', 'سرعت رسیدگی و پرداخت'),
          stars('ic_fair', 'منصفانه بودن مبلغ پرداختی'),
          whyLow('ic_fair', 'ic_fair_why', 'چرا مبلغ را منصفانه نمی‌دانید؟'),
          stars('ic_staff', 'برخورد کارشناس'),
          yesNo('ic_renew', 'بیمه‌نامه‌تان را نزد ما تمدید می‌کنید؟'),
        ],
      },
    ],
    indexes: [
      starIndex('claim', 'رضایت از رسیدگی خسارت', [
        'ic_ease',
        'ic_docs',
        'ic_speed',
        'ic_fair',
        'ic_staff',
      ]),
    ],
  },

  // ── درمان و سلامت ──
  {
    key: 'patient-satisfaction',
    title: 'رضایت بیماران (بیمارستان و درمانگاه)',
    summary:
      'برخورد پزشک و پرستار، زمان انتظار، بهداشت، پذیرش و ترخیص، رعایت حریم خصوصی و NPS.',
    category: 'درمان و سلامت',
    icon: '🏥',
    theme: 'barf',
    pages: [
      {
        id: 'p1',
        title: 'تجربه‌ی درمان',
        questions: [
          list('ps_dept', 'بخش یا واحد', [
            'اورژانس',
            'بستری',
            'درمانگاه تخصصی',
            'آزمایشگاه',
            'تصویربرداری',
            'داروخانه',
          ]),
          stars('ps_doctor', 'توضیحات و برخورد پزشک'),
          stars('ps_nurse', 'مراقبت و برخورد پرستاران'),
          stars('ps_wait', 'زمان انتظار'),
          stars('ps_clean', 'نظافت و بهداشت'),
          stars('ps_admin', 'روند پذیرش، ترخیص و پرداخت'),
          yesNo('ps_privacy', 'حریم خصوصی شما رعایت شد؟'),
          {
            ...longText('ps_privacy_why', 'لطفا توضیح دهید'),
            showWhen: is('ps_privacy', false),
          },
          nps('ps_nps', 'چقدر احتمال دارد این مرکز را به دیگران معرفی کنید؟'),
          longText('ps_note', 'پیشنهاد یا قدردانی'),
        ],
      },
    ],
    indexes: [
      starIndex('care', 'رضایت بیمار', [
        'ps_doctor',
        'ps_nurse',
        'ps_wait',
        'ps_clean',
        'ps_admin',
      ]),
    ],
    startText:
      'پاسخ شما محرمانه است و فقط برای بهبود کیفیت خدمات درمانی استفاده می‌شود.',
    endText: 'سپاسگزاریم. برایتان سلامتی آرزو می‌کنیم.',
  },
  {
    key: 'clinic-appointment',
    title: 'درخواست نوبت مطب و درمانگاه',
    summary:
      'نام، تماس، تخصص، تاریخ و نوبت ترجیحی و بیمه؛ درخواست پس از تماس همکاران قطعی می‌شود.',
    category: 'درمان و سلامت',
    icon: '🩺',
    theme: 'barf',
    oneAtATime: false,
    pages: [
      {
        id: 'p1',
        title: 'درخواست نوبت',
        questions: [
          note(
            'ca_intro',
            'این فرم درخواست نوبت است؛ نوبت پس از تماس همکاران ما قطعی می‌شود. در موارد اورژانسی با ۱۱۵ تماس بگیرید.',
          ),
          text('ca_name', 'نام و نام خانوادگی بیمار', true),
          mobile('ca_mobile'),
          number('ca_age', 'سن', 0, 120),
          list('ca_specialty', 'تخصص مورد نیاز', [
            'پزشک عمومی',
            'داخلی',
            'کودکان',
            'زنان و زایمان',
            'پوست',
            'دندانپزشکی',
            'سایر',
          ]),
          date('ca_date', 'تاریخ ترجیحی'),
          single('ca_time', 'نوبت ترجیحی', ['صبح', 'عصر']),
          list('ca_insurance', 'بیمه', [
            'تامین اجتماعی',
            'سلامت',
            'نیروهای مسلح',
            'بیمه‌ی تکمیلی',
            'بدون بیمه',
          ]),
          longText('ca_reason', 'علت مراجعه (اختیاری)'),
        ],
      },
    ],
    endText: 'درخواست شما ثبت شد. برای قطعی کردن نوبت با شما تماس می‌گیریم.',
  },

  // ── آموزش ──
  {
    key: 'course-evaluation',
    title: 'ارزشیابی درس و مدرس',
    summary:
      'تسلط و بیان مدرس، منابع، کاربردی بودن، تعامل و حجم مطالب؛ برای دانشگاه، آموزشگاه و دوره‌های آنلاین.',
    category: 'آموزش',
    icon: '🎓',
    theme: 'madrese',
    pages: [
      {
        id: 'p1',
        title: 'ارزشیابی',
        questions: [
          text('ce_course', 'نام درس یا دوره'),
          stars('ce_mastery', 'تسلط مدرس بر موضوع'),
          stars('ce_clarity', 'بیان روشن و قابل فهم'),
          stars('ce_material', 'کیفیت جزوه و منابع'),
          stars('ce_useful', 'کاربردی بودن مطالب'),
          stars('ce_interaction', 'تعامل و پاسخگویی مدرس'),
          single('ce_load', 'حجم مطالب نسبت به زمان', ['کم', 'مناسب', 'زیاد']),
          yesNo('ce_recommend', 'این دوره را به دیگران پیشنهاد می‌کنید؟'),
          longText('ce_best', 'بهترین بخش دوره'),
          longText('ce_improve', 'چه چیزی باید بهتر شود؟'),
        ],
      },
    ],
    indexes: [
      starIndex('teaching', 'کیفیت تدریس', [
        'ce_mastery',
        'ce_clarity',
        'ce_material',
        'ce_useful',
        'ce_interaction',
      ]),
    ],
    startText:
      'پاسخ شما ناشناس است و پس از پایان ترم به مدرس نشان داده می‌شود.',
  },
  {
    key: 'parent-satisfaction',
    title: 'رضایت اولیا از مدرسه',
    summary:
      'آموزش، ارتباط با اولیا، ایمنی، انضباط، فوق‌برنامه و تناسب شهریه؛ پایان هر نیم‌سال.',
    category: 'آموزش',
    icon: '🏫',
    theme: 'madrese',
    pages: [
      {
        id: 'p1',
        title: 'نظر شما',
        questions: [
          list('pa_grade', 'پایه‌ی تحصیلی فرزندتان', [
            'پیش‌دبستانی',
            'ابتدایی',
            'متوسطه‌ی اول',
            'متوسطه‌ی دوم',
          ]),
          stars('pa_teaching', 'کیفیت آموزش'),
          whyLow('pa_teaching', 'pa_teaching_why', 'چه چیزی در آموزش کم است؟'),
          stars('pa_comm', 'ارتباط و اطلاع‌رسانی مدرسه به اولیا'),
          stars('pa_safety', 'ایمنی و بهداشت محیط'),
          stars('pa_discipline', 'نظم و انضباط'),
          stars('pa_extra', 'فعالیت‌های فوق‌برنامه'),
          stars('pa_fee', 'تناسب شهریه با خدمات'),
          yesNo(
            'pa_continue',
            'سال آینده هم فرزندتان را در این مدرسه ثبت‌نام می‌کنید؟',
          ),
          longText('pa_note', 'پیشنهاد شما'),
        ],
      },
    ],
    indexes: [
      starIndex('school', 'رضایت اولیا', [
        'pa_teaching',
        'pa_comm',
        'pa_safety',
        'pa_discipline',
        'pa_extra',
        'pa_fee',
      ]),
    ],
  },
  {
    key: 'course-registration',
    title: 'ثبت‌نام دوره و کارگاه',
    summary:
      'نام، تماس، دوره، سطح تحصیلات، زمان ترجیحی و راه آشنایی؛ برای آموزشگاه‌ها و برگزارکنندگان کارگاه.',
    category: 'آموزش',
    icon: '✍️',
    theme: 'aseman',
    oneAtATime: false,
    pages: [
      {
        id: 'p1',
        title: 'ثبت‌نام',
        questions: [
          text('cr_name', 'نام و نام خانوادگی', true),
          mobile('cr_mobile'),
          email('cr_email'),
          list('cr_course', 'دوره‌ی مورد نظر', [
            'دوره‌ی مقدماتی',
            'دوره‌ی پیشرفته',
            'کارگاه یک‌روزه',
          ]),
          list('cr_edu', 'میزان تحصیلات', [
            'دیپلم و پایین‌تر',
            'کاردانی',
            'کارشناسی',
            'کارشناسی ارشد',
            'دکتری',
          ]),
          single('cr_time', 'زمان کلاس', ['صبح', 'عصر', 'آخر هفته', 'آنلاین']),
          single(
            'cr_source',
            'از کجا با ما آشنا شدید؟',
            [
              'شبکه‌های اجتماعی',
              'دوستان',
              'جستجو در اینترنت',
              'تبلیغات',
              'سایر',
            ],
            false,
          ),
          longText('cr_note', 'توضیح یا سوال'),
        ],
      },
    ],
    endText: 'ثبت‌نام شما انجام شد. جزئیات کلاس به‌زودی برایتان پیامک می‌شود.',
  },

  // ── منابع انسانی ──
  {
    key: 'job-application',
    title: 'درخواست استخدام',
    summary:
      'اطلاعات فردی، موقعیت شغلی، سابقه، تحصیلات، رزومه، حقوق درخواستی و زمان شروع؛ در دو صفحه.',
    category: 'منابع انسانی',
    icon: '💼',
    theme: 'mohandes',
    oneAtATime: false,
    pages: [
      {
        id: 'p1',
        title: 'اطلاعات فردی',
        questions: [
          text('ja_name', 'نام و نام خانوادگی', true),
          mobile('ja_mobile'),
          email('ja_email', 'ایمیل', true),
          text('ja_city', 'شهر محل سکونت', true),
        ],
      },
      {
        id: 'p2',
        title: 'سوابق و درخواست',
        questions: [
          list('ja_position', 'موقعیت شغلی', [
            'کارشناس فروش',
            'کارشناس پشتیبانی',
            'برنامه‌نویس',
            'حسابدار',
            'کارشناس اداری',
            'سایر',
          ]),
          number('ja_years', 'سال‌های سابقه‌ی کار مرتبط', 0, 50, true),
          list('ja_edu', 'آخرین مدرک تحصیلی', [
            'دیپلم',
            'کاردانی',
            'کارشناسی',
            'کارشناسی ارشد',
            'دکتری',
          ]),
          text('ja_field', 'رشته‌ی تحصیلی'),
          file('ja_resume', 'رزومه', true),
          number('ja_salary', 'حقوق درخواستی (میلیون تومان در ماه)', 0, 1000),
          date('ja_start', 'از چه تاریخی می‌توانید شروع کنید؟'),
          longText('ja_about', 'چرا می‌خواهید به تیم ما بپیوندید؟'),
        ],
      },
    ],
    endText:
      'درخواست شما دریافت شد. در صورت هم‌خوانی با نیاز ما، برای مصاحبه تماس می‌گیریم.',
  },
  {
    key: 'onboarding',
    title: 'ارزیابی ماه اول کارمند جدید',
    summary:
      'استقبال، آماده بودن ابزار، روشنی وظایف، آموزش و حمایت مدیر؛ و هم‌خوانی کار با قول‌های مصاحبه.',
    category: 'منابع انسانی',
    icon: '🌱',
    theme: 'bahar',
    pages: [
      {
        id: 'p1',
        title: 'ماه اول شما',
        questions: [
          stars('ob_welcome', 'استقبال و معرفی به تیم'),
          stars('ob_tools', 'آماده بودن ابزار و دسترسی‌ها از روز اول'),
          stars('ob_clarity', 'روشن بودن شرح وظایف'),
          stars('ob_training', 'آموزش‌های اولیه'),
          stars('ob_manager', 'حمایت مدیر مستقیم'),
          single('ob_expect', 'کار با آنچه در مصاحبه گفته شد هم‌خوانی دارد؟', [
            'کاملا',
            'تا حدی',
            'خیر',
          ]),
          {
            ...longText('ob_gap', 'چه تفاوتی وجود دارد؟'),
            showWhen: is('ob_expect', 'خیر'),
          },
          longText('ob_help', 'به چه کمکی نیاز دارید؟'),
        ],
      },
    ],
    indexes: [
      starIndex('onboarding', 'کیفیت ورود به سازمان', [
        'ob_welcome',
        'ob_tools',
        'ob_clarity',
        'ob_training',
        'ob_manager',
      ]),
    ],
  },
  {
    key: 'evaluation-360',
    title: 'ارزیابی ۳۶۰ درجه‌ی شایستگی',
    summary:
      'شش شایستگی کلیدی از نگاه خود فرد، مدیر، همکار و زیرمجموعه؛ هر شایستگی شاخص جدا دارد و در گزارش نمودار رادار رسم می‌شود.',
    category: 'منابع انسانی',
    icon: '🔄',
    theme: 'kahkeshan',
    pages: [
      {
        id: 'p1',
        title: 'ارزیابی',
        questions: [
          text('e360_person', 'نام فرد ارزیابی‌شونده', true),
          list('e360_relation', 'نسبت شما با این فرد', [
            'خودارزیابی',
            'مدیر',
            'همکار هم‌سطح',
            'زیرمجموعه',
            'مشتری داخلی',
          ]),
          stars('e360_comm', 'ارتباط مؤثر و شنیدن دیگران'),
          stars('e360_team', 'کار تیمی و همکاری'),
          stars('e360_resp', 'مسئولیت‌پذیری و تعهد'),
          stars('e360_problem', 'حل مسئله و تصمیم‌گیری'),
          stars('e360_lead', 'رهبری و الهام‌بخشی'),
          stars('e360_expert', 'دانش و مهارت تخصصی'),
          longText('e360_strength', 'مهم‌ترین نقاط قوت'),
          longText('e360_improve', 'مهم‌ترین زمینه‌های بهبود'),
        ],
      },
    ],
    indexes: [
      starIndex('comm', 'ارتباط مؤثر', ['e360_comm']),
      starIndex('team', 'کار تیمی', ['e360_team']),
      starIndex('resp', 'مسئولیت‌پذیری', ['e360_resp']),
      starIndex('problem', 'حل مسئله', ['e360_problem']),
      starIndex('lead', 'رهبری', ['e360_lead']),
      starIndex('expert', 'دانش تخصصی', ['e360_expert']),
    ],
    startText:
      'ارزیابی شما محرمانه است و فقط به‌صورت تجمیعی (میانگین چند ارزیاب) به فرد نشان داده می‌شود.',
  },
  {
    key: 'exit-interview',
    title: 'مصاحبه‌ی خروج',
    summary:
      'دلایل ترک سازمان، رابطه با مدیر، حقوق، رشد و فرهنگ کاری، و شاخص eNPS؛ برای کاهش ترک خدمت.',
    category: 'منابع انسانی',
    icon: '🚪',
    theme: 'khakestar',
    pages: [
      {
        id: 'p1',
        title: 'تجربه‌ی همکاری',
        questions: [
          list('ex_tenure', 'مدت همکاری', [
            'کمتر از ۶ ماه',
            '۶ ماه تا ۲ سال',
            '۲ تا ۵ سال',
            'بیش از ۵ سال',
          ]),
          multi(
            'ex_reasons',
            'دلایل اصلی ترک سازمان',
            [
              'حقوق و مزایا',
              'فرصت رشد',
              'رابطه با مدیر',
              'حجم کار',
              'رفت‌وآمد',
              'پیشنهاد شغلی بهتر',
              'فرهنگ سازمانی',
              'دلایل شخصی',
            ],
            true,
          ),
          stars('ex_manager', 'رابطه با مدیر مستقیم'),
          stars('ex_pay', 'حقوق و مزایا'),
          stars('ex_growth', 'فرصت یادگیری و رشد'),
          stars('ex_culture', 'فضا و فرهنگ کاری'),
          nps(
            'ex_enps',
            'چقدر احتمال دارد این سازمان را به‌عنوان محل کار به دوستانتان پیشنهاد کنید؟',
          ),
          yesNo('ex_return', 'در آینده دوباره با ما همکاری می‌کنید؟'),
          longText('ex_keep', 'چه چیزی می‌توانست شما را نگه دارد؟'),
        ],
      },
    ],
    indexes: [
      starIndex('exit', 'رضایت از دوره‌ی همکاری', [
        'ex_manager',
        'ex_pay',
        'ex_growth',
        'ex_culture',
      ]),
    ],
    startText:
      'پاسخ صادقانه‌ی شما به همکاران بعدی کمک می‌کند. پاسخ‌ها محرمانه‌اند.',
  },
  {
    key: 'training-evaluation',
    title: 'ارزیابی دوره‌ی آموزشی کارکنان',
    summary:
      'ارتباط محتوا با کار، قابلیت به‌کارگیری، مدرس و امکانات؛ با مقایسه‌ی دانش پیش و پس از دوره.',
    category: 'منابع انسانی',
    icon: '📚',
    theme: 'firuze',
    pages: [
      {
        id: 'p1',
        title: 'ارزیابی دوره',
        questions: [
          text('te_course', 'نام دوره'),
          stars('te_relevance', 'ارتباط محتوا با کار شما'),
          stars('te_apply', 'چقدر می‌توانید آموخته‌ها را در کار به‌کار ببرید؟'),
          stars('te_trainer', 'مدرس'),
          stars('te_logistics', 'زمان‌بندی، مکان و امکانات'),
          {
            id: 'te_before',
            type: 'slider',
            title: 'دانش شما درباره‌ی موضوع پیش از دوره (از ۱۰۰)',
            required: true,
            meta: { min: 0, max: 100, step: 10 },
          },
          {
            id: 'te_after',
            type: 'slider',
            title: 'دانش شما درباره‌ی موضوع پس از دوره (از ۱۰۰)',
            required: true,
            meta: { min: 0, max: 100, step: 10 },
          },
          longText(
            'te_topics',
            'چه موضوع‌هایی برای دوره‌های بعد پیشنهاد می‌کنید؟',
          ),
        ],
      },
    ],
    indexes: [
      starIndex('training', 'کیفیت دوره', [
        'te_relevance',
        'te_apply',
        'te_trainer',
        'te_logistics',
      ]),
    ],
  },
  {
    key: 'wellbeing',
    title: 'رفاه و سلامت روان کارکنان (ناشناس)',
    summary:
      'انرژی، حجم کار، حمایت، تعادل کار و زندگی، امنیت روانی و نوع حمایت مورد نیاز؛ کاملا ناشناس.',
    category: 'منابع انسانی',
    icon: '💚',
    theme: 'barg',
    pages: [
      {
        id: 'p1',
        title: 'حال شما',
        questions: [
          note(
            'wb_intro',
            'این نظرسنجی ابزار تشخیص پزشکی نیست؛ برای شناخت وضعیت کلی و برنامه‌ریزی حمایت از کارکنان است.',
          ),
          stars('wb_energy', 'انرژی و انگیزه‌ی شما در کار'),
          stars('wb_load', 'قابل مدیریت بودن حجم کار'),
          stars('wb_support', 'احساس حمایت از سوی مدیر و همکاران'),
          stars('wb_balance', 'تعادل کار و زندگی'),
          stars('wb_safety', 'احساس امنیت برای بیان نظر و اشتباه'),
          single(
            'wb_stress',
            'در ماه گذشته چقدر به‌خاطر کار احساس فشار کرده‌اید؟',
            ['به‌ندرت', 'گاهی', 'اغلب', 'تقریبا همیشه'],
          ),
          multi('wb_help', 'کدام حمایت برای شما مفیدتر است؟', [
            'ساعت کاری منعطف',
            'دورکاری',
            'مشاوره‌ی روان‌شناسی',
            'فعالیت ورزشی',
            'جلسه‌ی کمتر',
            'سایر',
          ]),
          longText('wb_note', 'حرف دیگری دارید؟'),
        ],
      },
    ],
    indexes: [
      starIndex('wellbeing', 'شاخص رفاه کارکنان', [
        'wb_energy',
        'wb_load',
        'wb_support',
        'wb_balance',
        'wb_safety',
      ]),
    ],
    startText:
      'این نظرسنجی ناشناس است؛ نه نام شما پرسیده می‌شود و نه پاسخ‌ها به فرد خاصی مربوط می‌شوند.',
  },
  {
    key: 'leave-request',
    title: 'درخواست مرخصی',
    summary:
      'نوع مرخصی، بازه‌ی تاریخ، تعداد ساعت برای مرخصی ساعتی، علت و جانشین؛ جایگزین فرم کاغذی.',
    category: 'منابع انسانی',
    icon: '🗓',
    theme: 'khakestar',
    oneAtATime: false,
    pages: [
      {
        id: 'p1',
        title: 'درخواست مرخصی',
        questions: [
          text('lr_name', 'نام و نام خانوادگی', true),
          text('lr_unit', 'واحد سازمانی', true),
          single('lr_type', 'نوع مرخصی', [
            'استحقاقی (روزانه)',
            'ساعتی',
            'استعلاجی',
            'بدون حقوق',
          ]),
          date('lr_from', 'از تاریخ', true),
          date('lr_to', 'تا تاریخ', true),
          {
            ...number('lr_hours', 'تعداد ساعت', 1, 8, true),
            showWhen: is('lr_type', 'ساعتی'),
          },
          longText('lr_reason', 'توضیحات'),
          text('lr_substitute', 'جانشین در زمان مرخصی'),
        ],
      },
    ],
    endText: 'درخواست شما ثبت شد و برای تایید مدیر ارسال می‌شود.',
  },
  {
    key: 'it-helpdesk',
    title: 'رضایت از پشتیبانی فناوری اطلاعات',
    summary:
      'موضوع درخواست، حل شدن مشکل، سرعت، کیفیت راه‌حل و توضیح کارشناس؛ برای واحد IT داخلی.',
    category: 'منابع انسانی',
    icon: '🛠',
    theme: 'shab',
    pages: [
      {
        id: 'p1',
        title: 'درخواست شما',
        questions: [
          list('ih_topic', 'موضوع درخواست', [
            'رایانه و سخت‌افزار',
            'نرم‌افزار',
            'شبکه و اینترنت',
            'ایمیل و حساب کاربری',
            'چاپگر',
            'سایر',
          ]),
          yesNo('ih_resolved', 'مشکل شما حل شد؟'),
          {
            ...longText('ih_open', 'چه چیزی هنوز حل نشده است؟'),
            showWhen: is('ih_resolved', false),
          },
          stars('ih_speed', 'سرعت رسیدگی'),
          stars('ih_quality', 'کیفیت راه‌حل'),
          stars('ih_comm', 'توضیح و برخورد کارشناس'),
        ],
      },
    ],
    indexes: [
      starIndex('it', 'رضایت از پشتیبانی IT', [
        'ih_speed',
        'ih_quality',
        'ih_comm',
      ]),
    ],
  },

  // ── بازاریابی و پژوهش بازار ──
  {
    key: 'market-research',
    title: 'پژوهش بازار و شناخت مشتری',
    summary:
      'ویژگی‌های جمعیتی، دفعات خرید، عوامل مهم در تصمیم، کانال خرید و بودجه؛ برای ورود به بازار یا محصول تازه.',
    category: 'بازاریابی و پژوهش بازار',
    icon: '🔍',
    theme: 'abrang',
    pages: [
      {
        id: 'p1',
        title: 'درباره‌ی شما',
        questions: [
          list('mr_age', 'گروه سنی', [
            'زیر ۱۸',
            '۱۸ تا ۲۴',
            '۲۵ تا ۳۴',
            '۳۵ تا ۴۴',
            '۴۵ تا ۵۴',
            '۵۵ و بالاتر',
          ]),
          single(
            'mr_gender',
            'جنسیت',
            ['زن', 'مرد', 'ترجیح می‌دهم نگویم'],
            false,
          ),
          text('mr_city', 'شهر'),
        ],
      },
      {
        id: 'p2',
        title: 'عادت‌های خرید',
        questions: [
          single('mr_freq', 'هر چند وقت یک‌بار این نوع محصول را می‌خرید؟', [
            'هر هفته',
            'هر ماه',
            'چند بار در سال',
            'به‌ندرت',
          ]),
          {
            id: 'mr_factors',
            type: 'ranking',
            title: 'هنگام خرید چه چیزهایی برایتان مهم‌تر است؟ (مرتب کنید)',
            required: false,
            options: [
              'قیمت',
              'کیفیت',
              'برند',
              'خدمات پس از فروش',
              'در دسترس بودن',
            ],
          },
          multi('mr_channel', 'معمولا از کجا خرید می‌کنید؟', [
            'فروشگاه حضوری',
            'فروشگاه اینترنتی',
            'شبکه‌های اجتماعی',
            'بازار و پاساژ',
          ]),
          {
            id: 'mr_budget',
            type: 'slider',
            title: 'حداکثر مبلغی که برای این محصول می‌پردازید (هزار تومان)',
            required: false,
            meta: { min: 0, max: 5000, step: 100 },
          },
          longText('mr_wish', 'محصول ایده‌آل شما چه ویژگی‌ای دارد؟'),
        ],
      },
    ],
  },
  {
    key: 'brand-awareness',
    title: 'آگاهی و تصویر برند',
    summary:
      'آیا ما را می‌شناسند، از کجا، چه تصویری از ما دارند و چقدر احتمال دارد امتحانمان کنند.',
    category: 'بازاریابی و پژوهش بازار',
    icon: '📣',
    theme: 'makhmal',
    pages: [
      {
        id: 'p1',
        title: 'شناخت برند',
        questions: [
          yesNo('ba_known', 'پیش از این نام ما را شنیده بودید؟'),
          {
            ...multi('ba_where', 'کجا با ما آشنا شدید؟', [
              'شبکه‌های اجتماعی',
              'تبلیغات شهری',
              'دوستان و آشنایان',
              'جستجو در اینترنت',
              'رادیو و تلویزیون',
              'فروشگاه‌ها',
            ]),
            showWhen: is('ba_known', true),
          },
          multi('ba_image', 'کدام صفت‌ها به نظرتان درباره‌ی ما درست است؟', [
            'قابل اعتماد',
            'باکیفیت',
            'گران',
            'نوآور',
            'در دسترس',
            'قدیمی',
          ]),
          scale10('ba_try', 'چقدر احتمال دارد محصول ما را امتحان کنید؟', {
            start: 'اصلاً',
            end: 'حتماً',
          }),
          text('ba_competitor', 'در این زمینه چه برندی اول به ذهنتان می‌رسد؟'),
        ],
      },
    ],
    indexes: [
      {
        id: 'intent',
        key: 'تمایل به خرید',
        maxScore: 10,
        questionIds: ['ba_try'],
      },
    ],
  },
  {
    key: 'lead-capture',
    title: 'درخواست مشاوره و خرید',
    summary:
      'جذب مشتری بالقوه از سایت، نمایشگاه یا کمپین: نام، شرکت، تماس، نیاز، بودجه و زمان تماس.',
    category: 'بازاریابی و پژوهش بازار',
    icon: '🤝',
    theme: 'kuh',
    oneAtATime: false,
    pages: [
      {
        id: 'p1',
        title: 'درخواست مشاوره',
        questions: [
          text('lc_name', 'نام و نام خانوادگی', true),
          text('lc_company', 'نام شرکت یا سازمان'),
          mobile('lc_mobile'),
          email('lc_email'),
          list('lc_interest', 'به کدام خدمت علاقه دارید؟', [
            'محصول الف',
            'محصول ب',
            'خدمات مشاوره',
            'هنوز نمی‌دانم',
          ]),
          list(
            'lc_budget',
            'بودجه‌ی تقریبی',
            [
              'کمتر از ۵۰ میلیون تومان',
              '۵۰ تا ۲۰۰ میلیون تومان',
              'بیش از ۲۰۰ میلیون تومان',
              'مشخص نیست',
            ],
            false,
          ),
          single('lc_time', 'بهترین زمان تماس', ['صبح', 'ظهر', 'عصر']),
          longText('lc_need', 'نیازتان را کوتاه توضیح دهید'),
        ],
      },
    ],
    endText:
      'درخواست شما ثبت شد. کارشناسان ما در زمان انتخابی با شما تماس می‌گیرند.',
  },

  // ── رویداد ──
  {
    key: 'event-registration',
    title: 'ثبت‌نام رویداد و همایش',
    summary:
      'اطلاعات شرکت‌کننده، نحوه‌ی حضور، نشست‌ها و غذا؛ سوال غذا فقط برای حضوری‌ها پرسیده می‌شود.',
    category: 'رویداد',
    icon: '🎟',
    theme: 'kahkeshan',
    oneAtATime: false,
    pages: [
      {
        id: 'p1',
        title: 'ثبت‌نام',
        questions: [
          text('er_name', 'نام و نام خانوادگی', true),
          mobile('er_mobile'),
          email('er_email', 'ایمیل', true),
          text('er_org', 'سازمان یا شرکت'),
          single('er_attend', 'نحوه‌ی حضور', ['حضوری', 'آنلاین']),
          multi('er_sessions', 'در کدام بخش‌ها شرکت می‌کنید؟', [
            'نشست صبح',
            'کارگاه تخصصی',
            'پنل گفتگو',
            'نشست عصر',
          ]),
          {
            ...single('er_food', 'نوع غذا', ['معمولی', 'گیاهی']),
            showWhen: is('er_attend', 'حضوری'),
          },
          longText('er_needs', 'نیاز خاصی دارید؟ (دسترسی، مترجم و…)'),
        ],
      },
    ],
    endText:
      'ثبت‌نام شما انجام شد. جزئیات رویداد به‌زودی برایتان ارسال می‌شود.',
  },

  // ── خدمات عمومی و شهری ──
  {
    key: 'citizen-satisfaction',
    title: 'سنجش رضایت ارباب رجوع',
    summary:
      'نوع خدمت، تعداد مراجعه، امکان انجام غیرحضوری، برخورد کارکنان، روشنی مراحل و زمان انجام کار.',
    category: 'خدمات عمومی و شهری',
    icon: '🏛',
    theme: 'sakhteman',
    pages: [
      {
        id: 'p1',
        title: 'مراجعه‌ی شما',
        questions: [
          list('gs_service', 'خدمتی که دریافت کردید', [
            'صدور مجوز یا پروانه',
            'پاسخ به استعلام',
            'پرداخت عوارض',
            'ثبت درخواست',
            'پیگیری پرونده',
            'سایر',
          ]),
          single('gs_visits', 'برای این کار چند بار مراجعه کردید؟', [
            'یک بار',
            'دو بار',
            'سه بار یا بیشتر',
          ]),
          single(
            'gs_online',
            'امکان انجام این کار به‌صورت غیرحضوری وجود داشت؟',
            ['بله و استفاده کردم', 'بله ولی استفاده نکردم', 'خیر', 'نمی‌دانم'],
          ),
          stars('gs_staff', 'برخورد و پاسخگویی کارکنان'),
          stars('gs_clarity', 'روشن بودن مراحل و مدارک لازم'),
          stars('gs_time', 'زمان انجام کار'),
          stars('gs_place', 'فضای محل مراجعه'),
          yesNo('gs_done', 'کار شما انجام شد؟'),
          {
            ...longText('gs_block', 'چه مانعی وجود داشت؟'),
            showWhen: is('gs_done', false),
          },
          longText('gs_suggest', 'پیشنهاد شما برای بهبود'),
        ],
      },
    ],
    indexes: [
      starIndex('citizen', 'رضایت ارباب رجوع', [
        'gs_staff',
        'gs_clarity',
        'gs_time',
        'gs_place',
      ]),
    ],
  },
  {
    key: 'city-report',
    title: 'گزارش مشکل شهری',
    summary:
      'شهروند نوع مشکل، موقعیت دقیق روی نقشه، عکس و توضیح را می‌فرستد؛ برای شهرداری و مدیریت شهرک.',
    category: 'خدمات عمومی و شهری',
    icon: '📍',
    theme: 'sakhteman',
    oneAtATime: false,
    pages: [
      {
        id: 'p1',
        title: 'گزارش مشکل',
        questions: [
          list('cy_type', 'نوع مشکل', [
            'آسفالت و معابر',
            'روشنایی',
            'پسماند و نظافت',
            'فضای سبز',
            'آب‌گرفتگی',
            'سد معبر',
            'سایر',
          ]),
          {
            id: 'cy_location',
            type: 'location',
            title: 'محل دقیق',
            required: true,
          },
          {
            id: 'cy_photo',
            type: 'camera',
            title: 'عکس از محل',
            required: false,
          },
          longText('cy_desc', 'توضیح مشکل', true),
          mobile('cy_mobile', 'شماره‌ی تماس برای پیگیری (اختیاری)', false),
        ],
      },
    ],
    endText: 'گزارش شما ثبت شد. از همکاری شما برای شهری بهتر سپاسگزاریم.',
  },

  // ── ساختمان و املاک ──
  {
    key: 'residents-survey',
    title: 'نظرسنجی ساکنان مجتمع',
    summary:
      'نظافت مشاعات، نگهبانی، تعمیر و نگهداری، مدیریت و شفافیت شارژ؛ و اولویت هزینه‌کرد سال آینده.',
    category: 'ساختمان و املاک',
    icon: '🏢',
    theme: 'sakhteman',
    pages: [
      {
        id: 'p1',
        title: 'نظر شما',
        questions: [
          text('rv_unit', 'شماره‌ی واحد (اختیاری)'),
          stars('rv_clean', 'نظافت مشاعات'),
          stars('rv_security', 'نگهبانی و امنیت'),
          stars('rv_maint', 'تعمیر و نگهداری (آسانسور، تاسیسات)'),
          stars('rv_mgmt', 'عملکرد مدیریت ساختمان'),
          whyLow(
            'rv_mgmt',
            'rv_mgmt_why',
            'چه انتظاری از مدیریت برآورده نشده است؟',
          ),
          stars('rv_fee', 'شفافیت هزینه‌ها و شارژ'),
          {
            id: 'rv_priority',
            type: 'ranking',
            title: 'اولویت هزینه‌کرد سال آینده را مرتب کنید',
            required: false,
            options: [
              'نوسازی آسانسور',
              'دوربین و امنیت',
              'نما و فضای سبز',
              'پارکینگ',
              'تاسیسات گرمایش و سرمایش',
            ],
          },
          longText('rv_note', 'پیشنهاد دیگری دارید؟'),
        ],
      },
    ],
    indexes: [
      starIndex('building', 'رضایت ساکنان', [
        'rv_clean',
        'rv_security',
        'rv_maint',
        'rv_mgmt',
        'rv_fee',
      ]),
    ],
  },

  // ── حمل‌ونقل و خودرو ──
  {
    key: 'car-service',
    title: 'رضایت از خدمات پس از فروش خودرو',
    summary:
      'پذیرش، کیفیت تعمیر، تحویل به‌موقع، شفافیت هزینه و رفع کامل ایراد؛ برای نمایندگی و تعمیرگاه.',
    category: 'حمل‌ونقل و خودرو',
    icon: '🚗',
    theme: 'tanha',
    pages: [
      {
        id: 'p1',
        title: 'مراجعه‌ی شما',
        questions: [
          list('ac_service', 'نوع خدمت', [
            'سرویس دوره‌ای',
            'تعمیر مکانیکی',
            'برق خودرو',
            'صافکاری و نقاشی',
            'گارانتی',
          ]),
          stars('ac_reception', 'پذیرش و راهنمایی'),
          stars('ac_quality', 'کیفیت تعمیر'),
          stars('ac_time', 'تحویل به‌موقع'),
          stars('ac_price', 'شفافیت و تناسب هزینه‌ها'),
          yesNo('ac_fixed', 'ایراد خودرو کاملا رفع شد؟'),
          {
            ...longText('ac_open', 'چه ایرادی باقی مانده است؟'),
            showWhen: is('ac_fixed', false),
          },
          nps(
            'ac_nps',
            'چقدر احتمال دارد این تعمیرگاه را به دیگران معرفی کنید؟',
          ),
        ],
      },
    ],
    indexes: [
      starIndex('service', 'رضایت از خدمات', [
        'ac_reception',
        'ac_quality',
        'ac_time',
        'ac_price',
      ]),
    ],
  },
  {
    key: 'trip-feedback',
    title: 'ارزیابی سفر و راننده',
    summary:
      'وقت‌شناسی، رفتار راننده، ایمنی رانندگی و تمیزی وسیله؛ برای ناوگان، سرویس سازمانی و تاکسی.',
    category: 'حمل‌ونقل و خودرو',
    icon: '🚌',
    theme: 'aftab',
    pages: [
      {
        id: 'p1',
        title: 'سفر شما',
        questions: [
          single('tr_mode', 'وسیله‌ی سفر', [
            'اتوبوس',
            'تاکسی اینترنتی',
            'سرویس سازمانی',
            'قطار',
          ]),
          stars('tr_punct', 'به‌موقع بودن'),
          stars('tr_driver', 'رفتار راننده'),
          stars('tr_safety', 'احساس امنیت در رانندگی'),
          whyLow('tr_safety', 'tr_safety_why', 'چه چیزی باعث احساس ناامنی شد؟'),
          stars('tr_clean', 'تمیزی و راحتی وسیله'),
          longText('tr_note', 'نکته‌ی دیگری دارید؟'),
        ],
      },
    ],
    indexes: [
      starIndex('trip', 'رضایت از سفر', [
        'tr_punct',
        'tr_driver',
        'tr_safety',
        'tr_clean',
      ]),
    ],
  },

  // ── ورزش و تندرستی ──
  {
    key: 'gym-members',
    title: 'رضایت اعضای باشگاه ورزشی',
    summary:
      'مربیان، تجهیزات، نظافت، شلوغی و شهریه، کلاس‌های پیشنهادی و تمدید عضویت با علت عدم تمدید.',
    category: 'ورزش و تندرستی',
    icon: '🏋',
    theme: 'jangal',
    pages: [
      {
        id: 'p1',
        title: 'نظر شما',
        questions: [
          list('gm_tenure', 'مدت عضویت', [
            'کمتر از ۳ ماه',
            '۳ ماه تا یک سال',
            'بیش از یک سال',
          ]),
          stars('gm_coach', 'مربیان'),
          stars('gm_equipment', 'تجهیزات و دستگاه‌ها'),
          stars('gm_clean', 'نظافت رختکن و سالن'),
          stars('gm_crowd', 'شلوغی و دسترسی به دستگاه‌ها'),
          stars('gm_price', 'تناسب شهریه با خدمات'),
          multi('gm_classes', 'کدام کلاس‌ها را اضافه کنیم؟', [
            'یوگا',
            'پیلاتس',
            'کراس‌فیت',
            'ایروبیک',
            'شنا',
            'رزمی',
          ]),
          yesNo('gm_renew', 'عضویتتان را تمدید می‌کنید؟'),
          {
            ...longText('gm_why', 'چرا تمدید نمی‌کنید؟'),
            showWhen: is('gm_renew', false),
          },
        ],
      },
    ],
    indexes: [
      starIndex('gym', 'رضایت اعضا', [
        'gm_coach',
        'gm_equipment',
        'gm_clean',
        'gm_crowd',
        'gm_price',
      ]),
    ],
  },
  // ── عملیات هتل (فرم‌های داخلیِ بخش‌ها) ──
  /*
   * این دسته با بقیه فرق دارد: مخاطبش مهمان نیست، کارمند است. پس نه امتیاز
   * رضایت دارد نه NPS؛ چیزی که مهم است ثبتِ «چه کاری، کجا، توسط چه کسی، با
   * چه قطعه‌ای» است تا سابقه بماند و مدیر بتواند بررسی کند. همه هم
   * `oneAtATime: false` دارند چون کارمند فرم را سرِ کار پر می‌کند و دیدن
   * همه‌ی فیلدها با هم سریع‌تر است تا یک‌سوال‌در‌یک‌صفحه.
   */
  {
    key: 'ops-technical-daily',
    title: 'چک‌لیست روزانه‌ی تأسیسات (واحد فنی)',
    summary:
      'بازدید روزانه‌ی موتورخانه، چیلر، دیگ، ژنراتور و پمپ‌ها؛ هر مورد سالم/معیوب با توضیح خرابی.',
    category: 'عملیات هتل',
    icon: '🔧',
    theme: 'mohandes',
    oneAtATime: false,
    endText: 'چک‌لیست ثبت شد.',
    pages: [
      {
        id: 'p1',
        title: 'بازدید روزانه',
        questions: [
          date('td_date', 'تاریخ بازدید', true),
          list('td_shift', 'شیفت', ['صبح', 'عصر', 'شب']),
          text('td_by', 'نام تکنسین', true),
          yesNo('td_boiler', 'دیگ و موتورخانه سالم است؟'),
          { ...longText('td_boiler_note', 'شرح ایراد دیگ/موتورخانه'), showWhen: is('td_boiler', false) },
          yesNo('td_chiller', 'چیلر و هواساز سالم است؟'),
          { ...longText('td_chiller_note', 'شرح ایراد چیلر/هواساز'), showWhen: is('td_chiller', false) },
          yesNo('td_generator', 'ژنراتور اضطراری سالم است؟'),
          { ...longText('td_generator_note', 'شرح ایراد ژنراتور'), showWhen: is('td_generator', false) },
          yesNo('td_pumps', 'پمپ‌های آب و آتش‌نشانی سالم‌اند؟'),
          { ...longText('td_pumps_note', 'شرح ایراد پمپ‌ها'), showWhen: is('td_pumps', false) },
          yesNo('td_elevator', 'آسانسورها سالم‌اند؟'),
          { ...longText('td_elevator_note', 'شرح ایراد آسانسور'), showWhen: is('td_elevator', false) },
          longText('td_extra', 'توضیحات تکمیلی'),
          file('td_photo', 'عکس (در صورت خرابی)'),
        ],
      },
    ],
  },

  {
    key: 'ops-housekeeping-room',
    title: 'چک‌لیست آماده‌سازی اتاق (خانه‌داری)',
    summary:
      'کنترل نظافت و تجهیزات اتاق پیش از تحویل به مهمان: ملحفه، سرویس بهداشتی، مینی‌بار و اقلام مصرفی.',
    category: 'عملیات هتل',
    icon: '🛏️',
    theme: 'barf',
    oneAtATime: false,
    endText: 'اتاق ثبت شد.',
    pages: [
      {
        id: 'p1',
        title: 'آماده‌سازی اتاق',
        questions: [
          text('hr_room', 'شماره اتاق', true),
          number('hr_floor', 'طبقه', 1, 16, true),
          date('hr_date', 'تاریخ', true),
          text('hr_by', 'نام سرویس‌کار', true),
          yesNo('hr_linen', 'ملحفه و حوله تعویض شد؟'),
          yesNo('hr_bath', 'سرویس بهداشتی نظافت شد؟'),
          yesNo('hr_amenities', 'اقلام مصرفی (شامپو، صابون، دمپایی) تکمیل شد؟'),
          yesNo('hr_minibar', 'مینی‌بار کنترل و تکمیل شد؟'),
          yesNo('hr_tech', 'تلویزیون، کولر و روشنایی سالم‌اند؟'),
          {
            ...longText('hr_tech_note', 'چه چیزی خراب است؟ (به واحد فنی ارجاع می‌شود)'),
            showWhen: is('hr_tech', false),
          },
          multi('hr_missing', 'کمبود یا خرابی مشاهده‌شده', [
            'ملحفه/حوله',
            'اقلام مصرفی',
            'لوازم برقی',
            'مبلمان',
            'لوله‌کشی',
            'سایر',
          ]),
          longText('hr_note', 'توضیحات'),
        ],
      },
    ],
  },

  {
    key: 'ops-it-incident',
    title: 'ثبت خرابی و درخواست فناوری اطلاعات',
    summary:
      'ثبت مشکل شبکه، سیستم، دوربین یا نرم‌افزار هتل همراه با محل، فوریت و شرح مشکل.',
    category: 'عملیات هتل',
    icon: '💻',
    theme: 'aseman',
    oneAtATime: false,
    endText: 'درخواست ثبت شد؛ واحد IT پیگیری می‌کند.',
    pages: [
      {
        id: 'p1',
        title: 'مشخصات مشکل',
        questions: [
          text('it_by', 'نام درخواست‌کننده', true),
          list('it_area', 'محل مشکل', [
            'پذیرش',
            'اتاق مهمان',
            'رستوران',
            'اداری',
            'موتورخانه/فنی',
            'سایر',
          ]),
          text('it_place', 'شماره اتاق یا نام دقیق محل'),
          list('it_kind', 'نوع مشکل', [
            'شبکه و اینترنت',
            'کامپیوتر و چاپگر',
            'نرم‌افزار هتلداری (PMS)',
            'دوربین مداربسته',
            'تلفن',
            'قفل الکترونیکی اتاق',
            'سایر',
          ]),
          list('it_priority', 'فوریت', ['عادی', 'فوری', 'اضطراری']),
          longText('it_desc', 'شرح مشکل', true),
          yesNo('it_blocking', 'کار را کاملاً متوقف کرده است؟'),
          file('it_photo', 'عکس یا تصویر خطا'),
        ],
      },
    ],
  },

  {
    key: 'ops-contractor-visit',
    title: 'ثبت کار پیمانکار',
    summary:
      'ثبت ورود و خروج پیمانکار، کار انجام‌شده، قطعات مصرفی و تأیید سرپرست؛ برای نگهداری سوابق پیمانکاران.',
    category: 'عملیات هتل',
    icon: '👷',
    theme: 'sakhteman',
    oneAtATime: false,
    endText: 'کار پیمانکار ثبت شد.',
    pages: [
      {
        id: 'p1',
        title: 'مشخصات پیمانکار و کار',
        questions: [
          text('cv_company', 'نام شرکت/پیمانکار', true),
          text('cv_person', 'نام فرد حاضر در محل', true),
          mobile('cv_mobile', 'شماره تماس', false),
          date('cv_date', 'تاریخ', true),
          text('cv_in', 'ساعت ورود'),
          text('cv_out', 'ساعت خروج'),
          list('cv_field', 'حوزه‌ی کار', [
            'برق',
            'تأسیسات و لوله‌کشی',
            'آسانسور',
            'تهویه و چیلر',
            'ساختمان و نازک‌کاری',
            'شبکه و دوربین',
            'سایر',
          ]),
          text('cv_place', 'محل کار (اتاق/طبقه/بخش)', true),
          longText('cv_work', 'شرح کار انجام‌شده', true),
          longText('cv_parts', 'قطعات و مصالح مصرفی'),
          number('cv_cost', 'هزینه (تومان)', 0, 1000000000),
          list('cv_status', 'وضعیت کار', [
            'تمام شد',
            'ادامه دارد',
            'نیاز به قطعه',
            'نیاز به بازدید مجدد',
          ]),
          text('cv_supervisor', 'تأییدکننده از طرف هتل', true),
          file('cv_doc', 'فاکتور یا عکس کار'),
        ],
      },
    ],
  },

  {
    key: 'ops-hr-request',
    title: 'درخواست پرسنلی (مرخصی، مأموریت، …)',
    summary:
      'ثبت درخواست مرخصی، مأموریت، اضافه‌کار یا گواهی اشتغال با بازه‌ی زمانی و توضیح.',
    category: 'عملیات هتل',
    icon: '📝',
    theme: 'khakestar',
    oneAtATime: false,
    endText: 'درخواست شما ثبت شد و پس از بررسی اطلاع داده می‌شود.',
    pages: [
      {
        id: 'p1',
        title: 'درخواست',
        questions: [
          text('hq_name', 'نام و نام خانوادگی', true),
          text('hq_unit', 'واحد سازمانی', true),
          mobile('hq_mobile', 'شماره موبایل', true),
          list('hq_kind', 'نوع درخواست', [
            'مرخصی استحقاقی',
            'مرخصی استعلاجی',
            'مرخصی ساعتی',
            'مأموریت',
            'اضافه‌کار',
            'گواهی اشتغال به کار',
            'سایر',
          ]),
          date('hq_from', 'از تاریخ', true),
          date('hq_to', 'تا تاریخ'),
          longText('hq_reason', 'توضیح درخواست', true),
          text('hq_cover', 'جانشین در زمان غیبت'),
          file('hq_doc', 'مدرک پیوست (در صورت نیاز)'),
        ],
      },
    ],
  },
];

/** قالب‌های صنفی، ساخته و آماده برای فهرست قالب‌های سامانه. */
export const SECTOR_TEMPLATES: FormTemplate[] = TEMPLATES.map(build);
