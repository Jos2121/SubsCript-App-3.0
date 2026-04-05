import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Settings as SettingsIcon, Users, FileText, CreditCard } from 'lucide-react';
import { useAuth, apiCall } from '@/react-app/hooks/useAuth';
import { useToast } from '@/react-app/hooks/useToast';
import Layout from '@/react-app/components/Layout';
import ConfirmModal from '@/react-app/components/ConfirmModal';

interface Plan {
  id: number;
  name: string;
  duration_months: number;
  price: number;
  benefits: string;
  start_date: string;
  is_active: boolean;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
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
}

export default function AdminSettings() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  
  const [activeTab, setActiveTab] = useState('plans');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planFormData, setPlanFormData] = useState({
    name: '',
    duration_months: 1,
    price: '',
    benefits: ''
  });

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeFormData, setEmployeeFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    name: '',
    type: 'digital_wallet',
    qr_image_url: '',
    account_number: '',
    account_holder: '',
    bank_name: ''
  });

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
    { id: 'plans', name: 'Planes', icon: FileText },
    { id: 'employees', name: 'Empleados', icon: Users },
    { id: 'my_payments', name: 'Mis Métodos de Pago', icon: CreditCard },
  ];

  useEffect(() => {
    if (user?.organization_id) {
      fetchData();
    }
  }, [user, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'plans') {
        await fetchPlans();
      } else if (activeTab === 'employees') {
        await fetchEmployees();
      } else if (activeTab === 'my_payments') {
        await fetchPaymentMethods();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await apiCall(`/api/subscription-plans?organization_id=${user?.organization_id}`);
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await apiCall(`/api/users?organization_id=${user?.organization_id}&role=employee`);
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.users);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await apiCall(`/api/organization-payment-methods?organization_id=${user?.organization_id}`);
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.payment_methods);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingPlan ? 'PUT' : 'POST';
      const url = editingPlan ? `/api/subscription-plans/${editingPlan.id}` : '/api/subscription-plans';
      
      const response = await apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...planFormData,
          organization_id: user?.organization_id,
          price: parseFloat(planFormData.price)
        }),
      });

      if (response.ok) {
        showSuccess('Éxito', editingPlan ? 'Plan actualizado correctamente' : 'Plan creado correctamente');
        setShowPlanForm(false);
        setEditingPlan(null);
        setPlanFormData({ name: '', duration_months: 1, price: '', benefits: '' });
        fetchPlans();
      } else {
        const data = await response.json();
        showError('Error', data.error || 'Error al guardar el plan');
      }
    } catch (error) {
      showError('Error', 'Error de conexión');
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingEmployee ? 'PUT' : 'POST';
      const url = editingEmployee ? `/api/users/${editingEmployee.id}` : '/api/users';
      
      const response = await apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...employeeFormData,
          organization_id: user?.organization_id,
          role: 'employee'
        }),
      });

      if (response.ok) {
        showSuccess('Éxito', editingEmployee ? 'Empleado actualizado correctamente' : 'Empleado creado correctamente');
        setShowEmployeeForm(false);
        setEditingEmployee(null);
        setEmployeeFormData({ name: '', email: '', phone: '', password: '' });
        fetchEmployees();
      } else {
        const data = await response.json();
        showError('Error', data.error || 'Error al guardar el empleado');
      }
    } catch (error) {
      showError('Error', 'Error de conexión');
    }
  };

  const handleSavePaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingPayment ? 'PUT' : 'POST';
      const url = editingPayment ? `/api/organization-payment-methods/${editingPayment.id}` : '/api/organization-payment-methods';
      
      const response = await apiCall(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentFormData,
          organization_id: user?.organization_id
        }),
      });

      if (response.ok) {
        showSuccess('Éxito', editingPayment ? 'Método de pago actualizado' : 'Método de pago creado');
        setShowPaymentForm(false);
        setEditingPayment(null);
        setPaymentFormData({
          name: '',
          type: 'digital_wallet',
          qr_image_url: '',
          account_number: '',
          account_holder: '',
          bank_name: ''
        });
        fetchPaymentMethods();
      } else {
        const data = await response.json();
        showError('Error', data.error || 'Error al guardar el método de pago');
      }
    } catch (error) {
      showError('Error', 'Error de conexión');
    }
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanFormData({
      name: plan.name,
      duration_months: plan.duration_months || 1,
      price: plan.price.toString(),
      benefits: plan.benefits || ''
    });
    setShowPlanForm(true);
  };

  const handleDeletePlan = (plan: Plan) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: `¿Estás seguro de que quieres eliminar el plan "${plan.name}"? Esta acción no se puede deshacer y fallará si hay clientes que ya lo están usando.`,
      onConfirm: async () => {
        try {
          const response = await apiCall(`/api/subscription-plans/${plan.id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            showSuccess('Éxito', 'Plan eliminado correctamente');
            fetchPlans();
          } else {
            const data = await response.json();
            showError('Error', data.error || 'Error al eliminar el plan');
          }
        } catch (error) {
          showError('Error', 'Error de conexión al eliminar el plan');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeFormData({
      name: employee.name,
      email: employee.email,
      phone: employee.phone || '',
      password: ''
    });
    setShowEmployeeForm(true);
  };

  const handleDeleteEmployee = (employee: Employee) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: `¿Estás seguro de que quieres eliminar al empleado "${employee.name}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        try {
          const response = await apiCall(`/api/users/${employee.id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            showSuccess('Éxito', 'Empleado eliminado correctamente');
            fetchEmployees();
          } else {
            const data = await response.json();
            showError('Error', data.error || 'Error al eliminar el empleado');
          }
        } catch (error) {
          showError('Error', 'Error de conexión al eliminar el empleado');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleEditPayment = (payment: PaymentMethod) => {
    setEditingPayment(payment);
    setPaymentFormData({
      name: payment.name,
      type: payment.type,
      qr_image_url: payment.qr_image_url || '',
      account_number: payment.account_number || '',
      account_holder: payment.account_holder || '',
      bank_name: payment.bank_name || ''
    });
    setShowPaymentForm(true);
  };

  const handleDeletePaymentMethod = (payment: PaymentMethod) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: `¿Estás seguro de que quieres eliminar el método de pago "${payment.name}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        try {
          const response = await apiCall(`/api/organization-payment-methods/${payment.id}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            showSuccess('Éxito', 'Método de pago eliminado correctamente');
            fetchPaymentMethods();
          } else {
            const data = await response.json();
            showError('Error', data.error || 'Error al eliminar el método de pago');
          }
        } catch (error) {
          showError('Error', 'Error de conexión al eliminar el método de pago');
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
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

  const getPaymentTypeText = (type: string) => {
    return type === 'digital_wallet' ? 'Billetera Digital' : 'Cuenta Bancaria';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <SettingsIcon className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuraciones</h1>
            <p className="text-gray-600">Gestiona los planes, empleados y métodos de pago</p>
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

          <div className="p-4 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {activeTab === 'plans' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">Planes de Suscripción</h3>
                      <button
                        onClick={() => setShowPlanForm(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Plan
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duración</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                            
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {plans.map((plan) => (
                            <tr key={plan.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{plan.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getDurationText(plan.duration_months || 1)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">S/ {plan.price}</td>
                              
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                  <button onClick={() => handleEditPlan(plan)} className="text-blue-600 hover:text-blue-800 p-1">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeletePlan(plan)} className="text-red-600 hover:text-red-800 p-1">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'employees' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-900">Empleados</h3>
                      <button
                        onClick={() => setShowEmployeeForm(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Empleado
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {employees.map((employee) => (
                            <tr key={employee.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{employee.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{employee.phone}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex space-x-2">
                                  <button onClick={() => handleEditEmployee(employee)} className="text-blue-600 hover:text-blue-800 p-1">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeleteEmployee(employee)} className="text-red-600 hover:text-red-800 p-1">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'my_payments' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">Mis Métodos de Pago</h3>
                        <p className="text-sm text-gray-600 mt-1">Estos métodos serán visibles para tus clientes cuando paguen sus suscripciones</p>
                      </div>
                      <button
                        onClick={() => setShowPaymentForm(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Método
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paymentMethods.map((method) => (
                        <div key={method.id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="text-lg font-medium text-gray-900">{method.name}</h4>
                            <div className="flex space-x-1">
                              <button onClick={() => handleEditPayment(method)} className="text-blue-600 hover:text-blue-800 p-1">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeletePaymentMethod(method)} className="text-red-600 hover:text-red-800 p-1">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 mb-2">{getPaymentTypeText(method.type)}</p>
                          
                          {method.qr_image_url && (
                            <img src={method.qr_image_url} alt="QR Code" className="w-32 h-32 object-contain mx-auto mb-2" />
                          )}
                          
                          {method.account_number && (
                            <div className="text-sm text-gray-600">
                              <p>Cuenta: {method.account_number}</p>
                              {method.account_holder && <p>Titular: {method.account_holder}</p>}
                              {method.bank_name && <p>Banco: {method.bank_name}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {showPlanForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-slide-in">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <h3 className="text-lg font-medium text-gray-900 mb-4">{editingPlan ? 'Editar Plan' : 'Nuevo Plan'}</h3>
              
              <form onSubmit={handleSavePlan} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input
                    type="text"
                    required
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Duración</label>
                  <select
                    value={planFormData.duration_months}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, duration_months: parseInt(e.target.value) }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Array.from({ length: 36 }, (_, i) => i + 1).map(month => (
                      <option key={month} value={month}>
                        {month} {month === 1 ? 'mes' : 'meses'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Precio</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={planFormData.price}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Beneficios</label>
                  <textarea
                    value={planFormData.benefits}
                    onChange={(e) => setPlanFormData(prev => ({ ...prev, benefits: e.target.value }))}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlanForm(false);
                      setEditingPlan(null);
                      setPlanFormData({ name: '', duration_months: 1, price: '', benefits: '' });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEmployeeForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-slide-in">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <h3 className="text-lg font-medium text-gray-900 mb-4">{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
              
              <form onSubmit={handleSaveEmployee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input
                    type="text"
                    required
                    value={employeeFormData.name}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    required
                    value={employeeFormData.email}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                  <input
                    type="tel"
                    value={employeeFormData.phone}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {editingEmployee ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                  </label>
                  <input
                    type="password"
                    required={!editingEmployee}
                    value={employeeFormData.password}
                    onChange={(e) => setEmployeeFormData(prev => ({ ...prev, password: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmployeeForm(false);
                      setEditingEmployee(null);
                      setEmployeeFormData({ name: '', email: '', phone: '', password: '' });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPaymentForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-slide-in">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
              <h3 className="text-lg font-medium text-gray-900 mb-4">{editingPayment ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}</h3>
              
              <form onSubmit={handleSavePaymentMethod} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input
                    type="text"
                    required
                    value={paymentFormData.name}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo</label>
                  <select
                    value={paymentFormData.type}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="digital_wallet">Billetera Digital</option>
                    <option value="bank_account">Cuenta Bancaria</option>
                  </select>
                </div>

                {paymentFormData.type === 'digital_wallet' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">URL del QR</label>
                    <input
                      type="url"
                      value={paymentFormData.qr_image_url}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, qr_image_url: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">Número de Cuenta</label>
                  <input
                    type="text"
                    value={paymentFormData.account_number}
                    onChange={(e) => setPaymentFormData(prev => ({ ...prev, account_number: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {paymentFormData.type === 'bank_account' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Titular</label>
                      <input
                        type="text"
                        value={paymentFormData.account_holder}
                        onChange={(e) => setPaymentFormData(prev => ({ ...prev, account_holder: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Banco</label>
                      <input
                        type="text"
                        value={paymentFormData.bank_name}
                        onChange={(e) => setPaymentFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPaymentForm(false);
                      setEditingPayment(null);
                      setPaymentFormData({
                        name: '',
                        type: 'digital_wallet',
                        qr_image_url: '',
                        account_number: '',
                        account_holder: '',
                        bank_name: ''
                      });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
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