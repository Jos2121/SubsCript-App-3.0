import { useState, useEffect } from 'react';
import { Search, Users, MessageCircle, Edit, Trash2, Plus, X as XIcon, RefreshCw, Ban, CheckCircle, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth, apiCall } from '@/react-app/hooks/useAuth';
import { useToast } from '@/react-app/hooks/useToast';
import Layout from '@/react-app/components/Layout';
import ConfirmModal from '@/react-app/components/ConfirmModal';
import Pagination from '@/react-app/components/Pagination';
import { formatLocalDate, getInputDateValue, getTodayInputValue } from '@/react-app/utils/dateUtils';

interface Subscription {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  plan_id: number;
  plan_name: string;
  plan_price: number;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

interface Plan {
  id: number;
  name: string;
  price: number;
  duration_months: number;
}

interface PaymentMethod {
  id: number;
  name: string;
  type: string;
  qr_image_url?: string;
  account_number?: string;
  account_holder?: string;
  bank_name?: string;
  is_active?: boolean;
}

export default function AdminClients() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('recent');
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [showNewSubscriptionModal, setShowNewSubscriptionModal] = useState(false);
  const [showBulkSubscriptionModal, setShowBulkSubscriptionModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [renewingSubscription, setRenewingSubscription] = useState<Subscription | null>(null);
  
  // Paginación Server-Side
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 10;

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

  // Fetch payment methods only once per user change
  useEffect(() => {
    if (user?.organization_id) {
      fetchPaymentMethods();
    }
  }, [user]);

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reiniciar a la primera página cuando cambia algún filtro u ordenamiento
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearch, sortOrder]);

  // Fetch subscriptions when filters, page or user changes
  useEffect(() => {
    if (user?.organization_id) {
      fetchSubscriptions();
    }
  }, [user, currentPage, debouncedSearch, statusFilter, sortOrder]);

  // Auto-refresh subscriptions every 30 seconds
  useEffect(() => {
    if (user?.organization_id) {
      const interval = setInterval(() => {
        fetchSubscriptions();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user, currentPage, debouncedSearch, statusFilter, sortOrder]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const url = `/api/subscriptions?organization_id=${user?.organization_id}&page=${currentPage}&limit=${ITEMS_PER_PAGE}&status=${statusFilter}&search=${encodeURIComponent(debouncedSearch)}&sort=${sortOrder}`;
      const response = await apiCall(url);
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages);
        } else {
          setTotalPages(Math.ceil((data.subscriptions?.length || 0) / ITEMS_PER_PAGE) || 1);
        }
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await apiCall(`/api/organization-payment-methods?organization_id=${user?.organization_id}`);
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.payment_methods.filter((pm: PaymentMethod) => pm.is_active));
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'expiring': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'expired': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'active': return 'Activa';
      case 'expiring': return 'Por Vencer';
      case 'expired': return 'Vencida';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const generateWhatsAppMessage = (subscription: Subscription) => {
    const customerName = subscription.customer_name;
    const planName = subscription.plan_name;
    const endDate = formatLocalDate(subscription.end_date);
    
    let message = '*RECORDATORIO*\n\n';
    
    switch (subscription.status) {
      case 'pending':
        message += `¡Hola ${customerName}!\nTu suscripción al plan ${planName} está pendiente de pago.\n\nPuedes realizar tu pago a través de nuestros métodos de pago:\n`;
        break;
      case 'active':
        message += `¡Hola ${customerName}!\nTu suscripción al plan ${planName} está activa.\n\nTu próxima renovación será el ${endDate}.\n\nSi necesitas ayuda, contáctanos por este medio.`;
        return message;
      case 'expiring':
        message += `¡Hola ${customerName}!\n\nTu suscripción al plan ${planName} está por vencer el ${endDate}.\n\nPara mantener tu servicio activo, puedes realizar tu renovación a través de nuestros métodos de pago:\n`;
        break;
      case 'expired':
        message += `¡Hola ${customerName}!\nTu suscripción al plan ${planName} ha vencido el ${endDate}.\n\nSi deseas renovarlo puedes realizar tu pago a través de nuestros métodos de pago:\n`;
        break;
      case 'cancelled':
        message += `¡Hola ${customerName}!\n\nTu suscripción fue cancelada. Si esto fue un error o deseas reactivarla, contáctanos por este medio.`;
        return message;
      default:
        message += `¡Hola ${customerName}!\nTe contactamos sobre tu suscripción al plan ${planName}.\n\n`;
    }

    if (['pending', 'expiring', 'expired'].includes(subscription.status)) {
      paymentMethods.forEach(method => {
        if (method.type === 'digital_wallet') {
          message += `\n${method.name}: ${method.account_number}`;
        } else {
          message += `\n${method.name}:\nCuenta: ${method.account_number}\nTitular: ${method.account_holder}\nBanco: ${method.bank_name}`;
        }
      });
      message += '\n\nSi necesitas ayuda, contáctanos por este medio.';
    }

    return message;
  };

  const updateSubscriptionStatus = async (subscriptionId: number, newStatus: string) => {
    try {
      const response = await apiCall(`/api/subscriptions/${subscriptionId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        fetchSubscriptions();
        showSuccess('Éxito', newStatus === 'cancelled' ? 'Suscripción suspendida' : 'Suscripción activada');
      } else {
        showError('Error', 'No se pudo cambiar el estado de la suscripción');
      }
    } catch (error) {
      console.error('Error updating subscription status:', error);
      showError('Error', 'Error de conexión');
    }
  };

  const deleteSubscription = async (subscriptionId: number) => {
    try {
      const response = await apiCall(`/api/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        fetchSubscriptions();
        showSuccess('Éxito', 'Suscripción eliminada correctamente');
      } else {
        showError('Error', 'No se pudo eliminar la suscripción');
      }
    } catch (error) {
      console.error('Error deleting subscription:', error);
      showError('Error', 'Error de conexión al eliminar la suscripción');
    }
  };

  const handleDeleteClick = (subscriptionId: number, customerName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: `¿Estás seguro de que quieres eliminar la suscripción de ${customerName}? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        deleteSubscription(subscriptionId);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleToggleStatusClick = (subscriptionId: number, customerName: string, currentStatus: string) => {
    const isCancelled = currentStatus === 'cancelled';
    setConfirmModal({
      isOpen: true,
      title: isCancelled ? 'Confirmar Activación' : 'Confirmar Suspensión',
      message: isCancelled 
        ? `¿Estás seguro de que quieres reactivar la suscripción de ${customerName}?`
        : `¿Estás seguro de que quieres suspender la suscripción de ${customerName}?`,
      onConfirm: () => {
        updateSubscriptionStatus(subscriptionId, isCancelled ? 'active' : 'cancelled');
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const downloadTemplate = () => {
    const templateData = [{
      'Nombre Cliente': 'Juan Pérez',
      'Teléfono': '987654321',
      'Email': 'juan@ejemplo.com',
      'Nombre del Plan': 'Plan Básico',
      'Fecha Inicio (YYYY-MM-DD)': '2024-01-01',
      'Descuento (S/)': 0,
      'Notas': 'Cliente VIP'
    }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    
    const wscols = [
      { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 30 }
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, "plantilla_suscripciones.xlsx");
  };

  if (loading && subscriptions.length === 0) {
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-600">Gestiona las suscripciones de tus clientes</p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
            <button
              onClick={() => setShowNewSubscriptionModal(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary w-full sm:w-auto transition-opacity"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Suscripción
            </button>
            <button
              onClick={() => setShowBulkSubscriptionModal(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-secondary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary w-full sm:w-auto transition-opacity"
            >
              <Upload className="w-4 h-4 mr-2" />
              Añadir Masivamente
            </button>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary w-full sm:w-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Plantilla
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar cliente, teléfono o plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
              >
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="active">Activas</option>
                <option value="expiring">Por Vencer</option>
                <option value="expired">Vencidas</option>
                <option value="cancelled">Canceladas</option>
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
              >
                <option value="recent">Más recientes</option>
                <option value="asc">Nombre (A-Z)</option>
                <option value="desc_name">Nombre (Z-A)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fechas</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{subscription.customer_name}</div>
                        <div className="text-sm text-gray-500">{subscription.customer_phone}</div>
                        {subscription.customer_email && (
                          <div className="text-sm text-gray-500">{subscription.customer_email}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{subscription.plan_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{formatCurrency(subscription.plan_price)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(subscription.status)}`}>
                        {getStatusText(subscription.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div>Inicio: {formatLocalDate(subscription.start_date)}</div>
                        <div>Vence: {formatLocalDate(subscription.end_date)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <a
                          href={`https://wa.me/${subscription.customer_phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(generateWhatsAppMessage(subscription))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-800 p-1"
                          title="Enviar mensaje WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                        
                        <button
                          onClick={() => setRenewingSubscription(subscription)}
                          className="text-emerald-600 hover:text-emerald-800 p-1"
                          title="Renovar Suscripción"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => setEditingSubscription(subscription)}
                          className="text-primary hover:opacity-80 p-1"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteClick(subscription.id, subscription.customer_name)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleToggleStatusClick(subscription.id, subscription.customer_name, subscription.status)}
                          className={`p-1 transition-colors ${
                            subscription.status === 'cancelled'
                              ? 'text-green-600 hover:text-green-800'
                              : 'text-orange-600 hover:text-orange-800'
                          }`}
                          title={subscription.status === 'cancelled' ? "Activar Suscripción" : "Suspender Suscripción"}
                        >
                          {subscription.status === 'cancelled' ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <Ban className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
          />
        </div>

        {subscriptions.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay clientes</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'No se encontraron clientes con los filtros aplicados.'
                : 'No hay suscripciones de clientes registradas.'
              }
            </p>
          </div>
        )}

        {showNewSubscriptionModal && (
          <NewSubscriptionModal 
            onClose={() => setShowNewSubscriptionModal(false)}
            onSuccess={() => {
              setShowNewSubscriptionModal(false);
              fetchSubscriptions();
            }}
            organizationId={user?.organization_id!}
          />
        )}

        {showBulkSubscriptionModal && (
          <ExcelBulkModal 
            onClose={() => setShowBulkSubscriptionModal(false)}
            onSuccess={() => {
              setShowBulkSubscriptionModal(false);
              fetchSubscriptions();
            }}
            organizationId={user?.organization_id!}
          />
        )}

        {editingSubscription && (
          <EditSubscriptionModal 
            subscription={editingSubscription}
            onClose={() => setEditingSubscription(null)}
            onSuccess={() => {
              setEditingSubscription(null);
              fetchSubscriptions();
            }}
            organizationId={user?.organization_id!}
          />
        )}
        
        {renewingSubscription && (
          <RenewSubscriptionModal 
            subscription={renewingSubscription}
            onClose={() => setRenewingSubscription(null)}
            onSuccess={() => {
              setRenewingSubscription(null);
              fetchSubscriptions();
            }}
            organizationId={user?.organization_id!}
          />
        )}

        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          type="danger"
          confirmText="Confirmar"
          cancelText="Cancelar"
        />
      </div>
    </Layout>
  );
}

function RenewSubscriptionModal({ subscription, onClose, onSuccess, organizationId }: {
  subscription: Subscription;
  onClose: () => void;
  onSuccess: () => void;
  organizationId: number;
}) {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(subscription.plan_id.toString());
  const [discount, setDiscount] = useState<number | ''>('');

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await apiCall(`/api/subscription-plans?organization_id=${organizationId}`);
        if (response.ok) {
          const data = await response.json();
          setPlans(data.plans);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      }
    };
    fetchPlans();
  }, [organizationId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);
  };

  const handleRenew = async () => {
    setLoading(true);
    try {
      const response = await apiCall(`/api/subscriptions/${subscription.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan_id: parseInt(selectedPlanId),
          discount: Number(discount) || 0 
        })
      });

      if (response.ok) {
        showSuccess('Éxito', 'Suscripción renovada y pago registrado correctamente');
        onSuccess();
      } else {
        const data = await response.json();
        showError('Error', data.error || 'Error al renovar la suscripción');
      }
    } catch (error) {
      console.error('Error renewing subscription:', error);
      showError('Error', 'Error de conexión al renovar la suscripción');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find(p => p.id.toString() === selectedPlanId);
  const displayPrice = selectedPlan ? selectedPlan.price : subscription.plan_price;
  const finalPrice = Math.max(0, displayPrice - (Number(discount) || 0));

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 mb-4">
            <RefreshCw className="h-6 w-6 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Renovar Suscripción</h3>
          <p className="text-sm text-gray-500 mt-2">
            Selecciona el plan a renovar. Se registrará un nuevo ingreso y se extenderá la fecha de vencimiento.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Cliente:</span>
            <span className="font-medium text-gray-900">{subscription.customer_name}</span>
          </div>
          
          <div className="flex flex-col text-sm space-y-2">
            <label className="text-gray-500 font-medium">Plan a Renovar:</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm py-2 px-3"
            >
              {plans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} - {formatCurrency(plan.price)}
                </option>
              ))}
              {plans.length === 0 && (
                <option value={subscription.plan_id}>{subscription.plan_name}</option>
              )}
            </select>
          </div>

          <div className="flex flex-col text-sm space-y-2 mt-4">
            <label className="text-gray-500 font-medium">Descuento (S/):</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value === '' ? '' : parseFloat(e.target.value))}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-sm py-2 px-3"
              placeholder="0.00"
            />
          </div>
          
          <div className="flex justify-between text-sm border-t border-gray-200 pt-3 mt-4">
            <span className="text-gray-500 font-medium mt-1">Monto a registrar:</span>
            <span className="font-bold text-xl text-emerald-600">{formatCurrency(finalPrice)}</span>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleRenew}
            disabled={loading}
            className="flex-1 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 flex justify-center items-center"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              'Confirmar Renovación'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewSubscriptionModal({ onClose, onSuccess, organizationId }: { 
  onClose: () => void; 
  onSuccess: () => void;
  organizationId?: number;
}) {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    plan_id: '',
    start_date: getTodayInputValue()
  });
  const [discount, setDiscount] = useState<number | ''>('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (organizationId) {
      fetchPlans();
    }
  }, [organizationId]);

  const fetchPlans = async () => {
    try {
      const response = await apiCall(`/api/subscription-plans?organization_id=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // First create the customer
      const customerResponse = await apiCall('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId!,
          name: formData.customer_name,
          phone: formData.customer_phone,
          email: formData.customer_email || null,
        }),
      });

      if (!customerResponse.ok) {
        const data = await customerResponse.json();
        throw new Error(data.error || 'Error al crear cliente');
      }

      const customerData = await customerResponse.json();
      
      // Then create the subscription
      const subscriptionResponse = await apiCall('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId!,
          customer_id: customerData.customer.id,
          plan_id: formData.plan_id,
          start_date: formData.start_date,
          status: 'pending',
          discount: Number(discount) || 0
        }),
      });

      if (subscriptionResponse.ok) {
        showSuccess('Éxito', 'Suscripción creada correctamente');
        onSuccess();
      } else {
        const data = await subscriptionResponse.json();
        const errorMessage = data.error || 'Error al crear suscripción';
        setError(errorMessage);
        showError('Error', errorMessage);
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error de conexión';
      setError(errorMessage);
      showError('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find(p => p.id.toString() === formData.plan_id);
  const totalToCharge = Math.max(0, (selectedPlan?.price || 0) - (Number(discount) || 0));

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Nueva Suscripción</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre del Cliente</label>
              <input
                type="text"
                required
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                type="tel"
                required
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email (opcional)</label>
              <input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Plan</label>
              <select
                required
                value={formData.plan_id}
                onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              >
                <option value="">Seleccionar plan...</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - S/ {plan.price} ({plan.duration_months || 1} {plan.duration_months === 1 ? 'mes' : 'meses'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Descuento (S/)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                placeholder="0.00"
              />
              {formData.plan_id && (
                <p className="mt-2 text-sm font-bold text-gray-900">
                  Total a cobrar: S/ {totalToCharge.toFixed(2)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha de Inicio</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
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
                className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear Suscripción'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EditSubscriptionModal({ subscription, onClose, onSuccess, organizationId }: { 
  subscription: Subscription; 
  onClose: () => void; 
  onSuccess: () => void;
  organizationId?: number;
}) {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    customer_name: subscription.customer_name,
    customer_phone: subscription.customer_phone,
    customer_email: subscription.customer_email || '',
    plan_id: '',
    start_date: getInputDateValue(subscription.start_date),
    upgrade_amount: ''
  });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (organizationId) {
      fetchPlans();
    }
  }, [organizationId]);

  const fetchPlans = async () => {
    try {
      const response = await apiCall(`/api/subscription-plans?organization_id=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiCall(`/api/subscriptions/${subscription.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_email: formData.customer_email || null,
          plan_id: formData.plan_id ? parseInt(formData.plan_id) : null,
          start_date: formData.start_date,
          upgrade_amount: formData.upgrade_amount ? parseFloat(formData.upgrade_amount) : 0
        }),
      });

      if (response.ok) {
        showSuccess('Éxito', 'Suscripción actualizada correctamente');
        onSuccess();
      } else {
        const data = await response.json();
        const errorMessage = data.error || 'Error al actualizar la suscripción';
        setError(errorMessage);
        showError('Error', errorMessage);
      }
    } catch (error) {
      const errorMessage = 'Error de conexión';
      setError(errorMessage);
      showError('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Validamos estrictamente que sea diferente usando .toString() en ambos
  const isPlanChanged = formData.plan_id !== '' && formData.plan_id !== subscription.plan_id.toString();

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Editar Suscripción</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre del Cliente</label>
              <input
                type="text"
                required
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                type="tel"
                required
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Cambiar Plan (opcional)</label>
              <select
                value={formData.plan_id}
                onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              >
                <option value="">Mantener plan actual ({subscription.plan_name})</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id.toString()}>
                    {plan.name} - S/ {plan.price} ({plan.duration_months || 1} {plan.duration_months === 1 ? 'mes' : 'meses'})
                  </option>
                ))}
              </select>
            </div>

            {isPlanChanged && (
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 animate-slide-in">
                <label className="block text-sm font-medium text-primary mb-1">Monto cobrado por el cambio (S/)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.upgrade_amount}
                  onChange={(e) => setFormData({ ...formData, upgrade_amount: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                  placeholder="Ej. 50.00"
                />
                <p className="text-xs text-primary mt-2">
                  Al ingresar un monto aquí, el cliente cambiará de plan pero mantendrá su fecha de inicio original. El nuevo vencimiento se calculará en base a esa fecha original.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha de Inicio</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                disabled={isPlanChanged && parseFloat(formData.upgrade_amount || '0') > 0}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
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
                className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ExcelBulkModal({ onClose, onSuccess, organizationId }: { 
  onClose: () => void; 
  onSuccess: () => void;
  organizationId?: number;
}) {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileSelected, setFileSelected] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) {
      fetchPlans();
    }
  }, [organizationId]);

  const fetchPlans = async () => {
    try {
      const response = await apiCall(`/api/subscription-plans?organization_id=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const parseExcelDate = (excelDate: any) => {
    if (!excelDate) return getTodayInputValue();
    if (typeof excelDate === 'number') {
      const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof excelDate === 'string') {
      const match = excelDate.match(/^\d{4}-\d{2}-\d{2}$/);
      if (match) return match[0];
    }
    return getTodayInputValue();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileSelected(file.name);
    setErrors([]);
    setParsedRows([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setParsedRows(data);
      } catch (err) {
        setErrors(['Error al leer el archivo Excel. Asegúrate de usar la plantilla correcta.']);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSubmit = async () => {
    if (parsedRows.length === 0) {
      setErrors(['El archivo está vacío o no se pudo leer.']);
      return;
    }

    setLoading(true);
    setErrors([]);

    const newErrors: string[] = [];
    let successCount = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const customerName = row['Nombre Cliente'];
      const customerPhone = row['Teléfono']?.toString();
      const customerEmail = row['Email'];
      const planName = row['Nombre del Plan'];
      const startDate = parseExcelDate(row['Fecha Inicio (YYYY-MM-DD)']);
      const discount = Number(row['Descuento (S/)']) || 0;
      const notes = row['Notas'];

      if (!customerName || !customerPhone || !planName) {
        newErrors.push(`Fila ${i + 2}: Faltan campos requeridos (Nombre, Teléfono o Plan).`);
        continue;
      }

      const matchedPlan = plans.find(p => p.name.trim().toLowerCase() === planName.toString().trim().toLowerCase());
      if (!matchedPlan) {
        newErrors.push(`Fila ${i + 2}: No se encontró el plan "${planName}".`);
        continue;
      }

      try {
        // Create customer
        const customerResponse = await apiCall('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId!,
            name: customerName.toString(),
            phone: customerPhone,
            email: customerEmail || null,
            notes: notes || null
          }),
        });

        if (!customerResponse.ok) {
          const data = await customerResponse.json();
          newErrors.push(`Fila ${i + 2}: ${data.error || 'Error al crear cliente'}`);
          continue;
        }

        const customerData = await customerResponse.json();
        
        // Create subscription
        const subscriptionResponse = await apiCall('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId!,
            customer_id: customerData.customer.id,
            plan_id: matchedPlan.id,
            start_date: startDate,
            status: 'pending',
            notes: notes || null,
            discount: discount
          }),
        });

        if (subscriptionResponse.ok) {
          successCount++;
        } else {
          const data = await subscriptionResponse.json();
          newErrors.push(`Fila ${i + 2}: ${data.error || 'Error al crear suscripción'}`);
        }
      } catch (error) {
        newErrors.push(`Fila ${i + 2}: Error de conexión`);
      }
    }

    setLoading(false);

    if (newErrors.length > 0) {
      setErrors(newErrors);
      if (successCount > 0) {
        showSuccess('Parcialmente exitoso', `Se crearon ${successCount} de ${parsedRows.length} suscripciones`);
      } else {
        showError('Error', 'No se pudo procesar ninguna suscripción. Revisa los errores.');
      }
    } else {
      showSuccess('Éxito', `Se crearon ${successCount} suscripciones correctamente`);
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Añadir Masivamente por Excel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-4">
            Asegúrate de descargar y utilizar la plantilla correcta. El sistema buscará el plan por nombre exacto.
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors relative">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            {fileSelected ? (
              <p className="text-sm text-primary font-medium">{fileSelected}</p>
            ) : (
              <p className="text-sm text-gray-600">Haz clic o arrastra tu archivo Excel aquí</p>
            )}
          </div>
        </div>

        {parsedRows.length > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-primary">
              Se han detectado <span className="font-bold">{parsedRows.length}</span> filas listas para procesar.
            </p>
          </div>
        )}

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 max-h-40 overflow-y-auto">
            <h4 className="text-sm font-medium text-red-800 mb-2">Errores encontrados:</h4>
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || parsedRows.length === 0}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-secondary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50"
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            {loading ? 'Procesando...' : 'Confirmar y Procesar'}
          </button>
        </div>
      </div>
    </div>
  );
}