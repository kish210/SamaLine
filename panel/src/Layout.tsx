import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { platformApi } from './api';
import { NavIcon } from './NavIcon';
import { useAuth } from './auth';
import { useNarrowScreen } from './useNarrowScreen';

/** انتخاب کاربر برای جمع بودن سایدبار، بین نشست‌ها می‌ماند. */
const SIDEBAR_KEY = 'samaline.sidebar.collapsed';

/**
 * آیتم‌های سایدبار.
 *
 * سایدبار پیش‌فرض باز است (۲۲۰px) و در نمایشگر باریک جمع می‌شود؛ آنجا
 * فقط آیکون دیده می‌شود، پس هر آیتم آیکون اختصاصی دارد.
 */
const NAV = [
  { to: '/forms', label: 'فرم‌ها', icon: 'forms' },
  { to: '/dashboards', label: 'داشبوردها', icon: 'dashboards' },
  { to: '/portals', label: 'پرتال', icon: 'portal' },
  { to: '/contacts', label: 'مخاطبان', icon: 'contacts' },
  { to: '/sources', label: 'اتصال به CRM', icon: 'crm' },
  { to: '/campaigns', label: 'ارسال گروهی', icon: 'campaigns' },
  { to: '/ai', label: 'هوش مصنوعی', icon: 'ai' },
  { to: '/settings', label: 'تنظیمات', icon: 'settings' },
];

/** آیتم ویژه‌ی سوپرادمین؛ فقط برای مدیر کل سامانه. */
const PLATFORM_NAV = {
  to: '/platform',
  label: 'تنظیمات سامانه',
  icon: 'platform',
};

/** حرف اول نام، برای آواتار. */
function initial(name?: string): string {
  return (name ?? '؟').trim().charAt(0) || '؟';
}

export function Layout() {
  const { user, signOut } = useAuth();

  /*
   * فقط برای نمایش یا پنهان کردن منوی «تنظیمات سامانه».
   *
   * تصمیم واقعی دسترسی سمت سرور گرفته می‌شود؛ اگر این درخواست خطا بدهد،
   * منو پنهان می‌ماند و چیزی نمی‌شکند.
   */
  const platform = useQuery({
    queryKey: ['platform-me'],
    queryFn: platformApi.me,
    retry: false,
  });

  /*
   * دو رفتار متفاوت، با یک دکمه.
   *
   * روی نمایشگر پهن، دکمه سایدبار را بین ۲۲۰px و ۶۰px عوض می‌کند و انتخاب
   * کاربر ذخیره می‌شود. روی نمایشگر باریک، سایدبار یک کشوی روی محتواست که
   * پیش‌فرض بسته است.
   *
   * حالت باریک پیش از این یک نوار افقی اسکرول‌شونده بود: هشت آیتم روی صفحه‌ی
   * موبایل جا نمی‌شد و هیچ نشانه‌ای هم نداشت که باید کشیده شود، پس عملا نصف
   * منو نامرئی بود.
   */
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === '1',
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const narrow = useNarrowScreen();

  const toggleSidebar = () => {
    if (narrow) {
      setDrawerOpen((prev) => !prev);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      return next;
    });
  };

  /*
   * با رفتن به صفحه‌ی تازه کشو بسته می‌شود؛ وگرنه روی موبایل صفحه‌ی مقصد
   * زیر کشو می‌ماند و کاربر فکر می‌کند کلیک کار نکرده است.
   */
  const location = useLocation();
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  /** منو الان باز است؟ روی موبایل یعنی کشو، روی دسکتاپ یعنی جمع‌نشده. */
  const menuOpen = narrow ? drawerOpen : !collapsed;

  const isSuperAdmin = platform.data?.isSuperAdmin === true;
  const items = isSuperAdmin ? [...NAV, PLATFORM_NAV] : NAV;

  return (
    <div
      className={['app-shell', collapsed ? 'collapsed' : '', drawerOpen ? 'drawer-open' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <header className="topbar">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'}
          aria-expanded={menuOpen}
          title={menuOpen ? 'بستن منو' : 'باز کردن منو'}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            س
          </span>
          سماء‌لاین
        </div>

        <div className="topbar-spacer" />

        <div className="topbar-user">
          <span className="topbar-avatar" aria-hidden="true">
            {initial(user?.fullName)}
          </span>
          <span title={user?.email}>{user?.fullName}</span>
          <button type="button" className="link" onClick={signOut}>
            خروج
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                [
                  'nav-item',
                  isActive ? 'active' : '',
                  // بخش سوپرادمین با یک خط از منوی عادی جدا می‌شود.
                  item.to === PLATFORM_NAV.to ? 'platform-item' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
              }
            >
              <span className="nav-icon">
                <NavIcon name={item.icon} />
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {drawerOpen && (
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="بستن منو"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <main className="content">
        <Outlet />
      </main>

      <footer className="statusbar">
        <span>
          <span className="status-dot" aria-hidden="true" />
          متصل
        </span>
        <span>{user?.email}</span>
        {isSuperAdmin && <span className="statusbar-extra">مدیر کل سامانه</span>}
        <span className="spacer" />
        <span className="statusbar-extra">شرکت سماع رایانه کیش</span>
      </footer>
    </div>
  );
}
