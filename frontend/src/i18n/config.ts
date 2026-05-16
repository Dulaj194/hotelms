import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enMenu from './locales/en/menu.json';
import enCart from './locales/en/cart.json';

import siCommon from './locales/si/common.json';
import siMenu from './locales/si/menu.json';
import siCart from './locales/si/cart.json';

const resources = {
  en: {
    common: enCommon,
    menu: enMenu,
    cart: enCart
  },
  si: {
    common: siCommon,
    menu: siMenu,
    cart: siCart
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Remove hardcoded 'lng' to allow LanguageDetector to work
    fallbackLng: 'en',
    ns: ['common', 'menu', 'cart'],
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
