import { useCallback, useEffect, useRef, useState } from 'react';
import { formApi } from './api';
import { isNetworkError, offlineOutbox } from './offline-outbox';
import type { Answers, Page, PublicForm } from './types';

type View = 'start' | 'form' | 'end';

/** پارامترهای آدرس یک بار هنگام بارگذاری خوانده می‌شوند. */
function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const hidden: Record<string, string> = {};
  params.forEach((value, key) => {
    if (!['respondentKey', 'r', 'lang'].includes(key)) hidden[key] = value;
  });

  return {
    hiddenParams: hidden,
    // لینک‌های کمپین کلید گیرنده را در پارامتر `r` می‌فرستند.
    respondentKey: params.get('respondentKey') ?? params.get('r') ?? '',
    lang: params.get('lang'),
  };
}

/**
 * جریان پاسخ‌دهی به فرم.
 *
 * تمام تصمیم‌های منطقی (کدام سوال دیده شود، صفحه‌ی بعد کدام است)
 * از سرور می‌آید؛ اینجا فقط وضعیت رابط کاربری نگه داشته می‌شود.
 * پیش از این، رندرر نسخه‌ی دوم و ناقصی از موتور منطق را داشت که با
 * موتور سرور واگرا می‌شد.
 */
export function useFormFlow(token: string | undefined) {
  const [urlState] = useState(readUrlState);
  const [form, setForm] = useState<PublicForm | null>(null);
  const [page, setPageState] = useState<Page | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [view, setView] = useState<View>('start');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respondentKey, setRespondentKey] = useState(urlState.respondentKey);
  const [authMode, setAuthMode] = useState<string | null | undefined>(
    undefined,
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lang, setLang] = useState(urlState.lang ?? 'fa');
  const hiddenParams = urlState.hiddenParams;

  /*
   * شناسه‌ی صفحه‌ای که همین حالا نشان داده می‌شود.
   *
   * تازه‌سازی صفحه و رفتن به صفحه‌ی بعد می‌توانند هم‌زمان در راه باشند؛ اگر
   * پاسخِ تازه‌سازی بعد از جابه‌جایی برسد، صفحه‌ی قبلی را روی صفحه‌ی جدید
   * می‌نویسد و پاسخ‌دهنده به عقب پرت می‌شود. این ref مرجع تشخیص کهنگی است.
   */
  const currentPageIdRef = useRef<string | null>(null);

  /** ست کردن صفحه به‌همراه به‌روزرسانی شناسه‌ی مرجع. */
  const setCurrentPage = useCallback((next: Page | null) => {
    currentPageIdRef.current = next?.id ?? null;
    setPageState(next);
  }, []);

  // آخرین پاسخ‌ها برای فراخوانی‌های تاخیری، بدون وابسته کردن effectها.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const describeError = (err: unknown) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? 'خطا در ارتباط با سرور';

  // نوع احراز هویت پیش از بارگذاری فرم پرسیده می‌شود؛ فرم‌های رمزدار
  // تا پیش از ورود اصلا داده‌ای برنمی‌گردانند.
  useEffect(() => {
    if (!token) return;
    formApi
      .authInfo(token)
      .then((info) => setAuthMode(info.requiresAuth ? info.authMode : null))
      .catch(() => setAuthMode(null));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    // تا پیش از مشخص شدن نوع احراز هویت، درخواستی نمی‌زنیم؛ وگرنه
    // پاسخ ۴۰۱ به‌عنوان خطای فرم نمایش داده می‌شود.
    if (authMode === undefined) return;
    if (authMode && !authenticated) return;
    setLoading(true);
    formApi
      .get(token)
      .then((data) => {
        setError(null);
        setForm(data);
        const languages = data.settings?.languages ?? ['fa'];
        // زبان انتخاب‌شده در آدرس بر زبان پیش‌فرض فرم اولویت دارد.
        if (!urlState.lang) {
          setLang(String(languages[0] ?? 'fa'));
        }
        setView(data.settings?.startPageEnabled === false ? 'form' : 'start');
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false));
  }, [token, urlState.lang, authMode, authenticated]);

  // بازیابی پیشرفت ذخیره‌شده
  useEffect(() => {
    if (!token || !respondentKey) return;
    formApi
      .getProgress(token, respondentKey)
      .then((data) => {
        if (data.exists) {
          setAnswers(data.answers ?? {});
          setView('form');
        }
      })
      .catch(() => undefined);
  }, [token, respondentKey]);

  const loadFirstPage = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const step = await formApi.nextStep(token, {
        answers: answersRef.current,
        params: hiddenParams,
      });
      setScores(step.scores);
      if (step.finished || !step.page) {
        setView('end');
      } else {
        setCurrentPage(step.page);
        setHistory([]);
        setView('form');
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [token, hiddenParams, setCurrentPage]);

  /** صفحه‌ی جاری را با پاسخ‌های تازه بازخوانی می‌کند (منطق نمایش درون‌صفحه‌ای). */
  const refreshPage = useCallback(async () => {
    if (!token || !page) return;
    try {
      const data = await formApi.resolvePage(token, page.id, {
        answers: answersRef.current,
        params: hiddenParams,
      });
      // در فاصله‌ی رفت‌وبرگشت ممکن است به صفحه‌ی دیگری رفته باشیم؛
      // در آن صورت این پاسخ کهنه است و باید دور ریخته شود.
      if (currentPageIdRef.current !== page.id) return;
      setCurrentPage(data.page);
      setScores(data.scores);
    } catch {
      // شکست در تازه‌سازی نباید پاسخ‌دهی را متوقف کند.
    }
  }, [token, page, hiddenParams, setCurrentPage]);

  const goNext = useCallback(async () => {
    if (!token || !page) return null;
    setLoading(true);
    try {
      const step = await formApi.nextStep(token, {
        currentPageId: page.id,
        answers: answersRef.current,
        params: hiddenParams,
      });
      setScores(step.scores);

      if (step.finished || !step.page) return { finished: true };

      setHistory((prev) => [...prev, page.id]);
      setCurrentPage(step.page);
      return { finished: false };
    } catch (err) {
      setError(describeError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, page, hiddenParams, setCurrentPage]);

  /** بازگشت با تاریخچه‌ی واقعی مسیر، چون پرش‌ها ترتیب صفحات را می‌شکنند. */
  const goBack = useCallback(async () => {
    if (!token || history.length === 0) return;
    const previousId = history[history.length - 1];
    setLoading(true);
    try {
      const data = await formApi.resolvePage(token, previousId, {
        answers: answersRef.current,
        params: hiddenParams,
      });
      setCurrentPage(data.page);
      setScores(data.scores);
      setHistory((prev) => prev.slice(0, -1));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [token, history, hiddenParams, setCurrentPage]);

  const submit = useCallback(async () => {
    if (!token) return false;
    setLoading(true);
    const payload = {
      respondentKey: respondentKey || undefined,
      answers: answersRef.current,
      meta: { respondentKey, lang, params: hiddenParams },
    };

    try {
      await formApi.submit(token, payload);
      setView('end');
      return true;
    } catch (err) {
      // قطعی شبکه نباید پاسخِ پرشده را از بین ببرد؛ محلی نگه می‌داریم
      // و با برگشت اتصال خودکار می‌فرستیم.
      if (isNetworkError(err)) {
        offlineOutbox.add({ token, ...payload });
        setPendingCount(offlineOutbox.count());
        setView('end');
        return true;
      }
      setError(describeError(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, [token, respondentKey, lang, hiddenParams]);

  /** ارسال پاسخ‌های ذخیره‌شده‌ی آفلاین. */
  const flushOutbox = useCallback(async () => {
    for (const item of offlineOutbox.list()) {
      try {
        await formApi.submit(item.token, {
          respondentKey: item.respondentKey,
          answers: item.answers,
          meta: item.meta,
        });
        offlineOutbox.remove(item.id);
      } catch (err) {
        // هنوز آفلاین است؛ دفعه‌ی بعد دوباره تلاش می‌کنیم.
        if (isNetworkError(err)) break;
        // خطای منطقی سرور (مثل سقف پلن) با تلاش مجدد حل نمی‌شود.
        offlineOutbox.remove(item.id);
      }
    }
    setPendingCount(offlineOutbox.count());
  }, []);

  useEffect(() => {
    void flushOutbox();
    window.addEventListener('online', () => void flushOutbox());
    return () => window.removeEventListener('online', () => void flushOutbox());
  }, [flushOutbox]);

  const setAnswer = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  // ذخیره‌ی خودکار پیشرفت
  useEffect(() => {
    if (!token || !respondentKey || view !== 'form') return;
    if (form?.settings?.saveProgress === false) return;

    const timer = setTimeout(() => {
      void formApi
        .saveProgress(token, {
          respondentKey,
          answers,
          meta: { respondentKey, lang, params: hiddenParams },
        })
        .catch(() => undefined);
    }, 600);

    return () => clearTimeout(timer);
  }, [answers, form, hiddenParams, lang, respondentKey, token, view]);

  return {
    form,
    page,
    authMode,
    authenticated,
    markAuthenticated: (key: string | null) => {
      if (key) setRespondentKey(key);
      setAuthenticated(true);
    },
    answers,
    scores,
    view,
    loading,
    error,
    lang,
    respondentKey,
    canGoBack: history.length > 0,
    // پیشرفت تقریبی است چون پرش‌ها طول واقعی مسیر را از پیش معلوم
    // نمی‌کنند؛ ملاک، صفحات پیموده‌شده تا این لحظه است.
    progress: page
      ? Math.min(95, Math.round((history.length / (history.length + 2)) * 100))
      : null,
    pendingCount,
    setLang,
    setRespondentKey,
    setAnswer,
    loadFirstPage,
    refreshPage,
    goNext,
    goBack,
    submit,
    setView,
  };
}
