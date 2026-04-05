import { useState, useEffect } from 'react';
import { Users, AlertTriangle, Activity, Target, Award, Ban, Clock } from 'lucide-react';
import { useAuth, apiCall } from '@/react-app/hooks/useAuth';
import Layout from '@/react-app/components/Layout';

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
  cancelled_subscriptions: number;
  expiring_subscriptions: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.organization_id) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const response = await apiCall(`/api/admin/dashboard-metrics?organization_id=${user?.organization_id}`);
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

  const getUsagePercentage = () => {
    if (!metrics || metrics.plan_limit === 0) return 0;
    return Math.min((metrics.current_usage / metrics.plan_limit) * 100, 100);
  };

  const getEmployeePercentage = () => {
    if (!metrics || metrics.employee_limit === 0) return 0;
    return Math.min((metrics.employee_count / metrics.employee_limit) * 100, 100);
  };

  const getPlansPercentage = () => {
    if (!metrics || metrics.plan_creation_limit === 0) return 0;
    return Math.min((metrics.plans_count / metrics.plan_creation_limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'from-red-500 to-red-600';
    if (percentage >= 70) return 'from-yellow-500 to-yellow-600';
    return 'from-blue-500 to-blue-600'; // Corregido: antes era primary
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <Activity className="w-5 h-5 text-blue-600 animate-pulse" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const usagePercentage = getUsagePercentage();
  const employeePercentage = getEmployeePercentage();

  return (
    <Layout>
      <div className="space-y-6 animate-slide-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Activity className="w-8 h-8 mr-3 text-blue-600" />
              Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Bienvenido de vuelta, {user?.name}</p>
          </div>
        </div>

        {/* 1. Plan Status Cards - Suscripciones, Empleados y Planes creados */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Suscripciones</h3>
                </div>
                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {metrics.current_usage} / {metrics.plan_limit}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 bg-gradient-to-r ${getUsageColor(usagePercentage)} shadow-md`}
                  style={{ width: `${usagePercentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 font-medium">
                Uso actual: <span className="text-blue-600">{usagePercentage.toFixed(1)}%</span> de tu límite
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Empleados</h3>
                </div>
                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {metrics.employee_count} / {metrics.employee_limit}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 bg-gradient-to-r ${employeePercentage >= 90 ? 'from-red-500 to-red-600' : employeePercentage >= 70 ? 'from-yellow-500 to-yellow-600' : 'from-purple-500 to-purple-600'} shadow-md`}
                  style={{ width: `${employeePercentage}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 font-medium">
                Uso actual: <span className="text-purple-600">{employeePercentage.toFixed(1)}%</span> de tu límite
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-md">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Planes Creados</h3>
                </div>
                <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {metrics.plans_count} / {metrics.plan_creation_limit}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-3 overflow-hidden">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 bg-gradient-to-r ${getPlansPercentage() >= 90 ? 'from-red-500 to-red-600' : getPlansPercentage() >= 70 ? 'from-yellow-500 to-yellow-600' : 'from-green-500 to-green-600'} shadow-md`}
                  style={{ width: `${getPlansPercentage()}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-600 font-medium">
                Uso actual: <span className="text-green-600">{getPlansPercentage().toFixed(1)}%</span> de tu límite
              </p>
            </div>
          </div>
        )}

        {/* 2. Cards Principales - Control de Clientes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 card-hover">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Suscripciones Activas</p>
                <p className="text-3xl font-bold text-gray-900">{metrics?.active_subscriptions || 0}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 card-hover">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Por Vencer (≤3 días)</p>
                <p className="text-3xl font-bold text-gray-900">{metrics?.expiring_subscriptions || 0}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl shadow-lg">
                <Clock className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 card-hover">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Suscripciones Vencidas</p>
                <p className="text-3xl font-bold text-gray-900">{metrics?.expired_subscriptions || 0}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                <AlertTriangle className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 card-hover">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">Suscripciones Canceladas</p>
                <p className="text-3xl font-bold text-gray-900">{metrics?.cancelled_subscriptions || 0}</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl shadow-lg">
                <Ban className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}