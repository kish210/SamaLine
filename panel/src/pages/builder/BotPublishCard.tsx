import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, formsApi } from '../../api';

interface Props {
  formId: string;
  settings: Record<string, unknown>;
  /** فرم لینکِ منتشرشده دارد؟ بدون آن، ربات لینکی برای پرسنل نمی‌سازد. */
  hasPublication: boolean;
}

/**
 * انتشارِ فرم در رباتِ پرسنلی.
 *
 * با روشن‌کردنِ این گزینه، فرم در بخشِ «📝 فرم‌ها»ی رباتِ بله برای پرسنلِ
 * همین سازمان (و اگر فرم بخش دارد، همان بخش) دیده می‌شود و با مینی‌اپ باز
 * می‌شود؛ پرسنل بدونِ ورودِ دوباره آن را پر می‌کند و پاسخش به‌نامِ خودش در
 * «درخواست‌های من» و گردش‌کار می‌نشیند.
 */
export function BotPublishCard({ formId, settings, hasPublication }: Props) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(settings.botPublish === true);

  const save = useMutation({
    mutationFn: (next: boolean) =>
      formsApi.update(formId, {
        settings: { ...settings, botPublish: next },
      }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
    onError: (err) => setError(describeError(err)),
  });

  return (
    <section className="card">
      <div className="section-head">
        <h3>انتشار در رباتِ پرسنلی</h3>
        {saved && <span className="saved">ذخیره شد</span>}
      </div>

      {error && <p className="error">{error}</p>}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            save.mutate(e.target.checked);
          }}
        />
        این فرم در رباتِ بله برای پرسنل منتشر شود
      </label>

      {!hasPublication && (
        <p className="error">
          این فرم هنوز لینکِ منتشرشده ندارد؛ اول از تبِ «ساخت فرم» دکمه‌ی
          «انتشار لینک» را بزنید تا ربات بتواند لینک بسازد.
        </p>
      )}
      <p className="hint">
        پرسنلی که شماره‌اش در «پرسنل» ثبت و گفتگوی بله‌اش وصل شده باشد، این فرم
        را در «📝 فرم‌ها»ی ربات می‌بیند و با مینی‌اپ پر می‌کند. برای درخواست‌هایی
        که تأیید لازم دارند، در «گردش‌کارِ بین‌واحدی» یا «نیازمندِ تأیید» تنظیمش
        کنید تا نتیجه در «درخواست‌های من» دیده شود.
      </p>
    </section>
  );
}
