import { useEffect, useState } from 'react';

export default function Toast({ message, type = 'success', onClose, duration = 5000 }) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(onClose, 280);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const accent = {
    success: { border: 'rgba(52,211,153,0.55)',  glow: 'rgba(52,211,153,0.18)',  iconColor: '#34d399',
      svg: <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    error:   { border: 'rgba(248,113,113,0.55)', glow: 'rgba(248,113,113,0.18)', iconColor: '#f87171',
      svg: <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><line x1="1" y1="1" x2="10" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="10" y1="1" x2="1" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
    warning: { border: 'rgba(251,191,36,0.55)',  glow: 'rgba(251,191,36,0.18)',  iconColor: '#fbbf24',
      svg: <svg width="12" height="11" viewBox="0 0 12 11" fill="none"><path d="M6 1L11 10H1L6 1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><line x1="6" y1="4" x2="6" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="6" cy="8.5" r="0.7" fill="currentColor"/></svg> },
    info:    { border: 'rgba(96,165,250,0.55)',  glow: 'rgba(96,165,250,0.18)',  iconColor: '#60a5fa',
      svg: <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.8"/><line x1="5.5" y1="5" x2="5.5" y2="8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="5.5" cy="3.5" r="0.7" fill="currentColor"/></svg> },
  }[type] || {};

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        animation: isLeaving ? 'toastOut 0.28s ease forwards' : 'toastIn 0.28s ease',
      }}
    >
      <style>{`
        @keyframes toastIn  { from { opacity:0; transform:translateX(24px) scale(0.96); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes toastOut { from { opacity:1; transform:translateX(0) scale(1); } to { opacity:0; transform:translateX(24px) scale(0.96); } }
        @keyframes toastBar { from { width:100%; } to { width:0%; } }
      `}</style>

      <div
        onClick={() => { setIsLeaving(true); setTimeout(onClose, 280); }}
        style={{
          minWidth: '280px',
          maxWidth: '380px',
          padding: '12px 16px',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          background: 'rgba(10, 15, 40, 0.55)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${accent.border}`,
          boxShadow: `0 8px 32px ${accent.glow}, 0 2px 8px rgba(0,0,0,0.3)`,
        }}
      >
        {/* Icon */}
        <span style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: accent.glow, border: `1px solid ${accent.border}`,
          color: accent.iconColor, fontWeight: 700, fontSize: 13,
        }}>
          {accent.svg}
        </span>

        {/* Message */}
        <span style={{
          flex: 1, fontSize: '13px', fontWeight: 500,
          color: 'rgba(255,255,255,0.9)', lineHeight: 1.4,
        }}>
          {message}
        </span>

        {/* Close */}
        <button
          style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)', width: 20, height: 20, borderRadius: '50%',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, flexShrink: 0,
          }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/></svg>
        </button>

        {/* Progress bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, height: '2px',
          background: accent.border,
          animation: `toastBar ${duration}ms linear forwards`,
          borderRadius: '0 0 14px 14px',
        }} />
      </div>
    </div>
  );
}
