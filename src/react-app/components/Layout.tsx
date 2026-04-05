import { ReactNode, useState, useEffect } from 'react';
import { LogOut, MessageCircle, Settings, Users, FileText, Building2, Menu, X, DollarSign } from 'lucide-react';
import { useAuth } from '@/react-app/hooks/useAuth';
import { usePlatformSettings } from '@/react-app/hooks/usePlatformSettings';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

// Platform Logo Component
function PlatformLogo() {
  const { settings } = usePlatformSettings();

  if (settings.logo_url) {
    return <img src={settings.logo_url} alt="Logo" className="w-10 h-10 object-cover rounded-lg shadow-sm" />;
  }

  return (
    <div className="w-10 h-10 bg-gradient-to-br from-primary via-primary to-secondary rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
      <span className="text-white font-bold text-lg">IP</span>
    </div>
  );
}

// Platform Name Component
function PlatformName() {
  const { settings } = usePlatformSettings();

  return (
    <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent truncate">
      {settings.platform_name}
    </span>
  );
}

// Floating Action Button (FAB) for Support
function FloatingSupportButton() {
  const { settings } = usePlatformSettings();
  const supportPhone = settings.support_phone || '51987654321';

  return (
    <a
      href={`https://wa.me/${supportPhone.replace(/[^0-9]/g, '')}?text=Hola,%20necesito%20soporte%20con%20la%20plataforma`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 bg-green-500 hover:bg-green-600 text-white flex items-center justify-center group"
      title="Contactar a Soporte"
    >
      <MessageCircle className="w-7 h-7" />
      {/* Tooltip opcional en hover para desktop */}
      <span className="absolute right-full mr-4 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap hidden md:block">
        Soporte
      </span>
    </a>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Prevenir scroll en body cuando el menú móvil está abierto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  if (!user) return null;

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Building2, roles: ['admin', 'employee', 'superadmin'] },
    { name: 'Clientes', href: '/customers', icon: Users, roles: ['admin', 'employee'] },
    { name: 'Administradores', href: '/admins', icon: Users, roles: ['superadmin'] },
    { name: 'Ingresos', href: '/ingresos', icon: DollarSign, roles: ['admin', 'superadmin'] },
    { name: 'Contactos', href: '/contacts', icon: Users, roles: ['admin', 'superadmin'] },
    { name: 'Planes', href: '/plans', icon: FileText, roles: ['superadmin'] },
    { name: 'Configuraciones', href: '/settings', icon: Settings, roles: ['admin', 'superadmin'] },
    { name: 'Mi Cuenta', href: '/my-account', icon: Users, roles: ['admin'] },
  ];

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user.role)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 font-sans flex text-gray-900">
      
      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR (Expandible en hover)                       */}
      {/* ========================================================= */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-40 transition-all duration-300 ease-in-out w-20 hover:w-64 group shadow-sm overflow-x-hidden">
        
        {/* Header / Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-100 flex-shrink-0 w-full">
          <Link to="/dashboard" className="flex items-center w-full">
            <PlatformLogo />
            <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
              <PlatformName />
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-6 space-y-2 overflow-y-auto overflow-x-hidden px-3 custom-scrollbar">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-3 py-3 rounded-xl transition-all duration-200 group/item ${
                  isActive
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title={item.name}
              >
                <Icon className={`w-6 h-6 flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-gray-500 group-hover/item:text-primary'}`} />
                <span className="ml-4 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-3 border-t border-gray-100 mt-auto flex-shrink-0 w-full overflow-hidden bg-gray-50/50">
          <div className="flex items-center px-3 py-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize truncate">{user.role}</p>
            </div>
          </div>
          
          <button
            onClick={logout}
            className="w-full flex items-center px-3 py-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors group/logout"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5 flex-shrink-0 transition-transform group-hover/logout:-translate-x-1" />
            <span className="ml-4 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              Cerrar sesión
            </span>
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MOBILE HEADER (Top Bar)                                   */}
      {/* ========================================================= */}
      <header className="md:hidden fixed top-0 w-full flex items-center justify-between bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 h-16 z-30 shadow-sm">
        <Link to="/dashboard" className="flex items-center space-x-3">
          <PlatformLogo />
          <PlatformName />
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label="Abrir menú"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* ========================================================= */}
      {/* MOBILE SIDEBAR & OVERLAY                                  */}
      {/* ========================================================= */}
      
      {/* Overlay oscuro */}
      <div 
        className={`fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Menú Lateral Mobile */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white transform transition-transform duration-300 ease-in-out md:hidden flex flex-col shadow-2xl ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100 bg-gray-50/50">
          <Link to="/dashboard" className="flex items-center space-x-3" onClick={() => setIsMobileMenuOpen(false)}>
            <PlatformLogo />
            <PlatformName />
          </Link>
          <button 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-2 overflow-y-auto px-4 custom-scrollbar">
          {filteredNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                <span className="ml-4 font-medium text-sm">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-5 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-white font-bold shadow-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize truncate">{user.role}</p>
              {user.role !== 'superadmin' && (
                <p className="text-xs text-gray-400 truncate">{(user as any).organization_name}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              logout();
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* CONTENIDO PRINCIPAL                                       */}
      {/* ========================================================= */}
      {/* 
        - En md (Desktop): pl-20 para dejar espacio al sidebar colapsado.
        - En móvil: pt-16 para dejar espacio a la cabecera fija.
      */}
      <main className="flex-1 md:pl-20 pt-16 md:pt-0 min-h-screen w-full transition-all duration-300 flex flex-col">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 w-full flex-1">
          {children}
        </div>
      </main>

      {/* Botón Flotante (FAB) de Soporte */}
      <FloatingSupportButton />

    </div>
  );
}