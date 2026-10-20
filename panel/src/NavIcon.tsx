/**
 * آیکن آیتم‌های سایدبار.
 *
 * SVG درون‌خطی است تا هیچ فونت آیکون یا درخواست شبکه‌ای لازم نباشد و رنگ
 * از رنگ متن آیتم بیاید. نمادهای تک‌کاراکتری یونیکد جایگزین شدند چون در
 * ۲۴px خوانا نبودند و در هر سیستم‌عامل شکل دیگری می‌گرفتند.
 */
const PATHS: Record<string, string> = {
  forms: "M6 3h9l5 5v13H6z M15 3v5h5 M9 12h7 M9 16h7",
  dashboards: "M3 3h8v7H3z M13 3h8v4h-8z M13 10h8v11h-8z M3 13h8v8H3z",
  contacts:
    "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M2 21a7 7 0 0114 0 M17 7a2.5 2.5 0 010 5 M18 21a6 6 0 00-2-4.5",
  crm: "M4 8h13 M13 4l4 4-4 4 M20 16H7 M11 12l-4 4 4 4",
  campaigns: "M2 5h20v14H2z M2 6l10 7 10-7",
  ai: "M12 3l2.1 5.1L19 10l-4.9 1.9L12 17l-2.1-5.1L5 10l4.9-1.9z M18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9z",
  portal: "M4 4h16v4H4z M4 11h16v4H4z M4 18h16v3H4z",
  menu: "M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5",
  settings:
    "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1A1.7 1.7 0 004 19.5l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 13.6H3a2 2 0 110-4h.1A1.7 1.7 0 004.5 6.6l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9.4a1.7 1.7 0 001-1.5V2a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H22a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  platform: "M12 2l8 4v6c0 5-3.4 9.2-8 10-4.6-.8-8-5-8-10V6z M9 12l2 2 4-4",
};

export function NavIcon({ name }: { name: string }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path.split(" M").map((segment, index) => (
        <path key={index} d={index === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}
