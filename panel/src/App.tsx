import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';
import { useAuth } from './auth';
import { AiPage } from './pages/AiPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { ContactsPage } from './pages/ContactsPage';
import { FormBuilderPage } from './pages/FormBuilderPage';
import { FormsPage } from './pages/FormsPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  const token = useAuth((s) => s.token);

  if (!token) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/forms" element={<FormsPage />} />
        <Route path="/forms/:formId" element={<FormBuilderPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/ai" element={<AiPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/forms" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
