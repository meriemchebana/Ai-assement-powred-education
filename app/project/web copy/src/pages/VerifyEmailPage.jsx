import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';

export default function VerifyEmailPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const { t }      = useTranslation();
  const [status, setStatus] = useState('loading'); // loading | success | error

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('error'); return; }
    authAPI.verifyEmail(token)
      .then(() => { setStatus('success'); setTimeout(() => navigate('/login'), 3000); })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0f1e, #020840)',
    }}>
      <div style={{
        textAlign: 'center', padding: '48px 40px', borderRadius: '24px',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        maxWidth: 400, width: '100%',
      }}>
        {status === 'loading' && (
          <>
            <div style={{ width: 48, height: 48, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#2563eb', borderRadius: '50%', margin: '0 auto 24px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{t('verify.desc')}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div style={{ width: 64, height: 64, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✓</div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t('verify.title')}</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{t('verify.success')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>✗</div>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{t('verify.failed')}</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 }}>{t('verify.failed')}</p>
            <button onClick={() => navigate('/login')}
              style={{ padding: '10px 28px', background: 'linear-gradient(135deg,#2563eb,#0891b2)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              {t('verify.goToLogin')}
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
