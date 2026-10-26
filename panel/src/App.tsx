import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./Layout";
import { useAuth } from "./auth";
import { lazyPage, PageFallback } from "./lazy-page";
import { FormsPage } from "./pages/FormsPage";
import { RoomsPage } from "./pages/RoomsPage";
import { LoginPage } from "./pages/LoginPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";

/*
 * صفحه‌ی فرم‌ها (صفحه‌ی اول پس از ورود) و ورود فوری بارگذاری می‌شوند؛ بقیه
 * هرکدام بسته‌ی جدا دارند و فقط وقتی باز شوند دانلود می‌شوند.
 */
const FormBuilderPage = lazyPage(() =>
  import("./pages/FormBuilderPage").then((m) => ({
    default: m.FormBuilderPage,
  })),
);
const DashboardsPage = lazyPage(() =>
  import("./pages/DashboardsPage").then((m) => ({ default: m.DashboardsPage })),
);
const PortalsPage = lazyPage(() =>
  import("./pages/PortalsPage").then((m) => ({ default: m.PortalsPage })),
);
const MenusPage = lazyPage(() =>
  import("./pages/MenusPage").then((m) => ({ default: m.MenusPage })),
);
const ContactsPage = lazyPage(() =>
  import("./pages/ContactsPage").then((m) => ({ default: m.ContactsPage })),
);
const ContactSourcesPage = lazyPage(() =>
  import("./pages/ContactSourcesPage").then((m) => ({
    default: m.ContactSourcesPage,
  })),
);
const CampaignsPage = lazyPage(() =>
  import("./pages/CampaignsPage").then((m) => ({ default: m.CampaignsPage })),
);
const AiPage = lazyPage(() =>
  import("./pages/AiPage").then((m) => ({ default: m.AiPage })),
);
const SettingsPage = lazyPage(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const PlatformSettingsPage = lazyPage(() =>
  import("./pages/PlatformSettingsPage").then((m) => ({
    default: m.PlatformSettingsPage,
  })),
);

function App() {
  const token = useAuth((s) => s.token);
  const location = useLocation();

  // لینک‌های ایمیلی، معمولا وقتی کاربر وارد نیست.
  if (location.pathname === "/reset-password") return <ResetPasswordPage />;
  if (location.pathname === "/accept-invite") return <AcceptInvitePage />;
  if (!token) return <LoginPage />;

  const page = (element: React.ReactNode) => (
    <PageFallback>{element}</PageFallback>
  );

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/forms" element={<FormsPage />} />
        <Route path="/forms/:formId" element={page(<FormBuilderPage />)} />
        <Route path="/dashboards" element={page(<DashboardsPage />)} />
        <Route path="/portals" element={page(<PortalsPage />)} />
        <Route path="/menus" element={page(<MenusPage />)} />
        <Route path="/contacts" element={page(<ContactsPage />)} />
        <Route path="/sources" element={page(<ContactSourcesPage />)} />
        <Route path="/campaigns" element={page(<CampaignsPage />)} />
        <Route path="/ai" element={page(<AiPage />)} />
        <Route path="/rooms" element={page(<RoomsPage />)} />
        <Route path="/settings" element={page(<SettingsPage />)} />
        <Route path="/platform" element={page(<PlatformSettingsPage />)} />
        <Route path="*" element={<Navigate to="/forms" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
