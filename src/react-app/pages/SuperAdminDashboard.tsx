import { useState, useEffect } from 'react';
import { Users, DollarSign, AlertTriangle, Activity, TrendingUp, Ban, Clock } from 'lucide-react';
import Layout from '@/react-app/components/Layout';
import { apiCall } from '@/react-app/hooks/useAuth';

interface SuperAdminStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  cancelledSubscriptions: number;
  expiringSubscriptions: number;
  dailyRevenue: number;
  monthlyRevenue: number;
  totalRevenue: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await apiCall('/api/superadmin/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
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

  return (
    <Layout>
      <div className="space-y-6 animate-slide-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Activity className="w-8 h-8 mr-3 text-blue-600" />
              Dashboard SuperAdmin
            </h1>
            <p className="text-gray-600 mt-1">Métricas de suscripciones e ingresos globales</p>
          </div>
        </div>

        {stats && (
          <>
            {/* Grid 1: Tarjetas de Control de Clientes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 card-hover">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Suscripciones Activas</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.activeSubscriptions}</p>
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
                    <p className="text-3xl font-bold text-gray-900">{stats.expiringSubscriptions}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl shadow-lg">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 card-hover">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Vencidas</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.expiredSubscriptions}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                    <AlertTriangle className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 card-hover">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Canceladas</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.cancelledSubscriptions}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl shadow-lg">
                    <Ban className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Grid 2: Tarjetas de Ingresos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 card-hover">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Ingresos Totales (12 meses)</p>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                    <DollarSign className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 card-hover">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Ingresos de este Mes</p>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.monthlyRevenue)}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                    <TrendingUp className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 card-hover">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Ingresos del Día</p>
                    <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.dailyRevenue)}</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg">
                    <DollarSign className="w-7 h-7 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}