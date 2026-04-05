import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/react-app/hooks/useAuth";
import { ToastProvider } from "@/react-app/hooks/useToast";
import { PlatformSettingsProvider } from "@/react-app/hooks/usePlatformSettings";
import Login from "@/react-app/pages/Login";
import Dashboard from "@/react-app/pages/Dashboard";
import SuperAdminDashboard from "@/react-app/pages/SuperAdminDashboard";
import SuperAdminClients from "@/react-app/pages/SuperAdminClients";
import SuperAdminPaymentMethods from "@/react-app/pages/SuperAdminPaymentMethods";
import SuperAdminContacts from "@/react-app/pages/SuperAdminContacts";
import Settings from "@/react-app/pages/Settings";
import SaasPlans from "@/react-app/pages/SaasPlans";
import AdminClients from "@/react-app/pages/AdminClients";
import AdminSettings from "@/react-app/pages/AdminSettings";
import AdminContacts from "@/react-app/pages/AdminContacts";
import MyAccount from "@/react-app/pages/MyAccount";
import Income from "@/react-app/pages/Income";

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (user.role === 'superadmin') {
    return (
      <Routes>
        <Route path="/dashboard" element={<SuperAdminDashboard />} />
        <Route path="/admins" element={<SuperAdminClients />} />
        <Route path="/contacts" element={<SuperAdminContacts />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/plans" element={<SaasPlans />} />
        <Route path="/customers" element={<SuperAdminClients />} />
        <Route path="/ingresos" element={<Income />} />
        <Route path="/superadmin/payment-methods" element={<SuperAdminPaymentMethods />} />
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/customers" element={<AdminClients />} />
      <Route path="/contacts" element={<AdminContacts />} />
      <Route path="/settings" element={<AdminSettings />} />
      {user.role === 'admin' && (
        <>
          <Route path="/my-account" element={<MyAccount />} />
          <Route path="/ingresos" element={<Income />} />
        </>
      )}
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PlatformSettingsProvider>
        <ToastProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
        </ToastProvider>
      </PlatformSettingsProvider>
    </AuthProvider>
  );
}