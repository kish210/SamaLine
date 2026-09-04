interface Props {
  languages: string[];
  value: string;
  onChange: (lang: string) => void;
}

/** نام بومی هر زبان؛ کد خام («fa») برای پاسخ‌دهنده معنایی ندارد. */
const LANGUAGE_NAMES: Record<string, string> = {
  fa: 'فارسی',
  en: 'English',
  ar: 'العربية',
  tr: 'Türkçe',
  ku: 'کوردی',
  ru: 'Русский',
  fr: 'Français',
  de: 'Deutsch',
  zh: '中文',
  es: 'Español',
};

function displayName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

/**
 * انتخاب زبان با دکمه‌های کنار هم.
 *
 * لیست بازشو برای دو یا سه زبان انتخاب مناسبی نیست: گزینه‌ها پیش از باز
 * کردن دیده نمی‌شوند و یک ضربه‌ی اضافه می‌خواهد. وقتی فرم تک‌زبانه است،
 * اصلا چیزی نشان داده نمی‌شود.
 */
export function LanguagePicker({ languages, value, onChange }: Props) {
  if (languages.length < 2) return null;

  return (
    <div className="language-picker" role="group" aria-label="انتخاب زبان">
      {languages.map((code) => (
        <button
          key={code}
          type="button"
          className={code === value ? 'lang-chip active' : 'lang-chip'}
          aria-pressed={code === value}
          onClick={() => onChange(code)}
        >
          {displayName(code)}
        </button>
      ))}
    </div>
  );
}
