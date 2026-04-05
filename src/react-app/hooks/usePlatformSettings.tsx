import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiCall, useAuth } from '@/react-app/hooks/useAuth';

interface PlatformSettings {
  support_phone: string;
  platform_name: string;
  logo_url: string;
  favicon_url: string;
  page_title: string;
  enable_free_registration?: boolean;
}

interface PlatformSettingsContextType {
  settings: PlatformSettings;
  loading: boolean;
  refreshSettings: () => void;
}

const defaultSettings: PlatformSettings = {
  support_phone: '',
  platform_name: 'Isites Pro',
  logo_url: '',
  favicon_url: '',
  page_title: 'Isites Pro',
  enable_free_registration: false
};

// Obtenemos los ajustes cacheados si existen para que React arranque con ellos
const getCachedSettings = (): PlatformSettings => {
  try {
    const cached = localStorage.getItem('platform_settings_cache');
    if (cached) {
      return { ...defaultSettings, ...JSON.parse(cached) };
    }
  } catch (e) {}
  return defaultSettings;
};

const PlatformSettingsContext = createContext<PlatformSettingsContextType | undefined>(undefined);

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings>(getCachedSettings());
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      let response;
      if (user?.role === 'superadmin') {
        response = await apiCall('/api/superadmin/platform-customization');
      } else if (user?.organization_id) {
        response = await apiCall(`/api/admin/customization?organization_id=${user.organization_id}`);
      } else {
        response = await fetch('/api/platform-customization');
      }
      
      if (response && response.ok) {
        const data = await response.json();
        const newSettings = {
          support_phone: data.settings.support_phone || defaultSettings.support_phone,
          platform_name: data.settings.platform_name || defaultSettings.platform_name,
          logo_url: data.settings.logo_url || defaultSettings.logo_url,
          favicon_url: data.settings.favicon_url || defaultSettings.favicon_url,
          page_title: data.settings.page_title || defaultSettings.page_title,
          enable_free_registration: data.settings.enable_free_registration
        };
        
        setSettings(newSettings);
        // Guardamos en caché para usarlo en el primer instante de carga
        localStorage.setItem('platform_settings_cache', JSON.stringify(newSettings));
      }
    } catch (error) {
      console.error('Error fetching platform settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  useEffect(() => {
    if (!loading && settings) {
      if (settings.page_title && document.title !== settings.page_title) {
        document.title = settings.page_title;
      }
      if (settings.favicon_url) {
        updateFavicon(settings.favicon_url);
      }
    }
  }, [settings, loading]);

  const updateFavicon = (faviconUrl: string) => {
    if (!faviconUrl) return;
    
    const currentFavicon = document.getElementById('dynamic-favicon') as HTMLLinkElement;
    if (currentFavicon && currentFavicon.href === faviconUrl) {
      return;
    }
    
    const existingFavicons = document.querySelectorAll('link[rel*="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
    existingFavicons.forEach(element => {
      element.remove();
    });
    
    const newFavicon = document.createElement('link');
    newFavicon.rel = 'icon';
    newFavicon.type = 'image/x-icon';
    newFavicon.href = faviconUrl;
    newFavicon.id = 'dynamic-favicon';
    
    document.head.appendChild(newFavicon);
  };

  const refreshSettings = () => {
    setLoading(true);
    fetchSettings();
  };

  return (
    <PlatformSettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}

export function usePlatformSettings() {
  const context = useContext(PlatformSettingsContext);
  if (context === undefined) {
    throw new Error('usePlatformSettings must be used within a PlatformSettingsProvider');
  }
  return context;
}