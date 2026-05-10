import { createContext, useState, useEffect, useMemo } from 'react';
import { authAPI, profileAPI } from '../api/client';
import { useTheme } from './ThemeContext';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem('token'));
  const [booting, setBooting] = useState(() => !!localStorage.getItem('token'));
  const { setTheme }          = useTheme();

  // On mount: if we have a saved token, rehydrate user from API
  useEffect(() => {
    if (!token) { setBooting(false); return; }
    profileAPI.get()
      .then(data => {
        setUser(data);
        if (data.theme) setTheme(data.theme);
      })
      .catch(() => {
        // Token is invalid/expired — clean up
        localStorage.removeItem('token');
        setToken(null);
      })
      .finally(() => setBooting(false));
  }, []); // runs once on mount only

  const login = async (email, password, existingToken = null) => {
    if (existingToken) {
      // Google OAuth path — persist token first so apiCall picks it up immediately
      localStorage.setItem('token', existingToken);
      setToken(existingToken);
      const profile = await profileAPI.get();
      setUser(profile);
      if (profile?.theme) setTheme(profile.theme);
      return { access_token: existingToken, teacher: profile };
    }
    // Email path — clear any stale token so apiCall never sends the wrong one
    localStorage.removeItem('token');
    const data = await authAPI.login(email, password);
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    setUser(data.teacher);
    if (data.teacher?.theme) setTheme(data.teacher.theme);
    return data;
  };

  const register = async (userData) => {
    return authAPI.register(userData);
  };

  const logout = () => {
    // Remove old unscoped keys left by earlier versions (one-time migration cleanup)
    localStorage.removeItem('token');
    localStorage.removeItem('exam_builder_draft');
    localStorage.removeItem('exam_teaching_profile');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await profileAPI.get();
      setUser(data);
      return data;
    } catch { /* silent */ }
  };

  const value = useMemo(() => ({
    user,
    token,
    booting,
    login,
    register,
    logout,
    refreshUser,
    setUser,
    isAuthenticated: !!token,
  }), [user, token, booting]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

