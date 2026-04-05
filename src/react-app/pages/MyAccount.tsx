import { useState, useEffect } from 'react';
import { CreditCard, User, Save, TrendingUp, Check, MessageCircle } from 'lucide-react';
import { useAuth, apiCall } from '@/react-app/hooks/useAuth';
import { useToast } from '@/react-app/hooks/useToast';
import { usePlatformSettings } from '@/react-app/hooks/usePlatformSettings';
import Layout from '@/react-app/components/Layout';
import { formatLocalDate } from '@/react-app/utils/dateUtils';

interface UserProfile {
  id: number;
  email: string;
  name: string;
  phone: string;
  role: string;
  organization_id: number;
  organization_name: string;
  plan_name: string;
  plan_price: number;
  duration_months: number;
  subscription_start_date: string;
  subscription_end_date: string;
  is_active: boolean;
  subscription_status: string;
}

interface SuperAdminPaymentMethod {
  id: number;
  name: string;
  type: string;
  qr_image_url?: string;
  account_number?: string;
  account_holder?: string;
  bank_name?: string;
}

interface SaasPlan {
  id: number;
  name: string;
  duration_months: number;
  price: number;
  subscription_limit: number;
  employee_limit: number;
  plan_limit: number;
  benefits: string;
  is_active: boolean;
}

