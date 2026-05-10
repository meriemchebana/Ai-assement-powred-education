import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Image, Platform, StyleSheet,
  KeyboardAvoidingView, SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { authAPI } from '../api/client';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

// ── Google OAuth config ────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'your-client-id';

// ── Icons as simple text/emoji (replace with custom SVG components if desired) ──
const MailIcon = () => <Text style={{ fontSize: 16 }}>✉️</Text>;
const LockIcon = () => <Text style={{ fontSize: 16 }}>🔒</Text>;
const UserIcon = () => <Text style={{ fontSize: 16 }}>👤</Text>;
const EyeIcon = () => <Text style={{ fontSize: 16 }}>👁️</Text>;
const EyeOffIcon = () => <Text style={{ fontSize: 16 }}>🙈</Text>;
const ArrowRightIcon = () => <Text style={{ fontSize: 18, color: '#fff' }}>→</Text>;
const SunIcon = () => <Text style={{ fontSize: 18 }}>☀️</Text>;
const MoonIcon = () => <Text style={{ fontSize: 18 }}>🌙</Text>;

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [forgotStep, setForgotStep] = useState(0); // 0=off,1=email,2=code,3=new-password
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPassShow, setNewPassShow] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  // Register fields
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const setField = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  const { login } = useAuth();
  const { addToast } = useToast();
  const { theme, toggle } = useTheme();
  const navigation = useNavigation();

  const isDark = theme.mode === 'dark';

  // Google auth
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['profile', 'email'],
      redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
    },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleCredential(authentication.idToken);
    }
  }, [response]);

  const handleGoogleCredential = async (idToken) => {
    setLoading(true);
    try {
      const data = await authAPI.googleLogin(idToken);
      // store token and call login just like web
      await login(data.teacher?.email, null, data.access_token);
      navigation.replace('Subjects');
    } catch (err) {
      addToast(err.message || 'Google sign-in failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Submit handlers ─────────────────────────────────────────────────
  const handleLogin = async () => {
    setLoading(true);
    try {
      await login(email, password);
      addToast('Welcome back!', 'success');
      navigation.replace('Subjects');
    } catch (err) {
      addToast(err.message || t('login.loginFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      await authAPI.register(form);
      setVerifyPending(true);
      setMode('login');
      setEmail(form.email);
      setForm({ first_name: '', last_name: '', email: '', password: '' });
    } catch (err) {
      addToast(err.message || t('login.registrationFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSendCode = async () => {
    if (!forgotEmail.includes('@')) return addToast(t('login.invalidEmail'), 'error');
    setLoading(true);
    try {
      await authAPI.forgotPassword(forgotEmail);
      setForgotStep(2);
    } catch (err) {
      addToast(err.message || t('login.failedToSend'), 'error');
    } finally { setLoading(false); }
  };

  const handleForgotVerifyCode = async () => {
    if (resetCode.length !== 6) return addToast('Please enter the 6-digit code', 'error');
    setLoading(true);
    try {
      await authAPI.verifyResetCode(forgotEmail, resetCode);
      setForgotStep(3);
    } catch (err) {
      addToast(err.message || t('login.invalidCode'), 'error');
    } finally { setLoading(false); }
  };

  const handleForgotReset = async () => {
    if (newPass.length < 6) return addToast(t('login.passwordMin'), 'error');
    setLoading(true);
    try {
      await authAPI.resetPassword(forgotEmail, resetCode, newPass);
      addToast(t('login.passwordReset'), 'success');
      setForgotStep(0);
      setForgotEmail('');
      setResetCode('');
      setNewPass('');
    } catch (err) {
      addToast(err.message || 'Something went wrong', 'error');
    } finally { setLoading(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Top bar: language + theme */}
          <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.toggleGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity
                onPress={() => i18n.changeLanguage('en')}
                style={[
                  styles.langBtn,
                  {
                    backgroundColor: i18n.language === 'en' ? (isDark ? 'rgba(8,145,178,0.6)' : '#0891b2') : 'transparent',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                  },
                ]}
              >
                <Text style={{ color: i18n.language === 'en' ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.6)'), fontWeight: '700' }}>EN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => i18n.changeLanguage('ar')}
                style={[
                  styles.langBtn,
                  {
                    backgroundColor: i18n.language === 'ar' ? (isDark ? 'rgba(8,145,178,0.6)' : '#0891b2') : 'transparent',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                  },
                ]}
              >
                <Text style={{ color: i18n.language === 'ar' ? '#fff' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.6)'), fontWeight: '700' }}>ع</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={toggle} style={[styles.themeBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]}>
              {isDark ? <SunIcon /> : <MoonIcon />}
            </TouchableOpacity>
          </View>

          {/* Card */}
          <View style={[styles.card, {
            backgroundColor: isDark ? 'rgba(10,15,30,0.6)' : 'rgba(255,255,255,0.85)',
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.5)',
            shadowColor: isDark ? '#000' : '#000',
          }]}>
            {/* Logo and title */}
            <View style={{ alignItems: 'center', marginBottom: 30 }}>
              <Image
                source={require('../assets/logo.png')}
                style={{ width: 60, height: 60, borderRadius: 15, marginBottom: 10 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 24, fontWeight: '800', color: isDark ? '#fff' : '#0f172a', fontFamily: 'ShareTech' }}>
                ExamGen
              </Text>
            </View>

            {/* Heading */}
            <Text style={[styles.heading, { color: isDark ? '#38bdf8' : '#0369a1' }]}>
              {mode === 'login' ? t('login.title') : t('login.createAccount')}
            </Text>

            {/* Toggle link */}
            <Text style={[styles.switchText, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)' }]}>
              {mode === 'login' ? (
                <>
                  {t('login.noAccount')}{' '}
                  <Text style={{ color: '#0891b2', fontWeight: '600' }} onPress={() => setMode('register')}>
                    {t('login.createOne')}
                  </Text>
                </>
              ) : (
                <>
                  {t('login.hasAccount')}{' '}
                  <Text style={{ color: '#0891b2', fontWeight: '600' }} onPress={() => setMode('login')}>
                    {t('login.signIn')}
                  </Text>
                </>
              )}
            </Text>

            {/* Email verification banner */}
            {verifyPending && (
              <View style={[styles.banner, { backgroundColor: 'rgba(37,99,235,0.1)', borderColor: 'rgba(37,99,235,0.35)' }]}>
                <Text style={{ color: isDark ? '#93c5fd' : '#1d4ed8', fontWeight: '600' }}>{t('login.checkEmail')}</Text>
                <Text style={{ color: isDark ? 'rgba(147,197,253,0.7)' : 'rgba(29,78,216,0.7)', marginTop: 4 }}>
                  {t('login.activationSent', { email })}
                </Text>
                <TouchableOpacity onPress={() => setVerifyPending(false)} style={{ position: 'absolute', top: 8, right: 8 }}>
                  <Text style={{ color: 'rgba(147,197,253,0.6)', fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── LOGIN FORM ──────────────────────────────────── */}
            {mode === 'login' && (
              <View style={{ gap: 16 }}>
                <InputField
                  label={t('login.emailAddress')}
                  icon={<MailIcon />}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@school.edu"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  theme={theme}
                />
                <InputField
                  label={t('login.password')}
                  icon={<LockIcon />}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry
                  theme={theme}
                />

                {/* Remember me + forgot */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <TouchableOpacity onPress={() => setRemember(!remember)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.checkbox, remember && { backgroundColor: '#0891b2', borderColor: '#0891b2' }]}>
                      {remember && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                    </View>
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)', marginLeft: 6 }}>{t('login.rememberPassword')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setForgotStep(1); setForgotEmail(email); }}>
                    <Text style={{ color: '#0891b2', fontWeight: '600' }}>{t('login.forgotPassword')}</Text>
                  </TouchableOpacity>
                </View>

                <SubmitButton loading={loading} label={t('login.signInBtn')} onPress={handleLogin} theme={theme} />

                {/* Google button */}
                {GOOGLE_CLIENT_ID && (
                  <>
                    <Divider label={t('login.orContinueWith')} isDark={isDark} />
                    <TouchableOpacity
                      onPress={() => promptAsync()}
                      disabled={!request}
                      style={[styles.googleBtn, { backgroundColor: isDark ? '#4285F4' : '#fff', borderColor: isDark ? '#4285F4' : '#ddd' }]}
                    >
                      <Text style={{ color: isDark ? '#fff' : '#000', fontWeight: '600' }}>
                        {t('login.googleBtn')}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* ── REGISTER FORM ───────────────────────────────── */}
            {mode === 'register' && (
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <InputField
                    label={t('login.firstName')}
                    icon={<UserIcon />}
                    value={form.first_name}
                    onChangeText={setField('first_name')}
                    placeholder="Meriem"
                    theme={theme}
                  />
                  <InputField
                    label={t('login.lastName')}
                    icon={<UserIcon />}
                    value={form.last_name}
                    onChangeText={setField('last_name')}
                    placeholder="Doe"
                    theme={theme}
                  />
                </View>
                <InputField
                  label={t('login.emailAddress')}
                  icon={<MailIcon />}
                  value={form.email}
                  onChangeText={setField('email')}
                  placeholder="you@school.edu"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  theme={theme}
                />
                <InputField
                  label={t('login.password')}
                  icon={<LockIcon />}
                  value={form.password}
                  onChangeText={setField('password')}
                  placeholder="Min. 6 characters"
                  secureTextEntry
                  theme={theme}
                />
                <SubmitButton loading={loading} label={t('login.createAccount')} onPress={handleRegister} theme={theme} />
                {GOOGLE_CLIENT_ID && (
                  <>
                    <Divider label={t('login.orContinueWith')} isDark={isDark} />
                    <TouchableOpacity
                      onPress={() => promptAsync()}
                      disabled={!request}
                      style={[styles.googleBtn, { backgroundColor: isDark ? '#4285F4' : '#fff', borderColor: isDark ? '#4285F4' : '#ddd' }]}
                    >
                      <Text style={{ color: isDark ? '#fff' : '#000', fontWeight: '600' }}>
                        {t('login.googleBtn')}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal visible={forgotStep > 0} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#0f1729' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)' }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: isDark ? '#fff' : '#0f172a' }}>
                {forgotStep === 1 ? t('login.forgotTitle') : forgotStep === 2 ? t('login.enterCodeTitle') : t('login.resetTitle')}
              </Text>
              <TouchableOpacity onPress={() => { setForgotStep(0); setResetCode(''); setNewPass(''); }}>
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Step 1 — email */}
            {forgotStep === 1 && (
              <View style={{ marginTop: 20 }}>
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)', marginBottom: 16 }}>
                  {t('login.forgotDesc')}
                </Text>
                <InputField
                  label={t('login.emailAddress')}
                  icon={<MailIcon />}
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  placeholder="you@school.edu"
                  keyboardType="email-address"
                  theme={theme}
                />
                <SubmitButton loading={loading} label={t('login.sendCode')} onPress={handleForgotSendCode} theme={theme} />
              </View>
            )}

            {/* Step 2 — code */}
            {forgotStep === 2 && (
              <View style={{ marginTop: 20 }}>
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)', marginBottom: 16 }}>
                  {t('login.codeSentTo')} <Text style={{ color: isDark ? '#93c5fd' : '#1d4ed8', fontWeight: '600' }}>{forgotEmail}</Text>
                </Text>
                <Text style={styles.label}>{t('login.code')}</Text>
                <TextInput
                  value={resetCode}
                  onChangeText={(v) => setResetCode(v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="_ _ _ _ _ _"
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[styles.codeInput, { color: isDark ? '#fff' : '#0f172a', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)' }]}
                />
                <SubmitButton loading={loading} label={t('login.verifyCode')} onPress={handleForgotVerifyCode} theme={theme} />
                <TouchableOpacity onPress={() => setForgotStep(1)} style={{ marginTop: 12 }}>
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', textAlign: 'center' }}>
                    {t('login.didntReceive')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 3 — new password */}
            {forgotStep === 3 && (
              <View style={{ marginTop: 20 }}>
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)', marginBottom: 16 }}>
                  {t('login.codeVerified')} <Text style={{ color: isDark ? '#93c5fd' : '#1d4ed8', fontWeight: '600' }}>{forgotEmail}</Text>
                </Text>
                <InputField
                  label={t('login.newPassword')}
                  icon={<LockIcon />}
                  value={newPass}
                  onChangeText={setNewPass}
                  placeholder="••••••••"
                  secureTextEntry={!newPassShow}
                  theme={theme}
                  rightElement={
                    <TouchableOpacity onPress={() => setNewPassShow(!newPassShow)}>
                      {newPassShow ? <EyeIcon /> : <EyeOffIcon />}
                    </TouchableOpacity>
                  }
                />
                <SubmitButton loading={loading} label={t('login.setNewPassword')} onPress={handleForgotReset} theme={theme} />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────
function InputField({ label, icon, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, theme, rightElement }) {
  const isDark = theme.mode === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [focused, setFocused] = useState(false);

  const inputStyle = {
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    borderColor: focused ? '#0891b2' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'),
    color: isDark ? '#ffffff' : '#0f172a',
    textAlign: isRTL ? 'right' : 'left',
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 14,
    fontFamily: 'ShareTech',
  };

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.7, color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
        {label}
      </Text>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
        <View style={{ marginHorizontal: 10 }}>
          {icon}
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={inputStyle}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightElement}
      </View>
    </View>
  );
}

function SubmitButton({ loading, label, onPress, theme }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={loading} style={[styles.submitBtn, { backgroundColor: loading ? 'rgba(8,145,178,0.4)' : '#0891b2' }]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{label}</Text>
          <ArrowRightIcon />
        </View>
      )}
    </TouchableOpacity>
  );
}

function Divider({ label, isDark }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
      <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
    paddingBottom: 40,
  },
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  toggleGroup: {
    flexDirection: 'row',
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 8,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  themeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    marginTop: 40,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  switchText: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 14,
  },
  banner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    position: 'relative',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  submitBtn: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
    color: 'rgba(255,255,255,0.45)',
  },
  codeInput: {
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 10,
    textAlign: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 16,
  },
});

