import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: 'fa',
  fallbackLng: 'fa',
  resources: {
    fa: {
      translation: {
        loading: 'در حال بارگذاری...',
        submit: 'ثبت پاسخ',
        done: 'پاسخ شما با موفقیت ثبت شد.',
      },
    },
  },
});

export default i18n;
