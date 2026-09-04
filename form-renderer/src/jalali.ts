/**
 * تبدیل تاریخ میلادی و شمسی، بدون هیچ وابستگی بیرونی.
 *
 * مقدار سوال تاریخ همچنان میلادی (`YYYY-MM-DD`) ذخیره می‌شود تا بک‌اند و
 * خروجی اکسل تغییری نکنند؛ فقط چیزی که پاسخ‌دهنده می‌بیند شمسی است.
 *
 * الگوریتم بر پایه‌ی تبدیل به «روز جولیَن» است و برای بازه‌ی ۱۱۷۸ تا ۱۶۳۳
 * شمسی دقیق است.
 */

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/** شنبه تا جمعه؛ ترتیب ستون‌های تقویم. */
export const JALALI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/**
 * تقسیم صحیح با قطع به‌سمت صفر.
 *
 * الگوریتم مرجع تبدیل تقویم بر پایه‌ی تقسیم صحیح زبان C نوشته شده که به‌سمت
 * صفر قطع می‌کند؛ Math.floor برای عدد منفی یک واحد کمتر می‌دهد و همان یک
 * واحد، نتیجه را یک سال جابه‌جا می‌کند (مثلاً div(-5, 6) در ماه‌های ابتدای
 * سال میلادی).
 */
function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** باقیمانده‌ی متناظر با همان تقسیم. */
function mod(a: number, b: number): number {
  return a - div(a, b) * b;
}

/** شماره‌ی روز جولین برای یک تاریخ میلادی. */
function gregorianToJdn(gy: number, gm: number, gd: number): number {
  const d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}

function jdnToGregorian(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

/** سال شمسی: تعداد روزهای گذشته و آغاز سال. */
function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 1701, 1866,
    2020, 2317, 2394, 2456, 3178,
  ];
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];

  let jump = 0;
  for (let i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  const leap = mod(mod(n + 1, 33) - 1, 4);

  return { leap, gy, march };
}

export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number,
): { gy: number; gm: number; gd: number } {
  const r = jalCal(jy);
  const jdn =
    gregorianToJdn(r.gy, 3, r.march) +
    (jm - 1) * 31 -
    div(jm, 7) * (jm - 7) +
    jd -
    1;
  return jdnToGregorian(jdn);
}

export function gregorianToJalali(
  gy: number,
  gm: number,
  gd: number,
): JalaliDate {
  const jdn = gregorianToJdn(gy, gm, gd);
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = gregorianToJdn(r.gy, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }

  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

/** تعداد روزهای یک ماه شمسی. */
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // در خروجی jalCal، مقدار leap برابر صفر یعنی خودِ این سال کبیسه است.
  return jalCal(jy).leap === 0 ? 30 : 29;
}

/** روز هفته‌ی اول ماه شمسی؛ ۰ = شنبه. */
export function jalaliFirstWeekday(jy: number, jm: number): number {
  const g = jalaliToGregorian(jy, jm, 1);
  const date = new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
  // getUTCDay: ۰ = یکشنبه؛ در تقویم ایرانی هفته از شنبه شروع می‌شود.
  return mod(date.getUTCDay() + 1, 7);
}

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD` میلادی → `۱۴۰۴/۰۶/۱۳` شمسی. */
export function isoToJalaliText(iso: string): string {
  const parsed = parseIso(iso);
  if (!parsed) return '';
  const j = gregorianToJalali(parsed.gy, parsed.gm, parsed.gd);
  return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
}

export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const g = jalaliToGregorian(jy, jm, jd);
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}

export function parseIso(
  iso: string,
): { gy: number; gm: number; gd: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return null;
  return {
    gy: Number(match[1]),
    gm: Number(match[2]),
    gd: Number(match[3]),
  };
}

/** تاریخ امروز به شمسی. */
export function todayJalali(): JalaliDate {
  const now = new Date();
  return gregorianToJalali(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
  );
}
