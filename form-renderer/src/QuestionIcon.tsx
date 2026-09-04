import { ICON_PATHS } from './question-icons';

/**
 * آیکن کوچک کنار ورودی، بر اساس نوع سوال.
 *
 * آیکن‌ها به‌صورت SVG درون‌خطی‌اند تا هیچ فونت آیکن یا درخواست شبکه‌ای لازم
 * نباشد و رنگشان از رنگ متن فرم بیاید.
 */
export function QuestionIcon({ type }: { type: string }) {
  const path = ICON_PATHS[type];
  if (!path) return null;

  return (
    <svg
      className="field-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path.split(' M').map((segment, index) => (
        <path key={index} d={index === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}
