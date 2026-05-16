import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import empty resource files for now (Phase 2 will populate these)
const resources = {
  en: {
    common: {},
    menu: {}
  },
  si: {
    common: {},
    menu: {}
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Force default to English
    fallbackLng: 'en',
    ns: ['common', 'menu'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'cookie', 'navigator'],
      caches: ['localStorage']
    }
  });

export default i18n;
