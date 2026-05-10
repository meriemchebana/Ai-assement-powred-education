import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { authAPI, setTokenStorage, removeTokenStorage } from '../api/client';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      const storedToken = await SecureStore.getItemAsync('token');
      setToken(storedToken);
      setLoading(false);
    };
    loadToken();
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login(email, password);
    await setTokenStorage(data.access_token);
    setToken(data.access_token);
    setUser(data.teacher);
    return data;
  };

  const register = async (userData) => {
    return await authAPI.register(userData);
  };

  const logout = async () => {
    await removeTokenStorage();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({
    user, token, loading, login, register, logout,
    isAuthenticated: !!token,
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

