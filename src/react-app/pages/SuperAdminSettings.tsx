import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, CreditCard, Building, Save, Check, Plus, Edit2, Trash2 } from 'lucide-react';
import Layout from '@/react-app/components/Layout';
import { apiCall } from '@/react-app/hooks/useAuth';
import { usePlatformSettings } from '@/react-app/hooks/usePlatformSettings';
import { useToast } from '@/react-app/hooks/useToast';
import ConfirmModal from '@/react-app/components/ConfirmModal';

interface PlatformSettings {
  support_phone: string;
  platform_name: string;
  logo_url: string;
  favicon_url: string;
  page_title: string;
}

interface PaymentMethod {
  id: number;
  name: string;
  type: string;
  qr_image_url?: string;
  account_number?: string;
  account_holder?: string;
  bank_name?: string;
  is_active: boolean;
  created_at: string;
}

export default function SuperAdminSettings() {
  const { showSuccess, showError } = useToast();
  const { settings: platformSettings, loading: platformLoading, refreshSettings } = usePlatformSettings();
  const [activeTab, setActiveTab] = useState('platform');
  const [settings, setSettings] = useState<PlatformSettings & { enable_free_registration?: boolean }>({
    support_phone: '',
    platform_name: 'Isites Pro',
    logo_url: '',
    favicon_url: '',
    page_title: 'Isites Pro',
    enable_free_registration: true
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const tabs = [
    { id: 'platform', name: 'Personalización', icon: Building },
    { id: 'payment', name: 'Métodos de Pago', icon: CreditCard },
  ];

  useEffect(() => {
    // Update local settings when platform settings are loaded
    if (!platformLoading && platformSettings) {
      setSettings(platformSettings);
    }
  }, [platformSettings, platformLoading]);

  useEffect(() => {
    // Fetch payment methods when payment tab is active
    if (activeTab === 'payment') {
      fetchPaymentMethods();
    }
  }, [activeTab]);

  const fetchPaymentMethods = async () => {
    setLoadingPayments(true);
    try {
      const response = await apiCall('/api/superadmin/payment-methods');
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.payment_methods);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const togglePaymentMethodStatus = async (id: number, isActive: boolean) => {
    try {
      const response = await apiCall(`/api/superadmin/payment-methods/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (response.ok) {
        fetchPaymentMethods();
      }
    } catch (error) {
      console.error('Error toggling payment method status:', error);
    }
  };

  const deletePaymentMethod = async (id: number) => {
    try {
      const response = await apiCall(`/api/superadmin/payment-methods/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchPaymentMethods();
        showSuccess('Éxito', 'Método de pago eliminado correctamente');
      } else {
        showError('Error', 'No se pudo eliminar el método de pago');
      }
    } catch (error) {
      console.error('Error deleting payment method:', error);
      showError('Error', 'Error de conexión al eliminar el método de pago');
    }
  };

  const handleDeletePaymentClick = (id: number, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: `¿Estás seguro de que quieres eliminar el método de pago "${name}"? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        deletePaymentMethod(id);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const getPaymentTypeText = (type: string) => {
    return type === 'digital_wallet' ? 'Billetera Digital' : 'Cuenta Bancaria';
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await apiCall('/api/superadmin/platform-customization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setSaveSuccess(true);
        showSuccess('Éxito', 'Configuraciones guardadas correctamente');
        
        // Refresh platform settings to apply changes immediately
        setTimeout(() => {
          refreshSettings();
          setSaveSuccess(false);
        }, 1500);
      } else {
        const errorData = await response.json();
        showError('Error', errorData.error || 'Error al guardar configuraciones');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showError('Error', 'Error de conexión al guardar configuraciones');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <SettingsIcon className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuraciones</h1>
            <p className="text-gray-600">Gestiona la plataforma y configuraciones globales</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-4 px-6 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {platformLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {activeTab === 'platform' && (
                  <form onSubmit={handleSaveSettings} className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Personalización de la Plataforma</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nombre de la Plataforma
                          </label>
                          <input
                            type="text"
                            value={settings.platform_name}
                            onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Título de la Página
                          </label>
                          <input
                            type="text"
                            value={settings.page_title}
                            onChange={(e) => setSettings({ ...settings, page_title: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            URL del Logo
                          </label>
                          <input
                            type="url"
                            value={settings.logo_url}
                            onChange={(e) => setSettings({ ...settings, logo_url: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="https://example.com/logo.png"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            URL del Favicon
                          </label>
                          <input
                            type="url"
                            value={settings.favicon_url}
                            onChange={(e) => setSettings({ ...settings, favicon_url: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="https://example.com/favicon.ico"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Teléfono de Soporte
                          </label>
                          <input
                            type="tel"
                            value={settings.support_phone}
                            onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="+51 999 999 999"
                          />
                          <p className="mt-1 text-sm text-gray-500">
                            Este número aparecerá en el botón de soporte para WhatsApp
                          </p>
                        </div>

                        <div className="md:col-span-2">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.enable_free_registration || false}
                              onChange={(e) => setSettings({ ...settings, enable_free_registration: e.target.checked })}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-700">Habilitar Registro Gratuito</span>
                              <p className="text-sm text-gray-500">
                                Permite que nuevos usuarios se registren con el plan GRATIS desde el login. Se activará el plan automáticamente.
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={saving || saveSuccess}
                        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed ${
                          saveSuccess 
                            ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:opacity-50'
                        }`}
                      >
                        {saveSuccess ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Guardado
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {activeTab === 'payment' && (
                  <div className="space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">Métodos de Pago Globales</h3>
                        <p className="text-gray-600 mt-1">
                          Gestiona los métodos de pago para pagos de administradores del SaaS
                        </p>
                      </div>
                      
                      <div className="mt-4 lg:mt-0">
                        <button 
                          onClick={() => setShowAddPaymentModal(true)}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Nuevo Método
                        </button>
                      </div>
                    </div>

                    {loadingPayments ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <>
                        {paymentMethods.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {paymentMethods.map((method) => (
                              <div key={method.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center space-x-2">
                                    <CreditCard className="w-5 h-5 text-blue-600" />
                                    <h4 className="text-lg font-medium text-gray-900">{method.name}</h4>
                                  </div>
                                  <div className="flex space-x-1">
                                    <button 
                                      onClick={() => setEditingPaymentMethod(method)} 
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeletePaymentClick(method.id, method.name)} 
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                
                                <p className="text-sm text-gray-500 mb-3">{getPaymentTypeText(method.type)}</p>
                                
                                {method.qr_image_url && (
                                  <img src={method.qr_image_url} alt="QR Code" className="w-32 h-32 object-contain mx-auto mb-3" />
                                )}
                                
                                {method.account_number && (
                                  <div className="text-sm text-gray-600 space-y-1">
                                    <p>Cuenta: {method.account_number}</p>
                                    {method.account_holder && <p>Titular: {method.account_holder}</p>}
                                    {method.bank_name && <p>Banco: {method.bank_name}</p>}
                                  </div>
                                )}

                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <button
                                    onClick={() => togglePaymentMethodStatus(method.id, !method.is_active)}
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      method.is_active
                                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                    }`}
                                  >
                                    {method.is_active ? 'Activo' : 'Inactivo'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay métodos de pago</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Comienza creando tu primer método de pago global.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {(showAddPaymentModal || editingPaymentMethod) && (
        <PaymentMethodModal
          paymentMethod={editingPaymentMethod}
          onClose={() => {
            setShowAddPaymentModal(false);
            setEditingPaymentMethod(null);
          }}
          onSuccess={() => {
            setShowAddPaymentModal(false);
            setEditingPaymentMethod(null);
            fetchPaymentMethods();
          }}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type="danger"
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </Layout>
  );
}

function PaymentMethodModal({ 
  paymentMethod, 
  onClose, 
  onSuccess 
}: { 
  paymentMethod: PaymentMethod | null; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    name: paymentMethod?.name || '',
    type: paymentMethod?.type || 'digital_wallet',
    qr_image_url: paymentMethod?.qr_image_url || '',
    account_number: paymentMethod?.account_number || '',
    account_holder: paymentMethod?.account_holder || '',
    bank_name: paymentMethod?.bank_name || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = paymentMethod 
        ? `/api/superadmin/payment-methods/${paymentMethod.id}`
        : '/api/superadmin/payment-methods';
      
      const method = paymentMethod ? 'PUT' : 'POST';

      const response = await apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showSuccess('Éxito', paymentMethod ? 'Método de pago actualizado correctamente' : 'Método de pago creado correctamente');
        onSuccess();
      } else {
        showError('Error', paymentMethod ? 'Error al actualizar el método de pago' : 'Error al crear el método de pago');
      }
    } catch (error) {
      console.error('Error saving payment method:', error);
      showError('Error', 'Error de conexión al guardar el método de pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {paymentMethod ? 'Editar Método de Pago' : 'Crear Nuevo Método de Pago'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="digital_wallet">Billetera Digital</option>
                <option value="bank_account">Cuenta Bancaria</option>
              </select>
            </div>

            {formData.type === 'digital_wallet' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">URL del QR</label>
                <input
                  type="url"
                  value={formData.qr_image_url}
                  onChange={(e) => setFormData({ ...formData, qr_image_url: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Número de Cuenta</label>
              <input
                type="text"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {formData.type === 'bank_account' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Titular</label>
                  <input
                    type="text"
                    value={formData.account_holder}
                    onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Banco</label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Guardando...' : (paymentMethod ? 'Actualizar' : 'Crear')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}