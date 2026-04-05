import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import Layout from '@/react-app/components/Layout';
import { apiCall } from '@/react-app/hooks/useAuth';
import { useToast } from '@/react-app/hooks/useToast';
import ConfirmModal from '@/react-app/components/ConfirmModal';
import Pagination from '@/react-app/components/Pagination';

interface SaasPlan {
  id: number;
  name: string;
  duration_months: number;
  price: number;
  subscription_limit: number;
  employee_limit: number;
  plan_limit: number;
  start_date: string;
  benefits: string;
  is_active: boolean;
  is_free_plan: boolean;
  created_at: string;
}

export default function SaasPlans() {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SaasPlan | null>(null);
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
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await apiCall('/api/superadmin/saas-plans');
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlanStatus = async (id: number, isActive: boolean) => {
    try {
      const response = await apiCall(`/api/superadmin/saas-plans/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (response.ok) {
        fetchPlans();
      }
    } catch (error) {
      console.error('Error toggling plan status:', error);
    }
  };

  const deletePlan = async (id: number) => {
    try {
      const response = await apiCall(`/api/superadmin/saas-plans/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchPlans();
        showSuccess('Éxito', 'Plan eliminado correctamente');
      } else {
        showError('Error', 'No se pudo eliminar el plan');
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      showError('Error', 'Error de conexión al eliminar el plan');
    }
  };

  const handleDeleteClick = (id: number, planName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: `¿Estás seguro de que quieres eliminar el plan "${planName}"? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        deletePlan(id);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const getDurationText = (months: number) => {
    if (months === 1) return '1 mes';
    if (months < 12) return `${months} meses`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return years === 1 ? '1 año' : `${years} años`;
    }
    return `${years} ${years === 1 ? 'año' : 'años'} y ${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`;
  };

  // Cálculos de paginación
  const totalPages = Math.ceil(plans.length / ITEMS_PER_PAGE);
  const paginatedPlans = plans.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planes SaaS</h1>
            <p className="text-gray-600">Gestiona los planes de suscripción para administradores</p>
          </div>
          
          <div className="mt-4 lg:mt-0">
            <button 
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-primary to-secondary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Plan
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duración</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Límites</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{plan.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{getDurationText(plan.duration_months || 1)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{formatCurrency(plan.price)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div>Suscripciones: {plan.subscription_limit}</div>
                        <div>Empleados: {plan.employee_limit || 10}</div>
                        <div>Planes: {plan.plan_limit || 10}</div>
                        {plan.benefits && (
                          <div className="text-gray-600 mt-1">{plan.benefits}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => togglePlanStatus(plan.id, !plan.is_active)}
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          plan.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {plan.is_active ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Activo
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3 mr-1" />
                            Inactivo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingPlan(plan)}
                          className="text-primary hover:opacity-80 transition-opacity"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!plan.is_free_plan && (
                          <button
                            onClick={() => handleDeleteClick(plan.id, plan.name)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {plan.is_free_plan && (
                          <span className="text-xs text-gray-400 italic">Plan FREE</span>
                        )}
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

        {plans.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">📋</div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay planes</h3>
            <p className="mt-1 text-sm text-gray-500">
              Comienza creando tu primer plan de suscripción.
            </p>
          </div>
        )}
      </div>

      {(showAddModal || editingPlan) && (
        <PlanModal
          plan={editingPlan}
          onClose={() => {
            setShowAddModal(false);
            setEditingPlan(null);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            setEditingPlan(null);
            fetchPlans();
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

function PlanModal({ plan, onClose, onSuccess }: { plan: SaasPlan | null; onClose: () => void; onSuccess: () => void; }) {
  const { showSuccess, showError } = useToast();
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    duration_months: plan?.duration_months || 1,
    price: plan?.price || 0,
    subscription_limit: plan?.subscription_limit || 50,
    employee_limit: plan?.employee_limit || 10,
    plan_limit: plan?.plan_limit || 10,
    benefits: plan?.benefits || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = plan 
        ? `/api/superadmin/saas-plans/${plan.id}`
        : '/api/superadmin/saas-plans';
      
      const method = plan ? 'PUT' : 'POST';

      const response = await apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showSuccess('Éxito', plan ? 'Plan actualizado correctamente' : 'Plan creado correctamente');
        onSuccess();
      } else {
        showError('Error', plan ? 'Error al actualizar el plan' : 'Error al crear el plan');
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      showError('Error', 'Error de conexión al guardar el plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {plan ? 'Editar Plan' : 'Crear Nuevo Plan'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre del Plan</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Duración (meses)</label>
              <select
                value={formData.duration_months}
                onChange={(e) => setFormData({ ...formData, duration_months: parseInt(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              >
                {Array.from({ length: 36 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {month} {month === 1 ? 'mes' : 'meses'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Precio (S/)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Límite de Suscripciones</label>
              <input
                type="number"
                required
                value={formData.subscription_limit}
                onChange={(e) => setFormData({ ...formData, subscription_limit: parseInt(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Límite de Empleados</label>
              <input
                type="number"
                required
                value={formData.employee_limit}
                onChange={(e) => setFormData({ ...formData, employee_limit: parseInt(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
              <p className="text-sm text-gray-500 mt-1">
                Número máximo de empleados que puede crear el administrador
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Límite de Planes Creados</label>
              <input
                type="number"
                required
                value={formData.plan_limit}
                onChange={(e) => setFormData({ ...formData, plan_limit: parseInt(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
              />
              <p className="text-sm text-gray-500 mt-1">
                Número máximo de planes que puede crear el administrador
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Beneficios</label>
              <textarea
                value={formData.benefits}
                onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                rows={3}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
                placeholder="Describe los beneficios del plan..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Guardando...' : (plan ? 'Actualizar' : 'Crear Plan')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}