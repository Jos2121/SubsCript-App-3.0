import { useAuth } from '@/react-app/hooks/useAuth';
import AdminSettings from './AdminSettings';
import SuperAdminSettings from './SuperAdminSettings';

export default function Settings() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <AdminSettings />;
  }

  if (user?.role === 'superadmin') {
    return <SuperAdminSettings />;
  }

  // For other roles, redirect or show error
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Acceso no autorizado</h1>
        <p className="text-gray-600">No tienes permisos para acceder a esta página.</p>
      </div>
    </div>
  );
}
