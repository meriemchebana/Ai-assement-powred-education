import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { authAPI } from '../api/client';
import { useTheme } from '../context/ThemeContext';

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useTheme();

  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Get token from route params (passed via deep link or navigation)
    const token = route.params?.token;

    if (!token) {
      setStatus('error');
      return;
    }

    authAPI.verifyEmail(token)
      .then(() => {
        setStatus('success');
        // Auto-navigate to login after 3 seconds
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }, 3000);
      })
      .catch(() => setStatus('error'));
  }, [route.params?.token]);

  // Animate icon on status change
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [status]);

  const isDark = theme.mode === 'dark';

  return (
    <View style={[styles.container, {
      backgroundColor: isDark ? '#0a0f1e' : '#ecfeff',
    }]}>
      <View style={[styles.card, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(8,145,178,0.15)',
      }]}>
        {/* Loading State */}
        {status === 'loading' && (
          <>
            <ActivityIndicator
              size="large"
              color={theme.primary}
              style={styles.spinner}
            />
            <Text style={[styles.loadingText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }]}>
              {t('verify.desc')}
            </Text>
          </>
        )}

        {/* Success State */}
        {status === 'success' && (
          <>
            <Animated.View style={[
              styles.iconCircle,
              {
                backgroundColor: 'rgba(16,185,129,0.15)',
                borderColor: 'rgba(16,185,129,0.3)',
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}>
              <Text style={styles.checkmark}>✓</Text>
            </Animated.View>
            <Text style={[styles.title, { color: isDark ? '#fff' : '#0f172a' }]}>
              {t('verify.title')}
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }]}>
              {t('verify.success')}
            </Text>
            <Text style={[styles.redirectText, { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }]}>
              {t('verify.redirecting')}
            </Text>
          </>
        )}

        {/* Error State */}
        {status === 'error' && (
          <>
            <Animated.View style={[
              styles.iconCircle,
              {
                backgroundColor: 'rgba(239,68,68,0.15)',
                borderColor: 'rgba(239,68,68,0.3)',
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}>
              <Text style={styles.crossmark}>✗</Text>
            </Animated.View>
            <Text style={[styles.title, { color: isDark ? '#fff' : '#0f172a' }]}>
              {t('verify.failed')}
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginBottom: 24 }]}>
              {t('verify.failed')}
            </Text>
            <TouchableOpacity
              onPress={() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              }}
              style={[styles.button, {
                backgroundColor: theme.primary,
              }]}
            >
              <Text style={styles.buttonText}>{t('verify.goToLogin')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  spinner: {
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 15,
    textAlign: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkmark: {
    fontSize: 28,
    color: '#10B981',
    fontWeight: '700',
  },
  crossmark: {
    fontSize: 28,
    color: '#EF4444',
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  redirectText: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

