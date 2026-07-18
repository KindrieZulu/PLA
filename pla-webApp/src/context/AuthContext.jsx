import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('pla_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('pla_access_token', data.accessToken);
    localStorage.setItem('pla_refresh_token', data.refreshToken);
    const userData = { id: data.user.id, username: data.user.username, role: data.user.role, firstName: data.user.firstName, lastName: data.user.lastName };
    localStorage.setItem('pla_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (formData) => {
    const { data } = await api.post('/auth/register', formData);
    localStorage.setItem('pla_access_token', data.accessToken);
    localStorage.setItem('pla_refresh_token', data.refreshToken);
    const userData = { id: data.user.id, username: data.user.username, role: data.user.role, firstName: data.user.firstName, lastName: data.user.lastName };
    localStorage.setItem('pla_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('pla_refresh_token');
      await api.post('/auth/logout', { refreshToken });
    } catch { /* ignore */ }
    localStorage.removeItem('pla_access_token');
    localStorage.removeItem('pla_refresh_token');
    localStorage.removeItem('pla_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
