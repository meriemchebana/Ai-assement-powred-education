// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useMemo, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, profileAPI } from '../api/client';
import { useTheme } from './ThemeContext';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [booting, setBooting] = useState(true);
  const { setTheme } = useTheme();

  // Rehydrate
  useEffect(() => {
    (async () => {
      const savedToken = await AsyncStorage.getItem('token');
      if (savedToken) {
        setToken(savedToken);
        try {
          const profile = await profileAPI.get();
          setUser(profile);
          if (profile.theme) setTheme(profile.theme);
        } catch {
          await AsyncStorage.removeItem('token');
          setToken(null);
        }
      }
      setBooting(false);
    })();
  }, []);

  const login = async (email, password, existingToken = null) => {
    if (existingToken) {
      await AsyncStorage.setItem('token', existingToken);
      setToken(existingToken);
      const profile = await profileAPI.get();
      setUser(profile);
      if (profile?.theme) setTheme(profile.theme);
      return { access_token: existingToken, teacher: profile };
    }
    await AsyncStorage.removeItem('token');
    const data = await authAPI.login(email, password);
    await AsyncStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    setUser(data.teacher);
    if (data.teacher?.theme) setTheme(data.teacher.theme);
    return data;
  };

  const register = async (userData) => authAPI.register(userData);

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await profileAPI.get();
      setUser(data);
      return data;
    } catch {}
  };

  const value = useMemo(
    () => ({
      user,
      token,
      booting,
      login,
      register,
      logout,
      refreshUser,
      setUser,
      isAuthenticated: !!token,
    }),
    [user, token, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

