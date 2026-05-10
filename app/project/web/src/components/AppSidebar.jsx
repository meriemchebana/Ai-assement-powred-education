import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';

export default function AppSidebar({ active, backTo, backLabel }) {
  const { user, logout }  = useAuth();
  const { theme, toggle } = useTheme();
  const { t, i18n }       = useTranslation();
  const navigate          = useNavigate();
  const isDark            = theme === 'dark';
  const isRTL             = i18n.language === 'ar';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const NAV = [
    { id: 'subjects',     label: t('nav.subjects'),     path: '/subjects',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
    { id: 'archive',      label: t('nav.archive'),      path: '/archive',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
    { id: 'exam-builder', label: t('nav.examBuilder'),  path: '/exam-builder',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg> },
    { id: 'profile',      label: t('nav.profile'),      path: '/profile',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  ];

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`.toUpperCase() || '?';

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col justify-between p-6 glass-card m-5 mr-0 border-none shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
      <div>
        {/* Brand */}
        <Link to="/subjects" style={{ textDecoration: 'none' }}
          className="flex items-center gap-3 mb-10 px-2">
          <img
            src="/src/assets/logo.png"
            alt="ExamGen logo"
            className="w-11 h-11 rounded-2xl object-cover shadow-lg flex-shrink-0"
          />
          <h1 className="text-[17px] font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-light-primary to-light-secondary dark:from-white dark:to-dark-accent">
            ExamGen
          </h1>
        </Link>

        {/* Back link */}
        {backTo && (
          <Link to={backTo} style={{ textDecoration: 'none' }}
            className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-xl text-xs font-bold text-light-text dark:text-dark-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-light-secondary dark:hover:text-white transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }}>
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            {backLabel || t('sidebar.back')}
          </Link>
        )}

        {/* Nav */}
        <nav className="space-y-1">
          {NAV.map(item => {
            const isActive = active === item.id;
            return (
              <Link key={item.id} to={item.path} style={{ textDecoration: 'none' }}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all font-bold text-sm
                  ${isActive
                    ? 'bg-light-primary/10 dark:bg-white/10 text-light-secondary dark:text-white'
                    : 'text-light-muted dark:text-dark-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-light-text dark:hover:text-white'
                  }`}>
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom */}
      <div className="space-y-2">

        {/* Language toggle */}
        <div className="flex items-center gap-1 px-4 py-2.5 rounded-2xl">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className="text-light-muted dark:text-dark-muted flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <button
            onClick={() => i18n.changeLanguage('en')}
            className={`flex-1 text-xs font-bold rounded-lg py-1 transition-all
              ${i18n.language === 'en'
                ? 'bg-blue-500 text-white'
                : 'text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-white'}`}>
            EN
          </button>
          <button
            onClick={() => i18n.changeLanguage('ar')}
            className={`flex-1 text-xs font-bold rounded-lg py-1 transition-all
              ${i18n.language === 'ar'
                ? 'bg-blue-500 text-white'
                : 'text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-white'}`}>
            ع
          </button>
        </div>

        {/* Theme toggle */}
        <button onClick={toggle}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-light-muted dark:text-dark-muted hover:bg-black/5 dark:hover:bg-white/5 transition-all font-bold text-sm">
          {isDark ? <SunIcon /> : <MoonIcon />}
          {isDark ? t('sidebar.lightMode') : t('sidebar.darkMode')}
        </button>

        {/* User */}
        <Link to="/profile" style={{ textDecoration: 'none' }}
          className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-all">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-light-primary/20 dark:border-white/10 flex-shrink-0">
            {user?.avatar
              ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-gradient-to-br from-light-primary to-light-secondary dark:from-dark-primary dark:to-dark-secondary flex items-center justify-center text-white font-extrabold text-base">
                  {initials}
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-light-text dark:text-white truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-light-muted dark:text-dark-muted font-medium">{t('sidebar.viewProfile')}</p>
          </div>
        </Link>

        {/* Sign out */}
        <button onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-red-500 dark:text-red-400 hover:bg-red-500/8 dark:hover:bg-red-400/10 transition-all font-bold text-sm">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {t('sidebar.signOut')}
        </button>
      </div>
    </aside>
  );
}

function SunIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
}

function MoonIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
}
