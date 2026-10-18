import { Navigate, Route, Routes } from 'react-router-dom';
import { FormPage } from './FormScreen';
import { KioskPage } from './KioskPage';
import { PortalPage } from './PortalPage';
import { PublicDashboard } from './PublicDashboard';

function App() {
  return (
    <Routes>
      <Route path="/f/:token" element={<FormPage />} />
      {/* حالت کیوسک: همان فرم، برای دستگاه مشترک با ریست خودکار. */}
      <Route path="/k/:token" element={<KioskPage />} />
      <Route path="/d/:publicToken" element={<PublicDashboard />} />
      <Route path="/p/:slug" element={<PortalPage />} />
      <Route path="*" element={<Navigate to="/f/demo" replace />} />
    </Routes>
  );
}

export default App;
