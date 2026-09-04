/**
 * آزمون تبدیل تاریخ شمسی — بدون نیاز به هیچ کتابخانه یا ابزار آزمون.
 * اجرا: npm run test:jalali
 */
import {
  gregorianToJalali,
  jalaliToGregorian,
  isoToJalaliText,
  jalaliMonthLength,
  jalaliFirstWeekday,
} from '../src/jalali.ts';

let failures = 0;
const fail = (...args) => {
  failures += 1;
  console.error('✗', ...args);
};

// تاریخ‌های شاخص، از جمله اول فروردین در سال کبیسه و غیرکبیسه.
const cases = [
  ['2026-09-04', '1405/06/13'],
  ['2025-03-21', '1404/01/01'],
  ['2024-03-20', '1403/01/01'],
  ['2026-03-21', '1405/01/01'],
  ['2000-01-01', '1378/10/11'],
  ['2026-12-31', '1405/10/10'],
];
for (const [iso, want] of cases) {
  const got = isoToJalaliText(iso);
  if (got !== want) fail(iso, 'داد', got, 'انتظار', want);
}

// رفت‌وبرگشت کامل روی ۴۱ سال شمسی.
let checked = 0;
for (let jy = 1370; jy <= 1410; jy += 1) {
  for (let jm = 1; jm <= 12; jm += 1) {
    for (let jd = 1; jd <= jalaliMonthLength(jy, jm); jd += 1) {
      const g = jalaliToGregorian(jy, jm, jd);
      const back = gregorianToJalali(g.gy, g.gm, g.gd);
      checked += 1;
      if (back.jy !== jy || back.jm !== jm || back.jd !== jd) {
        fail('رفت‌وبرگشت', `${jy}/${jm}/${jd}`, '→', JSON.stringify(back));
        if (failures > 5) process.exit(1);
      }
    }
  }
}

// ۱۴۰۳ کبیسه است (اسفند ۳۰ روز) و ۱۴۰۴ نیست.
if (jalaliMonthLength(1403, 12) !== 30) fail('اسفند ۱۴۰۳ باید ۳۰ روز باشد');
if (jalaliMonthLength(1404, 12) !== 29) fail('اسفند ۱۴۰۴ باید ۲۹ روز باشد');
// ۱۴۰۵/۰۶/۰۱ برابر ۲۰۲۶-۰۸-۲۳ و یکشنبه است (اندیس ۱ از شنبه).
if (jalaliFirstWeekday(1405, 6) !== 1) fail('روز هفته‌ی ۱۴۰۵/۰۶/۰۱');

if (failures) {
  console.error(`${failures} خطا`);
  process.exit(1);
}
console.log(`✓ تبدیل تاریخ سالم است (${checked} تاریخ بررسی شد)`);
