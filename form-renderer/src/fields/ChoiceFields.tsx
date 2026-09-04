interface ChoiceProps {
  options: string[];
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * چهره‌های ایموجی برای سنجش حس.
 *
 * وقتی سوال گزینه‌ی خودش را نداده باشد، از این پنج حالت استاندارد استفاده
 * می‌شود؛ همان چیزی که در نظرسنجی رضایت رایج است.
 */
const DEFAULT_EMOJIS = [
  { value: 'خیلی بد', emoji: '😞' },
  { value: 'بد', emoji: '🙁' },
  { value: 'معمولی', emoji: '😐' },
  { value: 'خوب', emoji: '🙂' },
  { value: 'عالی', emoji: '😍' },
];

/** آیا این گزینه خودش با ایموجی شروع می‌شود؟ */
function splitEmoji(option: string): { emoji: string; label: string } {
  const match = /^(\p{Extended_Pictographic}️?)\s*(.*)$/u.exec(option);
  return match
    ? { emoji: match[1], label: match[2] }
    : { emoji: '', label: option };
}

export function EmojiChoice({ options, value, onChange }: ChoiceProps) {
  const items =
    options.length > 0
      ? options.map((option) => {
          const { emoji, label } = splitEmoji(option);
          return { value: option, emoji: emoji || '🙂', label };
        })
      : DEFAULT_EMOJIS.map((item) => ({ ...item, label: item.value }));

  const current = value == null ? '' : String(value);

  return (
    <div className="emoji-row" role="radiogroup">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={current === item.value}
          className={current === item.value ? 'emoji-item active' : 'emoji-item'}
          onClick={() => onChange(item.value)}
        >
          <span className="emoji-face">{item.emoji}</span>
          <span className="emoji-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * انتخاب تصویری.
 *
 * قالب هر گزینه `نشانی تصویر|برچسب` است؛ اگر برچسب نبود، خود نشانی برچسب
 * می‌شود. این‌طور نوع سوال بدون تغییر مدل داده کار می‌کند.
 */
export function ImageChoice({ options, value, onChange }: ChoiceProps) {
  const current = value == null ? '' : String(value);

  return (
    <div className="image-choice" role="radiogroup">
      {options.map((option) => {
        const [url, label] = option.split('|');
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={current === option}
            className={current === option ? 'image-card active' : 'image-card'}
            onClick={() => onChange(option)}
          >
            <img src={url} alt="" loading="lazy" />
            <span>{label || url}</span>
          </button>
        );
      })}
    </div>
  );
}

interface RankingProps {
  options: string[];
  value: unknown;
  onChange: (value: string[]) => void;
}

/**
 * اولویت‌بندی با جابه‌جایی.
 *
 * پیش از این یک textarea بود که کاربر باید گزینه‌ها را با ویرگول تایپ
 * می‌کرد؛ عملا هیچ‌کس گزینه‌ها را درست بازتایپ نمی‌کند.
 */
export function Ranking({ options, value, onChange }: RankingProps) {
  // ترتیب فعلی: هرچه انتخاب شده، به‌علاوه‌ی گزینه‌هایی که هنوز نیامده‌اند.
  const chosen = Array.isArray(value) ? (value as string[]) : [];
  const order = [
    ...chosen.filter((item) => options.includes(item)),
    ...options.filter((item) => !chosen.includes(item)),
  ];

  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <ol className="ranking-list">
      {order.map((item, index) => (
        <li key={item}>
          <span className="rank-number">{index + 1}</span>
          <span className="rank-label">{item}</span>
          <span className="rank-actions">
            <button
              type="button"
              aria-label="بالاتر"
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="پایین‌تر"
              disabled={index === order.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}
