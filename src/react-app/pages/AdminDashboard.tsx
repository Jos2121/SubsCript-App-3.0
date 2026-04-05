import { useState, useEffect } from 'react';
import { Users, DollarSign, AlertTriangle, BarChart3, Target, Award, Ban, Clock } from 'lucide-react';
import { useAuth, apiCall } from '@/react-app/hooks/useAuth';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '@/react-app/components/Layout';
import { usePlatformSettings } from '@/react-app/hooks/usePlatformSettings';

interface DashboardMetrics {
  plan_name: string;
  plan_limit: number;
  current_usage: number;
  employee_limit: number;
  employee_count: number;
  plan_creation_limit: number;
  plans_count: number;
  active_subscriptions: number;
  expired_subscriptions: number;
  daily_earnings: number;
  monthly_earnings: number;
  sales_history: Array<{
    month: string;
    earnings: number;
    year: number;
  }>;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { settings } = usePlatformSettings();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (user?.organization_id) {
      fetchMetrics();
    }
  }, [user, selectedYear]);

  const fetchMetrics = async () => {
    try {
      const response = await apiCall(`/api/admin/dashboard-metrics?organization_id=${user?.organization_id}&year=${selectedYear}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
  };

  const usagePercentage = metrics && metrics.plan_limit > 0 ? Math.min((metrics.current_usage / metrics.plan_limit) * 100, 100) : 0;
  const employeePercentage = metrics && metrics.employee_limit > 0 ? Math.min((metrics.employee_count / metrics.employee_limit) * 100, 100) : 0;
  const plansPercentage = metrics && metrics.plan_creation_limit > 0 ? Math.min((metrics.plans_count / metrics.plan_creation_limit) * 100, 100) : 0;

  // Generate year options (last 4 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - i);

  // Filter sales history by selected year
  const filteredSalesHistory = metrics?.sales_history.filter(item => item.year === selectedYear) || [];

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
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Panel de control y métricas de tu negocio</p>
          </div>
        </div>

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Target className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Suscripciones</h3>
                </div>
                <span className="text-sm text-gray-500">
                  {metrics.current_usage} / {metrics.plan_limit || '∞'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div 
                  className={`h-3 rounded-full transition-all duration-300 ${
                    usagePercentage >= 90 ? 'bg-red-500' : 
                    usagePercentage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${usagePercentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">
                Uso actual: {usagePercentage.toFixed(1)}% de tu límite
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Empleados</h3>
                </div>
                <span className="text-sm text-gray-500">
                  {metrics.employee_count} / {metrics.employee_limit || '∞'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div 
                  className={`h-3 rounded-full transition-all duration-300 ${
                    employeePercentage >= 90 ? 'bg-red-500' : 
                    employeePercentage >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${employeePercentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">
                Uso actual: {employeePercentage.toFixed(1)}% de tu límite
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Award className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Planes</h3>
                </div>
                <span className="text-sm text-gray-500">
                  {metrics.plans_count} / {metrics.plan_creation_limit || '∞'}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div 
                  className={`h-3 rounded-full transition-all duration-300 ${
                    plansPercentage >= 90 ? 'bg-red-500' : 
                    plansPercentage >= 70 ? 'bg-yellow-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${plansPercentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600">
                Uso actual: {plansPercentage.toFixed(1)}% de tu límite
              </p>
            </div>
          </div>
        )}

        {/* Tarjetas de Métricas Inferiores */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Suscripciones Activas</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.active_subscriptions || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Suscripciones Vencidas</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.expired_subscriptions || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ganancias del Día</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics?.daily_earnings || 0)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Ganancias del Mes</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics?.monthly_earnings || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div className="flex items-center">
              <BarChart3 className="w-6 h-6 text-gray-400 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Evolución Mensual</h3>
            </div>
            <div className="mt-4 lg:mt-0">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="h-80">
            {filteredSalesHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredSalesHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis 
                    tickFormatter={(val) => `S/ ${val}`} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Ingresos']}
                    cursor={{ fill: '#f3f4f6' }}
                  />
                  <Bar 
                    dataKey="earnings" 
                    fill={settings.primary_color || '#10B981'} 
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <DollarSign className="w-12 h-12 text-gray-300 mb-2" />
                <p>No hay datos de ingresos registrados en el año seleccionado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}