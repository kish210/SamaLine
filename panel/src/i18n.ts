import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: 'fa',
  fallbackLng: 'fa',
  resources: {
    fa: {
      translation: {
        appTitle: 'سامالاین',
        login: 'ورود',
        register: 'ثبت نام',
        email: 'ایمیل',
        password: 'رمز عبور',
        fullName: 'نام کامل',
        orgName: 'نام سازمان',
        workspaceName: 'نام فضای کاری',
        logout: 'خروج',
        forms: 'فرم‌ها',
        createForm: 'ایجاد فرم',
        title: 'عنوان',
        slug: 'اسلاگ',
        publish: 'انتشار لینک',
        responses: 'پاسخ‌ها',
        exportExcel: 'خروجی اکسل',
      },
    },
  },
});

export default i18n;
