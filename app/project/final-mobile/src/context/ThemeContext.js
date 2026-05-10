// src/context/ThemeContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../styles/theme';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(darkTheme);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('theme');
      if (stored === 'light') setThemeState(lightTheme);
      else setThemeState(darkTheme);
    })();
  }, []);

  const setTheme = (mode) => {
    if (mode === 'dark') setThemeState(darkTheme);
    else setThemeState(lightTheme);
    AsyncStorage.setItem('theme', mode);
  };

  const toggle = async () => {
    const next = theme.mode === 'dark' ? 'light' : 'dark';
    setTheme(next);
    // Persist to backend if logged in (fire-and-forget)
    const token = await AsyncStorage.getItem('token');
    if (token) {
      fetch('https://your-api.com/api/v1/teachers/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ theme: next }),
      }).catch(() => {});
    }
    return next;
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

