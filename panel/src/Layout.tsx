import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { platformApi } from './api';
import { NavIcon } from './NavIcon';
import { useAuth } from './auth';

/**
 * آیتم‌های سایدبار.
 *
 * سایدبار پیش‌فرض باز است (۲۲۰px) و در نمایشگر باریک جمع می‌شود؛ آنجا
 * فقط آیکون دیده می‌شود، پس هر آیتم آیکون اختصاصی دارد.
 */
const NAV = [
  { to: '/forms', label: 'فرم‌ها', icon: 'forms' },
  { to: '/dashboards', label: 'داشبوردها', icon: 'dashboards' },
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

  const isSuperAdmin = platform.data?.isSuperAdmin === true;
  const items = isSuperAdmin ? [...NAV, PLATFORM_NAV] : NAV;

  return (
    <div className="app-shell">
      <header className="topbar">
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

      <main className="content">
        <Outlet />
      </main>

      <footer className="statusbar">
        <span>
          <span className="status-dot" aria-hidden="true" />
          متصل
        </span>
        <span>{user?.email}</span>
        {isSuperAdmin && <span>مدیر کل سامانه</span>}
        <span className="spacer" />
        <span>شرکت سماع رایانه کیش</span>
      </footer>
    </div>
  );
}
