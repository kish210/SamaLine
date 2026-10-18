import { useMemo, useState } from 'react';
import { renderSVG } from 'uqr';

interface Props {
  /** نشانی عمومی فرم. */
  url: string;
  title: string;
}

type Tab = 'link' | 'qr' | 'embed' | 'kiosk';

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
      `<iframe src="${url}" title="${title.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`)}" width="100%" height="700" style="border:0;max-width:760px" loading="lazy"></iframe>`,
    [url, title],
  );

  /*
   * پاپ‌آپ: یک دکمه‌ی شناور گوشه‌ی سایت مشتری که فرم را در یک لایه باز
   * می‌کند. خودبسنده است (بدون کتابخانه و بدون فایل بیرونی) تا روی هر سایتی
   * با چسباندن همین چند خط کار کند.
   */
  const popupCode = useMemo(() => {
    // `<` گریز داده می‌شود تا عنوانی مثل «</script>» اسکریپت را نشکند.
    const js = (value: string) =>
      JSON.stringify(value).replace(/</g, '\\u003c');
    const safeUrl = js(url);
    const label = js(title ? `نظرسنجی: ${title}` : 'نظرسنجی');
    return `<script>(function(){var u=${safeUrl},l=${label};var b=document.createElement('button');b.textContent=l;b.style.cssText='position:fixed;bottom:20px;left:20px;z-index:99999;padding:12px 18px;border:0;border-radius:24px;background:#324A7A;color:#fff;font:inherit;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)';b.onclick=function(){var o=document.createElement('div');o.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center';var f=document.createElement('iframe');f.src=u;f.title=l;f.style.cssText='width:min(760px,95vw);height:min(720px,90vh);border:0;border-radius:12px;background:#fff';var c=document.createElement('button');c.textContent='×';c.setAttribute('aria-label','بستن');c.style.cssText='position:absolute;top:12px;right:16px;font-size:28px;background:none;border:0;color:#fff;cursor:pointer';c.onclick=function(){o.remove()};o.onclick=function(e){if(e.target===o)o.remove()};o.appendChild(f);o.appendChild(c);document.body.appendChild(o)};document.body.appendChild(b)})();</script>`;
  }, [url, title]);

  // کیوسک همان فرم است با پیشوند /k به‌جای /f.
  const kioskUrl = useMemo(() => url.replace(/\/f\/([^/]+)$/, '/k/$1'), [url]);

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
              ['kiosk', 'کیوسک'],
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

          <p className="hint">
            پاپ‌آپ: یک دکمه‌ی شناور گوشه‌ی سایت که فرم را روی همان صفحه باز
            می‌کند. این کد را پیش از بسته شدن تگ body بگذارید.
          </p>
          <textarea readOnly dir="ltr" rows={3} value={popupCode} />
          <button type="button" onClick={() => void copy(popupCode, 'popup')}>
            {copied === 'popup' ? 'کپی شد' : 'کپی کد پاپ‌آپ'}
          </button>
        </div>
      )}

      {tab === 'kiosk' && (
        <div className="publish-body">
          <p className="hint">
            برای تبلت یا نمایشگر ثابت در لابی و پذیرش. هر نفر فرم خالی می‌بیند،
            پس از ثبت فرم خودکار برای نفر بعد آماده می‌شود و فرم نیمه‌کاره پس
            از دو دقیقه بی‌کاری پاک می‌شود. اگر هنگام ثبت اینترنت قطع باشد، پاسخ
            روی دستگاه می‌ماند و بعدا ارسال می‌شود.
          </p>
          <div className="inline-form">
            <input readOnly dir="ltr" value={kioskUrl} />
            <button type="button" onClick={() => void copy(kioskUrl, 'kiosk')}>
              {copied === 'kiosk' ? 'کپی شد' : 'کپی'}
            </button>
            <a
              className="button-like"
              href={kioskUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              باز کردن
            </a>
          </div>
          <p className="hint">
            تنظیم اختیاری در نشانی: <code dir="ltr">?reset=10</code> ثانیه‌های
            صفحه‌ی تشکر، <code dir="ltr">?idle=180</code> ثانیه‌های بی‌کاری.
            پارامترهای دیگر (مثل <code dir="ltr">?branch=tehran</code>) مثل
            همیشه پارامتر مخفی فرم‌اند.
          </p>
        </div>
      )}
    </section>
  );
}
