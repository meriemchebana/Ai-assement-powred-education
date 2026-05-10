import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ar from './ar.json';

function applyDir(lang) {
  document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}

const savedLang = localStorage.getItem('lang') || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Sync direction + localStorage automatically on every language change
i18n.on('languageChanged', (lang) => {
  applyDir(lang);
  localStorage.setItem('lang', lang);
});

// Apply on first load
applyDir(savedLang);

export default i18n;
