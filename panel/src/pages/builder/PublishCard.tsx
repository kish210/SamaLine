import { useMemo, useState } from 'react';
import { renderSVG } from 'uqr';

interface Props {
  /** نشانی عمومی فرم. */
  url: string;
  title: string;
}

type Tab = 'link' | 'qr' | 'embed';

/** کپی در کلیپ‌بورد با بازخورد کوتاه. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // در زمینه‌ی ناامن (http بدون گواهی) کلیپ‌بورد در دسترس نیست؛
      // کاربر می‌تواند متن را دستی انتخاب کند، پس خطا نشان نمی‌دهیم.
      setCopied(null);
    }
  };

  return { copied, copy };
}

/**
 * راه‌های انتشار فرم: لینک، QR و جاسازی در سایت.
 *
 * QR سمت مرورگر ساخته می‌شود (uqr، بدون وابستگی) تا نه رفت‌وبرگشتی با سرور
 * لازم باشد و نه نشانی فرم به سرویس بیرونی مثل قبلی‌های تولید QR برود.
 */
export function PublishCard({ url, title }: Props) {
  const [tab, setTab] = useState<Tab>('link');
  const { copied, copy } = useCopy();

  const qrSvg = useMemo(
    () => renderSVG(url, { border: 2, pixelSize: 8 }),
    [url],
  );

  const embedCode = useMemo(
    () =>
      `<iframe src="${url}" title="${title}" width="100%" height="700" style="border:0;max-width:760px" loading="lazy"></iframe>`,
    [url, title],
  );

  /** دانلود QR به‌صورت SVG؛ بدون افت کیفیت در چاپ. */
  const downloadQr = () => {
    const blob = new Blob([qrSvg], { type: 'image/svg+xml' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `qr-${title || 'form'}.svg`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="card publish-card">
      <div className="section-head">
        <h3>انتشار فرم</h3>
        <div className="publish-tabs">
          {(
            [
              ['link', 'لینک'],
              ['qr', 'کد QR'],
              ['embed', 'جاسازی در سایت'],
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={tab === key ? 'active' : ''}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'link' && (
        <div className="publish-body">
          <div className="inline-form">
            <input readOnly dir="ltr" value={url} />
            <button type="button" onClick={() => void copy(url, 'link')}>
              {copied === 'link' ? 'کپی شد' : 'کپی'}
            </button>
            <a
              className="button-like"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              مشاهده
            </a>
          </div>
        </div>
      )}

      {tab === 'qr' && (
        <div className="publish-body qr-body">
          <div
            className="qr-box"
            /* خروجی uqr یک SVG ساخته‌شده از همین داده است، نه ورودی کاربر. */
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="qr-side">
            <p className="hint">
              برای چاپ روی بروشور، میز پذیرش یا استند. خروجی SVG است و در هر
              اندازه‌ای بدون افت کیفیت چاپ می‌شود.
            </p>
            <button type="button" className="secondary" onClick={downloadQr}>
              دانلود SVG
            </button>
          </div>
        </div>
      )}

      {tab === 'embed' && (
        <div className="publish-body">
          <p className="hint">
            این کد را در صفحه‌ی سایتتان بگذارید تا فرم داخل همان صفحه نمایش
            داده شود.
          </p>
          <textarea readOnly dir="ltr" rows={3} value={embedCode} />
          <button type="button" onClick={() => void copy(embedCode, 'embed')}>
            {copied === 'embed' ? 'کپی شد' : 'کپی کد'}
          </button>
        </div>
      )}
    </section>
  );
}