export default function MyAccount() {
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const { settings: platformSettings } = usePlatformSettings();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [superAdminPaymentMethods, setSuperAdminPaymentMethods] = useState<SuperAdminPaymentMethod[]>([]);
  const [availablePlans, setAvailablePlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showUpgradePlans, setShowUpgradePlans] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organization_name: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (user?.id) {
      fetchUserProfile();
      if (user.role === 'admin') {
        fetchSuperAdminPaymentMethods();
        fetchAvailablePlans();
      }
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const response = await apiCall(`/api/my-account/${user?.id}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setFormData({
          name: data.user.name || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          organization_name: data.user.organization_name || '',
          password: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuperAdminPaymentMethods = async () => {
    try {
      const response = await apiCall('/api/global-payment-methods');
      if (response.ok) {
        const data = await response.json();
        setSuperAdminPaymentMethods(data.payment_methods || []);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const fetchAvailablePlans = async () => {
    try {
      const response = await apiCall('/api/available-plans');
      if (response.ok) {
        const data = await response.json();
        setAvailablePlans(data.plans || []);
      }
    } catch (error) {
      console.error('Error fetching available plans:', error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password && formData.password !== formData.confirmPassword) {
      showError('Error', 'Las contraseñas no coinciden');
      return;
    }
    
    setSaving(true);

    try {
      const updateData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        organization_name: user?.role === 'admin' ? formData.organization_name : undefined,
        password: formData.password || undefined
      };

      const response = await apiCall(`/api/my-account/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        // Refresh profile data
        await fetchUserProfile();
        // Clear password fields
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        showSuccess('Éxito', 'Perfil actualizado exitosamente');
      } else {
        const errorData = await response.json();
        showError('Error', errorData.error || 'Error al actualizar perfil');
      }
    } catch (error) {
      showError('Error', 'Error de conexión al actualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const getDurationText = (months: number) => {
    if (!months) return '';
    if (months === 1) return '1 mes';
    if (months < 12) return `${months} meses`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return years === 1 ? '1 año' : `${years} años`;
    }
    return `${years} ${years === 1 ? 'año' : 'años'} y ${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`;
  };

  const getSubscriptionStatus = () => {
    if (!profile?.subscription_status) {
      return { status: 'Sin información', color: 'text-gray-900', bgColor: 'bg-gray-50' };
    }

    // Use the status directly from the backend (which matches superadmin logic)
    const backendStatus = profile.subscription_status;
    
    switch (backendStatus) {
      case 'cancelled':
        return { status: 'Cancelada', color: 'text-red-900', bgColor: 'bg-red-50' };
      case 'expired':
        return { status: 'Vencida', color: 'text-red-900', bgColor: 'bg-red-50' };
      case 'expiring':
        // Calculate remaining days for display
        if (profile.subscription_end_date) {
          const now = new Date();
          const endDate = new Date(profile.subscription_end_date);
          now.setHours(0, 0, 0, 0);
          endDate.setHours(0, 0, 0, 0);
          const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return { status: `Por vencer (${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'día' : 'días'})`, color: 'text-yellow-900', bgColor: 'bg-yellow-50' };
        }
        return { status: 'Por vencer', color: 'text-yellow-900', bgColor: 'bg-yellow-50' };
      case 'active':
        return { status: 'Activa', color: 'text-green-900', bgColor: 'bg-green-50' };
      case 'pending':
        return { status: 'Pendiente', color: 'text-blue-900', bgColor: 'bg-blue-50' };
      default:
        return { status: 'Sin información', color: 'text-gray-900', bgColor: 'bg-gray-50' };
    }
  };

  const handleUpgradePlan = (plan: SaasPlan) => {
    const supportPhone = platformSettings.support_phone || '';
    const message = `Hola, me interesa mejorar mi plan actual a *${plan.name}*\n\n` +
                   `Detalles del plan:\n` +
                   `- Precio: S/ ${plan.price}\n` +
                   `- Duración: ${getDurationText(plan.duration_months)}\n` +
                   `- Límite de suscripciones: ${plan.subscription_limit}\n` +
                   `- Límite de empleados: ${plan.employee_limit}\n` +
                   `- Límite de planes: ${plan.plan_limit}\n\n` +
                   `Mi organización: ${profile?.organization_name}\n` +
                   `Mi email: ${profile?.email}`;
    
    const whatsappUrl = `https://wa.me/${supportPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Cuenta</h1>
          <p className="text-gray-600">
            {user?.role === 'admin' 
              ? 'Gestiona tu perfil y suscripción' 
              : 'Gestiona tu perfil de usuario'}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-4 px-6">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm ${
                  activeTab === 'profile'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Perfil</span>
              </button>
              
              {user?.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('subscription')}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === 'subscription'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Suscripción</span>
                </button>
              )}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Información Personal</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Correo Electrónico
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                      />
                    </div>

                    {user?.role === 'admin' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nombre de la Organización
                        </label>
                        <input
                          type="text"
                          value={formData.organization_name}
                          onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cambiar Contraseña</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nueva Contraseña
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                        placeholder="Dejar vacío para mantener la actual"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Confirmar Contraseña
                      </label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                        placeholder="Confirma la nueva contraseña"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={logout}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Cerrar Sesión
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'subscription' && user?.role === 'admin' && profile && (
              <div className="space-y-6">
                {/* Current Subscription */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Suscripción Activa</h3>
                    <button
                      onClick={() => setShowUpgradePlans(!showUpgradePlans)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-primary to-secondary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Mejorar Plan
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700">Plan</h4>
                      <p className="text-lg font-semibold text-primary">{profile.plan_name || 'Sin Plan'}</p>
                    </div>
                    
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700">Precio</h4>
                      <p className="text-lg font-semibold text-green-900">
                        S/ {profile.plan_price || 0}
                      </p>
                    </div>
                    
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700">Duración</h4>
                      <p className="text-lg font-semibold text-purple-900">
                        {getDurationText(profile.duration_months)}
                      </p>
                    </div>
                    
                    <div className={`p-4 rounded-lg ${getSubscriptionStatus().bgColor}`}>
                      <h4 className="text-sm font-medium text-gray-700">Estado</h4>
                      <p className={`text-lg font-semibold ${getSubscriptionStatus().color}`}>
                        {getSubscriptionStatus().status}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700">Fecha de Inicio</h4>
                      <p className="text-lg font-semibold text-gray-900">
                        {profile.subscription_start_date 
                          ? formatLocalDate(profile.subscription_start_date)
                          : '-'
                        }
                      </p>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700">Fecha de Vencimiento</h4>
                      <p className="text-lg font-semibold text-gray-900">
                        {profile.subscription_end_date 
                          ? formatLocalDate(profile.subscription_end_date)
                          : '-'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Upgrade Plans Modal */}
                {showUpgradePlans && (
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Planes Disponibles</h3>
                      <button
                        onClick={() => setShowUpgradePlans(false)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cerrar
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {availablePlans.map((plan) => (
                        <div key={plan.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                          <h4 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h4>
                          <p className="text-3xl font-bold text-primary mb-4">
                            S/ {plan.price}
                            <span className="text-sm text-gray-500 font-normal">/{getDurationText(plan.duration_months)}</span>
                          </p>
                          
                          <div className="space-y-2 mb-6">
                            <div className="flex items-center text-sm text-gray-600">
                              <Check className="w-4 h-4 text-green-500 mr-2" />
                              <span>{plan.subscription_limit} suscripciones</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <Check className="w-4 h-4 text-green-500 mr-2" />
                              <span>{plan.employee_limit} empleados</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-600">
                              <Check className="w-4 h-4 text-green-500 mr-2" />
                              <span>{plan.plan_limit} planes personalizados</span>
                            </div>
                            {plan.benefits && (
                              <div className="flex items-start text-sm text-gray-600">
                                <Check className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                <span>{plan.benefits}</span>
                              </div>
                            )}
                          </div>
                          
                          <button
                            onClick={() => handleUpgradePlan(plan)}
                            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                          >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Obtener Plan
                          </button>
                        </div>
                      ))}
                    </div>

                    {availablePlans.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No hay planes disponibles para mejorar</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Instructions */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <CreditCard className="w-6 h-6 text-primary" />
                    <h3 className="text-lg font-semibold text-gray-900">Facturación y Pagos</h3>
                  </div>

                  {/* Instructions */}
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">Instrucciones de Pago</h4>
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3 p-4 bg-primary/10 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                          1
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-800">
                            Realiza el pago de tu plan con cualquiera de los métodos de pago disponibles
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                          2
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-800">
                            Ve al botón <span className="font-semibold">"Soporte"</span> y envía un mensaje indicando que realizaste el pago junto a una captura de pantalla
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 p-4 bg-secondary/10 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 bg-secondary text-white rounded-full flex items-center justify-center font-bold">
                          3
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-800">
                            Validaremos el pago y <span className="font-semibold">¡Listo!</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">Métodos de Pago Disponibles</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {superAdminPaymentMethods.map((method) => (
                        <div key={method.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <h5 className="font-medium text-gray-900 mb-2">{method.name}</h5>
                          <p className="text-sm text-gray-500 mb-3">
                            {method.type === 'digital_wallet' ? 'Billetera Digital' : 'Cuenta Bancaria'}
                          </p>
                          
                          {method.qr_image_url && (
                            <div className="mb-3">
                              <img
                                src={method.qr_image_url}
                                alt={`QR ${method.name}`}
                                className="w-32 h-32 object-cover border border-gray-200 rounded mx-auto"
                              />
                            </div>
                          )}
                          
                          {method.type === 'digital_wallet' && method.account_number && (
                            <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200">
                              <p className="font-medium">Número:</p>
                              <p className="text-lg font-mono">{method.account_number}</p>
                            </div>
                          )}
                          
                          {method.type === 'bank_account' && (
                            <div className="text-sm text-gray-700 bg-white p-3 rounded border border-gray-200 space-y-1">
                              {method.bank_name && <p><span className="font-medium">Banco:</span> {method.bank_name}</p>}
                              {method.account_number && <p><span className="font-medium">Cuenta:</span> {method.account_number}</p>}
                              {method.account_holder && <p><span className="font-medium">Titular:</span> {method.account_holder}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {superAdminPaymentMethods.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No hay métodos de pago configurados</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}