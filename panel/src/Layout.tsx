import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { platformApi } from './api';
import { useAuth } from './auth';

/**
 * آیتم‌های سایدبار.
 *
 * هر آیتم یک آیکون تک‌کاراکتری دارد، چون سایدبار در حالت جمع فقط ۶۰px
 * عرض دارد و لیبل‌ها تنها با هاور باز می‌شوند (الگوی پوسته‌ی سماع).
 */
const NAV = [
  { to: '/forms', label: 'فرم‌ها', icon: '▤' },
  { to: '/dashboards', label: 'داشبوردها', icon: '▦' },
  { to: '/contacts', label: 'مخاطبان', icon: '☰' },
  { to: '/sources', label: 'اتصال به CRM', icon: '⇄' },
  { to: '/campaigns', label: 'ارسال گروهی', icon: '✉' },
  { to: '/ai', label: 'هوش مصنوعی', icon: '✧' },
  { to: '/settings', label: 'تنظیمات', icon: '⚙' },
];

/** آیتم ویژه‌ی سوپرادمین؛ فقط برای مدیر کل سامانه. */
const PLATFORM_NAV = {
  to: '/platform',
  label: 'تنظیمات سامانه',
  icon: '⌘',
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
                isActive ? 'nav-item active' : 'nav-item'
              }
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
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
