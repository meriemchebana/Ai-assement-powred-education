import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';

// ── Inline SVG Icons ──────────────────────────────────────────────────────────
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M20 21a8 8 0 1 0-16 0"/>
  </svg>
);

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

// ── Slideshow images ──────────────────────────────────────────────────────────
const IMAGES = [
  'https://app.trickle.so/storage/public/images/usr_1edb2dd390000001/58aaf231-76ee-4f2f-8d0a-c281ec9f0982.png?w=736&h=736',
  'https://app.trickle.so/storage/public/images/usr_1edb2dd390000001/b8fd2e2f-4eb5-4f56-8ea6-a8bd81c2b406.png?w=736&h=736',
  'https://app.trickle.so/storage/public/images/usr_1edb2dd390000001/028f4e48-ade4-455c-bef2-3d453dd9b5fb.png?w=736&h=736',
  'https://app.trickle.so/storage/public/images/usr_1edb2dd390000001/6871b5af-b220-4bac-9d9d-834c06cb747b.png?w=1200&h=1200',
  'https://app.trickle.so/storage/public/images/usr_1edb2dd390000001/9934dcee-4b4f-46b2-aa9c-9ea66be93e8b.png?w=736&h=736',
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function Login() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [mode, setMode]       = useState('login'); // 'login' | 'register'
  const [imgIdx, setImgIdx]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [verifyPending, setVerifyPending] = useState(false);
  const [forgotStep, setForgotStep] = useState(0); // 0=off 1=email 2=code 3=new-password
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode]     = useState('');
  const [newPass, setNewPass]         = useState('');
  const [newPassShow, setNewPassShow] = useState(false);

  // Login fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);

  // Register fields
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const set = (k) => (e) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  const { login }    = useAuth();
  const { addToast } = useToast();
  const { theme, toggle } = useTheme();
  const navigate     = useNavigate();
  const googleBtnRef = useRef(null);

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  const isDark = theme === 'dark';

  // Slideshow cycling
  useEffect(() => {
    const id = setInterval(() => setImgIdx(i => (i + 1) % IMAGES.length), 3000);
    return () => clearInterval(id);
  }, []);

  // Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      window.google?.accounts.id.renderButton(googleBtnRef.current, {
        theme: isDark ? 'filled_black' : 'outline',
        size: 'large',
        width: '100%',
        text: 'continue_with',
        locale: 'en',
      });
    };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [GOOGLE_CLIENT_ID, isDark]);

  // ── Submit handlers ───────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      addToast(data?.is_first_login ? t('login.welcome') : t('login.welcomeBack'), 'success');
      setTimeout(() => navigate('/subjects'), 300);
    } catch (err) {
      addToast(err.message || t('login.loginFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
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

  const handleForgotSendCode = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      return addToast(t('login.invalidEmail'), 'error');
    }
    setLoading(true);
    try {
      await authAPI.forgotPassword(forgotEmail);
      setForgotStep(2);
    } catch (err) {
      addToast(err.message || t('login.failedToSend'), 'error');
    } finally { setLoading(false); }
  };

  const handleForgotVerifyCode = async (e) => {
    e.preventDefault();
    if (resetCode.length !== 6) return addToast('Please enter the 6-digit code', 'error');
    setLoading(true);
    try {
      await authAPI.verifyResetCode(forgotEmail, resetCode);
      setForgotStep(3);
    } catch (err) {
      addToast(err.message || t('login.invalidCode'), 'error');
    } finally { setLoading(false); }
  };

  const handleForgotReset = async (e) => {
    e.preventDefault();
    if (newPass.length < 6) return addToast(t('login.passwordMin'), 'error');
    setLoading(true);
    try {
      await authAPI.resetPassword(forgotEmail, resetCode, newPass);
      addToast(t('login.passwordReset'), 'success');
      setForgotStep(0); setForgotEmail(''); setResetCode(''); setNewPass('');
    } catch (err) {
      addToast(err.message || 'Something went wrong', 'error');
    } finally { setLoading(false); }
  };

  const handleGoogleCredential = async ({ credential }) => {
    setLoading(true);
    try {
      const data = await authAPI.googleLogin(credential);
      localStorage.setItem('token', data.access_token);
      await login(data.teacher?.email, null, data.access_token);
      navigate('/subjects');
    } catch (err) {
      addToast(err.message || 'Google sign-in failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{ background: isDark ? '#0a0f1e' : '#e8edf5' }}
    >
      {/* Top controls: language + theme — follow dir */}
      <div
        className="fixed top-4 z-50 flex items-center gap-2"
        style={{ [isRTL ? 'left' : 'right']: '1rem' }}
      >
        {/* Language toggle */}
        <div
          className="flex items-center rounded-full overflow-hidden"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
          }}
        >
          <button
            onClick={() => i18n.changeLanguage('en')}
            className="px-3 h-9 text-xs font-bold transition-all duration-200"
            style={{
              background: i18n.language === 'en'
                ? (isDark ? 'rgba(8,145,178,0.6)' : '#0891b2')
                : 'transparent',
              color: i18n.language === 'en'
                ? '#ffffff'
                : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'),
            }}
            aria-label="English"
          >
            EN
          </button>
          <button
            onClick={() => i18n.changeLanguage('ar')}
            className="px-3 h-9 text-xs font-bold transition-all duration-200"
            style={{
              background: i18n.language === 'ar'
                ? (isDark ? 'rgba(8,145,178,0.6)' : '#0891b2')
                : 'transparent',
              color: i18n.language === 'ar'
                ? '#ffffff'
                : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'),
            }}
            aria-label="Arabic"
          >
            ع
          </button>
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
            border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)',
          }}
          aria-label="Toggle theme"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-6xl overflow-hidden flex flex-col md:flex-row shadow-2xl"
        style={{
          minHeight: '700px',
          borderRadius: '24px',
          background: isDark ? 'rgba(10,15,30,0.6)' : 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.5)',
          boxShadow: isDark
            ? '0 32px 80px rgba(0,0,0,0.6)'
            : '0 32px 80px rgba(0,0,0,0.15)',
        }}
      >
        {/* ── LEFT PANEL (desktop only) ──────────────────────────────────── */}
        <div
          className="hidden md:flex flex-col overflow-hidden"
          style={{
            width: '41.666667%',
            position: 'relative',
            background: '#ffffff',
            borderRight: '1px solid rgba(0,0,0,0.08)',
            flexShrink: 0,
          }}
        >
          {/* Top half: image slideshow — always white so mix-blend-mode:multiply renders correctly */}
          <div className="relative overflow-hidden" style={{ flex: '0 0 50%', background: '#ffffff' }}>
            {IMAGES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '75%',
                  height: '75%',
                  margin: 'auto',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  objectFit: 'contain',
                  mixBlendMode: 'multiply',
                  opacity: i === imgIdx ? 1 : 0,
                  transition: 'opacity 0.8s ease',
                }}
              />
            ))}
            {/* Gradient overlay at boundary */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '14rem',
                background: 'linear-gradient(to bottom, transparent, #2563eb)',
                zIndex: 2,
              }}
            />
          </div>

          {/* Bottom half: blue gradient with text */}
          <div
            className="flex flex-col justify-between p-8"
            style={{
              flex: '0 0 50%',
              background: 'linear-gradient(to bottom, #2563eb, #1e3a8a)',
              zIndex: 1,
            }}
          >
            <div>
              <h2
                className="font-bold text-white mb-3"
                style={{ fontSize: '1.5rem', letterSpacing: '-0.5px' }}
              >
                {t('login.welcomeTitle')}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {t('login.welcomeDesc')}
              </p>
            </div>

            {/* Dot navigation */}
            <div className="flex items-center gap-2 mt-6">
              {IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImgIdx(i)}
                  style={{
                    width: i === imgIdx ? '20px' : '6px',
                    height: '6px',
                    borderRadius: '3px',
                    background: i === imgIdx ? '#ffffff' : 'rgba(255,255,255,0.35)',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                  aria-label={`Go to image ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: form ─────────────────────────────────────────── */}
        <div
          className="flex-1 flex flex-col items-center justify-center p-8 md:p-12"
          style={{
            background: isDark ? 'rgba(10,15,30,0.0)' : 'transparent',
          }}
        >
          <div className="w-full" style={{ maxWidth: '400px' }}>

            {/* Logo */}
            <div className="flex items-center gap-2 mb-8">
              <img
                src="/src/assets/logo.png"
                alt="ExamGen logo"
                style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
              />
              <span
                className="font-bold text-xl"
                style={{ color: isDark ? '#ffffff' : '#0f172a' }}
              >
                ExamGen
              </span>
            </div>

            {/* Heading */}
            <h1
              className="font-bold mb-1"
              style={{
                fontSize: '1.75rem',
                letterSpacing: '-0.5px',
                color: isDark ? '#38bdf8' : '#0369a1',
              }}
            >
              {mode === 'login' ? t('login.title') : t('login.createAccount')}
            </h1>

            {/* Toggle link */}
            <p className="text-sm mb-7" style={{ color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.65)' }}>
              {mode === 'login' ? (
                <>
                  {t('login.noAccount')}{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="font-semibold underline-offset-2 hover:underline"
                    style={{ color: '#0891b2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {t('login.createOne')}
                  </button>
                </>
              ) : (
                <>
                  {t('login.hasAccount')}{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="font-semibold underline-offset-2 hover:underline"
                    style={{ color: '#0891b2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {t('login.signIn')}
                  </button>
                </>
              )}
            </p>

            {/* ── Email verification banner ── */}
            {verifyPending && (
              <div style={{
                marginBottom: 16, padding: '12px 16px', borderRadius: 12,
                background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.35)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>✉️</span>
                <div>
                  <p style={{ color: isDark ? '#93c5fd' : '#1d4ed8', fontWeight: 600, fontSize: 13, margin: 0 }}>
                    {t('login.checkEmail')}
                  </p>
                  <p style={{ color: isDark ? 'rgba(147,197,253,0.7)' : 'rgba(29,78,216,0.7)', fontSize: 12, margin: '2px 0 0' }}>
                    {t('login.activationSent', { email })}
                  </p>
                </div>
                <button onClick={() => setVerifyPending(false)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(147,197,253,0.6)', fontSize: 16, flexShrink: 0 }}>✕</button>
              </div>
            )}

            {/* ── LOGIN FORM ──────────────────────────────────────────────── */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <InputField
                  label={t('login.emailAddress')}
                  icon={<MailIcon />}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  autoComplete="email"
                  required
                  isDark={isDark}
                />

                <InputField
                  label={t('login.password')}
                  icon={<LockIcon />}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  isDark={isDark}
                />

                {/* Remember me + forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none"
                    style={{ color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)' }}>
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                      className="rounded" style={{ accentColor: '#0891b2', width: '14px', height: '14px' }} />
                    {t('login.rememberPassword')}
                  </label>
                  <button type="button" onClick={() => { setForgotStep(1); setForgotEmail(email); }}
                    className="text-sm font-semibold hover:underline underline-offset-2"
                    style={{ color: '#0891b2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {t('login.forgotPassword')}
                  </button>
                </div>

                <SubmitButton loading={loading} label={t('login.signInBtn')} isDark={isDark} />

                {GOOGLE_CLIENT_ID && <GoogleDivider isDark={isDark} />}
                {GOOGLE_CLIENT_ID && <div ref={googleBtnRef} style={{ width: '100%' }} />}
              </form>
            )}

            {/* ── REGISTER FORM ───────────────────────────────────────────── */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    label={t('login.firstName')}
                    icon={<UserIcon />}
                    type="text"
                    value={form.first_name}
                    onChange={set('first_name')}
                    placeholder="Meriem"
                    autoComplete="given-name"
                    required
                    isDark={isDark}
                  />
                  <InputField
                    label={t('login.lastName')}
                    icon={<UserIcon />}
                    type="text"
                    value={form.last_name}
                    onChange={set('last_name')}
                    placeholder="Doe"
                    autoComplete="family-name"
                    required
                    isDark={isDark}
                  />
                </div>

                <InputField
                  label={t('login.emailAddress')}
                  icon={<MailIcon />}
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@school.edu"
                  autoComplete="email"
                  required
                  isDark={isDark}
                />

                <InputField
                  label={t('login.password')}
                  icon={<LockIcon />}
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  required
                  isDark={isDark}
                />

                <SubmitButton loading={loading} label={t('login.createAccount')} isDark={isDark} />

                {GOOGLE_CLIENT_ID && <GoogleDivider isDark={isDark} />}
                {GOOGLE_CLIENT_ID && <div ref={googleBtnRef} style={{ width: '100%' }} />}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ── Forgot Password Modal ── */}

    {forgotStep > 0 && (
      <div style={{ position:'fixed', inset:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)' }}>
        <div style={{ width:'100%', maxWidth:400, borderRadius:20, padding:32, background: isDark ? '#0f1729' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)', boxShadow:'0 24px 60px rgba(0,0,0,0.4)' }}>

          {/* Close */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
            <h2 style={{ margin:0, fontSize:18, fontWeight:700, color: isDark ? '#fff' : '#0f172a' }}>
              {forgotStep === 1 ? t('login.forgotTitle') : forgotStep === 2 ? t('login.enterCodeTitle') : t('login.resetTitle')}
            </h2>
            <button onClick={() => { setForgotStep(0); setResetCode(''); setNewPass(''); }}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>✕</button>
          </div>

          {/* Step 1 — enter email */}
          {forgotStep === 1 && (
            <form onSubmit={handleForgotSendCode} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <p style={{ margin:0, fontSize:13, color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.65)' }}>
                {t('login.forgotDesc')}
              </p>
              <InputField label={t('login.emailAddress')} icon={<MailIcon />} type="email"
                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                placeholder="you@school.edu" required isDark={isDark} />
              <SubmitButton loading={loading} label={t('login.sendCode')} isDark={isDark} />
            </form>
          )}

          {/* Step 2 — enter code only */}
          {forgotStep === 2 && (
            <form onSubmit={handleForgotVerifyCode} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <p style={{ margin:0, fontSize:13, color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.65)' }}>
                {t('login.codeSentTo')} <strong style={{ color: isDark ? '#93c5fd' : '#1d4ed8' }}>{forgotEmail}</strong>
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>{t('login.code')}</label>
                <input value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder="_ _ _ _ _ _" required maxLength={6} autoFocus
                  style={{ padding:'11px 14px', borderRadius:10, fontSize:22, fontWeight:700, letterSpacing:10, textAlign:'center', outline:'none', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: isDark ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px solid rgba(0,0,0,0.12)', color: isDark ? '#fff' : '#0f172a' }} />
              </div>
              <SubmitButton loading={loading} label={t('login.verifyCode')} isDark={isDark} />
              <button type="button" onClick={() => setForgotStep(1)}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)', textAlign:'center' }}>
                {t('login.didntReceive')}
              </button>
            </form>
          )}

          {/* Step 3 — set new password */}
          {forgotStep === 3 && (
            <form onSubmit={handleForgotReset} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <p style={{ margin:0, fontSize:13, color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.65)' }}>
                {t('login.codeVerified')} <strong style={{ color: isDark ? '#93c5fd' : '#1d4ed8' }}>{forgotEmail}</strong>
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>{t('login.newPassword')}</label>
                <div style={{ position:'relative' }}>
                  <input type={newPassShow ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
                    placeholder="••••••••" required minLength={6} autoFocus
                    style={{ width:'100%', padding:'11px 40px 11px 14px', borderRadius:10, fontSize:14, outline:'none', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: isDark ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px solid rgba(0,0,0,0.12)', color: isDark ? '#fff' : '#0f172a', boxSizing:'border-box' }} />
                  <button type="button" onClick={() => setNewPassShow(v=>!v)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', display:'flex' }}>
                    {newPassShow ? <EyeIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>
              <SubmitButton loading={loading} label={t('login.setNewPassword')} isDark={isDark} />
            </form>
          )}
        </div>
      </div>
    )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InputField({ label, icon, isDark, type, ...inputProps }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const isPassword = type === 'password';
  const [showPassword, setShowPassword] = useState(false);
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const iconSide   = isRTL ? 'right' : 'left';
  const toggleSide = isRTL ? 'left'  : 'right';
  const iconPad    = '36px';
  const otherPad   = isPassword ? '40px' : '14px';
  const paddingInline = isRTL
    ? `11px ${iconPad} 11px ${otherPad}`
    : `11px ${otherPad} 11px ${iconPad}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.60)', letterSpacing: '0.07em' }}
      >
        {label}
      </label>
      <div className="relative flex items-center">
        <span
          className="absolute pointer-events-none"
          style={{
            [iconSide]: '12px',
            color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)',
          }}
        >
          {icon}
        </span>
        <input
          {...inputProps}
          type={inputType}
          className="auth-field-input"
          style={{
            width: '100%',
            padding: paddingInline,
            borderRadius: '10px',
            fontSize: '14px',
            outline: 'none',
            transition: 'all 0.2s ease',
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: isDark ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px solid rgba(0,0,0,0.12)',
            color: isDark ? '#ffffff' : '#0f172a',
            textAlign: isRTL ? 'right' : 'left',
          }}
          onFocus={e => {
            e.target.style.borderColor = '#0891b2';
            e.target.style.boxShadow = '0 0 0 3px rgba(8,145,178,0.12)';
          }}
          onBlur={e => {
            e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';
            e.target.style.boxShadow = 'none';
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute"
            style={{
              [toggleSide]: '12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              color: isDark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.50)',
              display: 'flex',
              alignItems: 'center',
            }}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeIcon /> : <EyeOffIcon />}
          </button>
        )}
      </div>
    </div>
  );
}

function SubmitButton({ loading, label, isDark }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 font-bold text-white transition-all duration-200"
      style={{
        padding: '12px 20px',
        borderRadius: '10px',
        fontSize: '15px',
        marginTop: '4px',
        border: 'none',
        cursor: loading ? 'default' : 'pointer',
        background: loading
          ? 'rgba(8,145,178,0.4)'
          : 'linear-gradient(135deg, #0891b2, #0e7490)',
        boxShadow: loading ? 'none' : '0 4px 16px rgba(8,145,178,0.3)',
        opacity: loading ? 0.7 : 1,
        transform: 'translateY(0)',
      }}
      onMouseEnter={e => {
        if (!loading) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(8,145,178,0.4)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 16px rgba(8,145,178,0.3)';
      }}
    >
      {loading ? (
        <>
          <span
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          Processing...
        </>
      ) : (
        <>
          {label} <ArrowRightIcon />
        </>
      )}
    </button>
  );
}

function GoogleDivider({ isDark }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <div style={{ flex: 1, height: 1, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
      <span style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', whiteSpace: 'nowrap' }}>{t('login.orContinueWith')}</span>
      <div style={{ flex: 1, height: 1, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
    </div>
  );
}
