import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserType } from '@/shared/types';

interface AuthContextType {
  user: UserType | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to make authenticated API calls
export const apiCall = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('auth_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // If token is invalid, logout user
  if (response.status === 401) {
    const authContext = getAuthContext();
    if (authContext) {
      authContext.logout();
    }
  }
  
  return response;
};

// Global reference to auth context for apiCall function
let authContextRef: AuthContextType | null = null;
const getAuthContext = () => authContextRef;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserType | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Inicializar sesión validando el token contra el backend
    const initSession = async () => {
      const currentToken = localStorage.getItem('auth_token');
      
      if (currentToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${currentToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
          } else {
            logout();
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          logout();
        }
      }
      
      setLoading(false);
    };

    initSession();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        // Guardar token en localStorage
        localStorage.setItem('auth_token', data.session.access_token);
        setToken(data.session.access_token);
        setUser(data.user);
        return { success: true };
      }
      
      const data = await response.json();
      return { success: false, error: data.error || 'Credenciales inválidas' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const logout = () => {
    // Limpiar sesión local
    localStorage.removeItem('auth_token');
    setUser(null);
    setToken(null);
  };

  const authContext: AuthContextType = {
    user,
    login,
    logout,
    loading,
    token,
  };

  // Set global reference for apiCall function
  authContextRef = authContext;

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}