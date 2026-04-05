import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, ListOrdered, Trash2, Search, X, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import Layout from '@/react-app/components/Layout';
import { apiCall, useAuth } from '@/react-app/hooks/useAuth';
import { useToast } from '@/react-app/hooks/useToast';
import ConfirmModal from '@/react-app/components/ConfirmModal';
import Pagination from '@/react-app/components/Pagination';
import { formatLocalDate } from '@/react-app/utils/dateUtils';
import { usePlatformSettings } from '@/react-app/hooks/usePlatformSettings';

interface IncomeSummary {
  month: string;
  amount: number;
}

interface PaymentDetail {
  id: number;
  amount: number | string; // Postgres devuelve DECIMAL como string
  payment_method: string;
  payment_type: string;
  payment_date: string;
  created_at?: string;
  // Campos extra para Admin
  customer_name?: string;
  plan_name?: string;
  // Campos extra para SuperAdmin
  organization_name?: string;
}

export default function Income() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { settings } = usePlatformSettings();
  
  const [summaryData, setSummaryData] = useState<IncomeSummary[]>([]);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([]);
  const [totals, setTotals] = useState({ all: 0, month: 0, day: 0 });
  const [loading, setLoading] = useState(true);

  // Estados de Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Paginación
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

  // Al cambiar un filtro, reseteamos a página 1 y ejecutamos la búsqueda en el backend
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, startDate, endDate]);

  useEffect(() => {
    if (user) {
      fetchIncome();
    }
  }, [user, currentPage, searchTerm, typeFilter, startDate, endDate]);

  const fetchIncome = async () => {
    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      }).toString();

      const endpoint = user?.role === 'superadmin' 
        ? `/api/superadmin/income?${queryParams}` 
        : `/api/admin/income?organization_id=${user?.organization_id}&${queryParams}`;
      
      const response = await apiCall(endpoint);
      if (response.ok) {
        const data = await response.json();
        setSummaryData(data.summary || []);
        setPaymentDetails(data.details || []);
        if (data.totals) {
          setTotals(data.totals);
        }
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
        }
      }
    } catch (error) {
      console.error('Error fetching income:', error);
    } finally {
      setLoading(false);
    }
  };

  const deletePayment = async (paymentId: number) => {
    try {
      const response = await apiCall(`/api/payments/${paymentId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        showSuccess('Éxito', 'Registro de ingreso eliminado');
        fetchIncome();
      } else {
        showError('Error', 'No se pudo eliminar el registro');
      }
    } catch (error) {
      showError('Error', 'Error de conexión');
    }
  };

  const handleDeleteClick = (paymentId: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar eliminación',
      message: '¿Estás seguro de que deseas eliminar este registro de ingreso? Esto afectará los totales calculados y no se puede deshacer.',
      onConfirm: () => {
        deletePayment(paymentId);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(amount));
  };

  const translatePaymentType = (type: string) => {
    switch(type) {
      case 'new_subscription': return 'Nueva Suscripción';
      case 'renewal': return 'Renovación';
      case 'upgrade': return 'Mejora de Plan';
      default: return 'Otro';
    }
  };

  const translatePaymentMethod = (method: string) => {
    switch(method) {
      case 'digital_wallet': return 'Billetera Digital';
      case 'bank_account': return 'Cuenta Bancaria';
      case 'other': return 'Efectivo / Otro';
      default: return method;
    }
  };

  const exportToExcel = async () => {
    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      }).toString();

      const endpoint = user?.role === 'superadmin' 
        ? `/api/superadmin/income/export?${queryParams}` 
        : `/api/admin/income/export?organization_id=${user?.organization_id}&${queryParams}`;
        
      const response = await apiCall(endpoint);
      
      if (!response.ok) {
        throw new Error('Error al obtener los datos de exportación');
      }
      
      const data = await response.json();
      const allDetails = data.details || [];

      if (allDetails.length === 0) {
        showError('Info', 'No hay datos para exportar');
        setLoading(false);
        return;
      }

      const exportData = allDetails.map((payment: PaymentDetail) => {
        const date = formatLocalDate(payment.payment_date || payment.created_at || '');
        const type = translatePaymentType(payment.payment_type);
        const method = translatePaymentMethod(payment.payment_method);
        const amount = Number(payment.amount).toFixed(2);

        if (user?.role === 'superadmin') {
          return {
            'Fecha': date,
            'Organización': payment.organization_name || 'Desconocido',
            'Tipo': type,
            'Método': method,
            'Monto (S/)': Number(amount)
          };
        } else {
          return {
            'Fecha': date,
            'Cliente': payment.customer_name || 'Desconocido',
            'Plan': payment.plan_name || 'Sin Plan',
            'Tipo': type,
            'Método': method,
            'Monto (S/)': Number(amount)
          };
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ingresos");

      const wscols = user?.role === 'superadmin' 
        ? [
            { wch: 15 }, 
            { wch: 30 }, 
            { wch: 20 }, 
            { wch: 20 }, 
            { wch: 15 }  
          ]
        : [
            { wch: 15 }, 
            { wch: 30 }, 
            { wch: 25 }, 
            { wch: 20 }, 
            { wch: 20 }, 
            { wch: 15 }  
          ];
      worksheet['!cols'] = wscols;

      XLSX.writeFile(workbook, `reporte_ingresos_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      showSuccess('Éxito', 'Reporte descargado correctamente');
    } catch (error) {
      console.error('Error al generar Excel:', error);
      showError('Error', 'Hubo un problema al generar el archivo');
    } finally {
      setLoading(false);
    }
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
      <div className="space-y-6 animate-slide-in">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reporte de Ingresos</h1>
          <p className="text-gray-600">Analiza tus ingresos reales y detalla tus transacciones</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(totals.all)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ingresos Filtrados del Mes</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(totals.month)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-secondary/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-secondary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ingresos Filtrados del Día</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(totals.day)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Evolución Mensual Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolución Mensual</h3>
          <div className="h-80">
            {summaryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summaryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} style={{ fontSize: '12px', fill: '#6B7280' }} />
                  <YAxis 
                    tickFormatter={(val) => `S/ ${val}`} 
                    axisLine={false} 
                    tickLine={false} 
                    style={{ fontSize: '12px', fill: '#6B7280' }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Ingresos']}
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB' }}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill={settings.primary_color || '#10B981'} 
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <DollarSign className="w-12 h-12 text-gray-300 mb-2" />
                <p>No hay datos de ingresos para mostrar.</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Contenedor de la Barra de Filtros */}
          <div className="p-6 border-b border-gray-200 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center">
                <ListOrdered className="w-6 h-6 text-gray-400 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Detalle de Ingresos</h3>
              </div>
              
              <button
                type="button"
                onClick={exportToExcel}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar Reporte Completo
              </button>
            </div>
            
            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Buscar cliente, organización, plan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm w-full sm:w-auto"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="new_subscription">Nueva Suscripción</option>
                  <option value="renewal">Renovación</option>
                  <option value="upgrade">Mejora de Plan</option>
                </select>
              </div>

              {/* Filtros por Rango de Fechas */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Desde:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border border-gray-300 rounded bg-white focus:ring-2 focus:ring-primary text-sm px-2 py-1 cursor-pointer"
                  />
                </div>
                <div className="hidden sm:block text-gray-300">|</div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Hasta:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border border-gray-300 rounded bg-white focus:ring-2 focus:ring-primary text-sm px-2 py-1 cursor-pointer"
                  />
                </div>
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="p-1 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors ml-1"
                    title="Limpiar fechas"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  {user?.role === 'superadmin' ? (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organización</th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                    </>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paymentDetails.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatLocalDate(payment.payment_date || payment.created_at || '')}
                    </td>
                    
                    {user?.role === 'superadmin' ? (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {payment.organization_name || 'Desconocido'}
                      </td>
                    ) : (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {payment.customer_name || 'Desconocido'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.plan_name || 'Sin Plan'}
                        </td>
                      </>
                    )}

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span>{translatePaymentType(payment.payment_type)}</span>
                        <span className="text-xs text-gray-400">{translatePaymentMethod(payment.payment_method)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDeleteClick(payment.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Eliminar ingreso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paymentDetails.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <h3 className="text-sm font-medium text-gray-900">No se encontraron pagos</h3>
                <p className="text-gray-500 text-sm mt-1">
                  {(searchTerm || typeFilter !== 'all' || startDate || endDate) 
                    ? 'Prueba ajustando o limpiando los filtros.' 
                    : 'No hay pagos registrados para mostrar.'}
                </p>
              </div>
            )}
          </div>
          
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
          />
        </div>

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