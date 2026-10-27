import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { menuApi, type PublicMenu } from "./api";
import { PlatformFooter } from "./PlatformFooter";

/**
 * صفحه‌ای که مهمان با اسکن QR روی میز باز می‌کند.
 *
 * موبایل‌اول: تقریبا همه‌ی بازدیدها با گوشی و اغلب روی اینترنت ضعیف است، پس
 * نه فونت بیرونی دارد نه اسکریپت اضافه. عکس‌ها `lazy` می‌آیند تا منوی
 * چندصفحه‌ای، باز شدن صفحه را کند نکند.
 */
export function MenuPage() {
  const { slug = "" } = useParams();
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    menuApi
      .get(slug)
      .then((data) => {
        if (!cancelled) setMenu(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "این منو در دسترس نیست. اگر QR را تازه اسکن کرده‌اید، از کارکنان بپرسید.",
          );
        }
      });
    return () => {
      // پاسخ کهنه نباید روی منوی تازه بنشیند.
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return (
      <main className="menu-page">
        <p className="menu-note">{error}</p>
      </main>
    );
  }

  if (!menu) {
    return (
      <main className="menu-page">
        <p className="menu-note">در حال بارگذاری…</p>
      </main>
    );
  }

  const empty = menu.images.length === 0 && menu.sections.length === 0;
  // ظاهرِ انتخاب‌شده در پنل؛ کلاسِ ناشناخته همان ظاهرِ پیش‌فرض را می‌دهد.
  const themeKey = /^[a-z-]+$/.test(menu.theme ?? "") ? menu.theme : "classic";

  return (
    <div className={`menu-shell menu-theme-${themeKey}`}>
    <main className="menu-page">
      <header className="menu-header">
        {menu.logoUrl && (
          <img className="menu-logo" src={menu.logoUrl} alt="" />
        )}
        <h1>{menu.title}</h1>
        {menu.description && (
          <p className="menu-description">{menu.description}</p>
        )}
      </header>

      {menu.sections.map((section) => (
        <section key={section.id} className="menu-section">
          {section.title.trim() && <h2>{section.title}</h2>}
          <ul className="menu-items">
            {section.items.map((item) => (
              <li key={item.id} className="menu-item">
                <div className="menu-item-text">
                  <strong>{item.name}</strong>
                  {item.description && <small>{item.description}</small>}
                </div>
                {item.price.trim() && (
                  <span className="menu-price">{item.price}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {menu.images.length > 0 && (
        <section className="menu-images">
          {menu.images.map((src) => (
            <img key={src} src={src} alt="" loading="lazy" />
          ))}
        </section>
      )}

      {empty && <p className="menu-note">این منو هنوز محتوایی ندارد.</p>}

      <PlatformFooter footer={menu.footer} />
    </main>
    </div>
  );
}
