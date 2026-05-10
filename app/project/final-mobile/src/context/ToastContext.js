// src/context/ToastContext.js
import React, { createContext, useState, useCallback, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useTheme } from './ThemeContext';

const ToastContext = createContext(null);

const TOAST_COLORS = {
  success: { bg: 'rgba(52,211,153,0.18)', border: 'rgba(52,211,153,0.55)', text: '#34d399' },
  error:   { bg: 'rgba(248,113,113,0.18)', border: 'rgba(248,113,113,0.55)', text: '#f87171' },
  warning: { bg: 'rgba(251,191,36,0.18)', border: 'rgba(251,191,36,0.55)', text: '#fbbf24' },
  info:    { bg: 'rgba(96,165,250,0.18)', border: 'rgba(96,165,250,0.55)', text: '#60a5fa' },
};

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const { theme } = useTheme();

  const addToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(5000),
      Animated.timing(fadeAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, []);

  if (!toast) return <ToastContext.Provider value={{ addToast }}>{children}</ToastContext.Provider>;

  const colors = TOAST_COLORS[toast.type] || TOAST_COLORS.success;
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <Animated.View
        style={[
          styles.toastContainer,
          {
            opacity: fadeAnim,
            backgroundColor: theme.mode === 'dark' ? 'rgba(10,15,40,0.55)' : 'rgba(255,255,255,0.9)',
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.toastRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : '!'}
            </Text>
          </View>
          <Text style={[styles.toastText, { color: theme.text }]}>{toast.message}</Text>
          <TouchableOpacity onPress={() => setToast(null)}>
            <Text style={{ color: theme.muted }}>✕</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    left: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width:0, height:4},
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
    zIndex: 9999,
  },
  toastRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  toastText: { flex: 1, fontSize: 13, fontWeight: '500' },
});

