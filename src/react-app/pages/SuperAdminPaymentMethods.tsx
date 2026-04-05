import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CreditCard } from 'lucide-react';
import Layout from '@/react-app/components/Layout';
import { apiCall } from '@/react-app/hooks/useAuth';
import { useToast } from '@/react-app/hooks/useToast';
import ConfirmModal from '@/react-app/components/ConfirmModal';
import Pagination from '@/react-app/components/Pagination';

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

export default function SuperAdminPaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const { showSuccess, showError } = useToast();
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

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const response = await apiCall('/api/superadmin/payment-methods');
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.payment_methods);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
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

  const handleDeleteClick = (id: number, name: string) => {
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

  // Cálculos de paginación
  const totalPages = Math.ceil(paymentMethods.length / ITEMS_PER_PAGE);
  const paginatedMethods = paymentMethods.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Métodos de Pago Globales</h1>
            <p className="text-gray-600">Gestiona los métodos de pago para pagos de administradores</p>
          </div>
          
          <div className="mt-4 lg:mt-0">
            <button 
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Método
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedMethods.map((method) => (
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
                        onClick={() => handleDeleteClick(method.id, method.name)} 
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

            {paymentMethods.length === 0 && (
              <div className="text-center py-12">
                <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay métodos de pago</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comienza creando tu primer método de pago global.
                </p>
              </div>
            )}
          </div>
          
          {/* Paginación */}
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
          />
        </div>

        {(showAddModal || editingPaymentMethod) && (
          <PaymentMethodModal
            paymentMethod={editingPaymentMethod}
            onClose={() => {
              setShowAddModal(false);
              setEditingPaymentMethod(null);
            }}
            onSuccess={() => {
              setShowAddModal(false);
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
      </div>
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