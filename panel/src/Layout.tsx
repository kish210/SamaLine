import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './auth';

const NAV = [
  { to: '/forms', label: 'فرم‌ها' },
  { to: '/contacts', label: 'مخاطبان' },
  { to: '/campaigns', label: 'ارسال گروهی' },
  { to: '/ai', label: 'هوش مصنوعی' },
  { to: '/settings', label: 'تنظیمات' },
];

export function Layout() {
  const { user, signOut } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">سماء‌لاین</div>
        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span title={user?.email}>{user?.fullName}</span>
          <button type="button" className="link" onClick={signOut}>
            خروج
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
