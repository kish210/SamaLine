import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { portalApi, type PortalPayload } from './api';
import { PlatformFooter } from './PlatformFooter';

/**
 * صفحه‌ی پرتال: چند فرم روی یک نشانی.
 *
 * برای جایی که یک مجموعه چند نظرسنجی همزمان دارد و نمی‌خواهد چند لینک جدا
 * پخش کند — یک نشانی روی بنر یا QR، و مخاطب خودش انتخاب می‌کند.
 */
export function PortalPage() {
  const { slug = '' } = useParams();
  const [portal, setPortal] = useState<PortalPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    portalApi
      .get(slug)
      .then((data) => {
        if (!cancelled) setPortal(data);
      })
      .catch(() => {
        if (!cancelled) setError('این پرتال یافت نشد یا غیرفعال است.');
      });
    return () => {
      // پاسخ کهنه نباید روی پرتال تازه بنشیند.
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <main className="portal">
        <p className="portal-error">{error}</p>
      </main>
    );
  }

  if (!portal) {
    return (
      <main className="portal">
        <p className="portal-loading">در حال بارگذاری…</p>
      </main>
    );
  }

  return (
    <>
      <main className="portal">
        {portal.logoUrl && (
          <img className="portal-logo" src={portal.logoUrl} alt="" />
        )}

        <h1>{portal.title}</h1>
        {portal.description && (
          <p className="portal-description">{portal.description}</p>
        )}

        {portal.forms.length === 0 ? (
          <p className="portal-empty">
            فعلا فرمی برای پاسخ‌دهی روی این صفحه نیست.
          </p>
        ) : (
          <ul className="portal-forms">
            {portal.forms.map((form) => (
              <li key={form.formId}>
                <a className="portal-card" href={form.url}>
                  <span className="portal-card-body">
                    <span className="portal-card-title">{form.title}</span>
                    {form.description && (
                      <span className="portal-card-desc">
                        {form.description}
                      </span>
                    )}
                    {/*
                      نشانه‌های کوتاه: مخاطب پیش از کلیک بداند چقدر طول
                      می‌کشد و آیا باید وارد شود.
                    */}
                    <span className="portal-card-meta">
                      {typeof form.questionCount === 'number' &&
                        form.questionCount > 0 && (
                          <span>
                            {form.questionCount.toLocaleString('fa-IR')} سوال
                          </span>
                        )}
                      {typeof form.estimatedMinutes === 'number' &&
                        form.estimatedMinutes > 0 && (
                          <span>
                            حدود {form.estimatedMinutes.toLocaleString('fa-IR')}{' '}
                            دقیقه
                          </span>
                        )}
                      {form.requiresAuth && <span>نیازمندِ ورود</span>}
                    </span>
                  </span>
                  <span className="portal-card-go" aria-hidden="true">
                    ←
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </main>

      <PlatformFooter footer={portal.footer} />
    </>
  );
}
