import { useCallback, useEffect, useRef, useState } from 'react';
import { formApi, setRespondentToken } from './api';
import { isNetworkError, offlineOutbox } from './offline-outbox';
import { randomKey, resolveRespondentKey } from './respondent-key';
import type { Answers, Page, PublicForm } from './types';

type View = 'start' | 'form' | 'end';

export interface FormFlowOptions {
  /**
   * حالت کیوسک: یک دستگاه مشترک برای پاسخ‌دهنده‌های پشت‌سرهم.
   *
   * هر نفر شناسه‌ی تازه می‌گیرد و پیشرفت ذخیره یا بازیابی نمی‌شود؛ وگرنه
   * نفر بعدی پاسخ‌های نفر قبلی را می‌دید و «جلوگیری از تکرار» همه را جز
   * نفر اول رد می‌کرد.
   */
  kiosk?: boolean;
}

/**
 * جلوگیری از ارسال هم‌زمان صندوق آفلاین.
 *
 * چند فراخوانی هم‌زمان (رویداد online + بارگذاری دوباره‌ی جلسه‌ی کیوسک)
 * یک پاسخ ذخیره‌شده را دو بار می‌فرستادند.
 */
let flushing = false;

/** پارامترهای آدرس یک بار هنگام بارگذاری خوانده می‌شوند. */
function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const hidden: Record<string, string> = {};
  params.forEach((value, key) => {
    // reset و idle تنظیم کیوسک‌اند، نه پارامتر مخفی فرم.
    if (!['respondentKey', 'r', 'lang', 'reset', 'idle', 'rt'].includes(key)) {
      hidden[key] = value;
    }
  });

  /*
   * توکنِ هویتِ رباتِ پرسنلی از قطعه‌ی آدرس (#rt=…) خوانده می‌شود، نه از
   * کوئری: قطعه به سرور/لاگ/Referer نمی‌رود، پس توکن نشت نمی‌کند. برای
   * سازگاری، ?rt= هم پذیرفته می‌شود.
   */
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, ''),
  );
  const respondentToken = hashParams.get('rt') ?? params.get('rt') ?? '';

  return {
    hiddenParams: hidden,
    // لینک‌های کمپین کلید گیرنده را در پارامتر `r` می‌فرستند.
    respondentKey: params.get('respondentKey') ?? params.get('r') ?? '',
    lang: params.get('lang'),
    respondentToken,
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
export function useFormFlow(
  token: string | undefined,
  options: FormFlowOptions = {},
) {
  const kiosk = Boolean(options.kiosk);
  const [urlState] = useState(readUrlState);
  const [form, setForm] = useState<PublicForm | null>(null);
  const [page, setPageState] = useState<Page | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [scores, setScores] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [view, setView] = useState<View>('start');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
   * شناسه‌ی پاسخ‌دهنده را سیستم می‌سازد؛ از خود پاسخ‌دهنده پرسیده نمی‌شود.
   *
   * setter بیرون داده نمی‌شود و فقط پس از ورود موفق (که سرور شناسه‌ی
   * واقعی مخاطب را برمی‌گرداند) از داخل همین هوک عوض می‌شود.
   */
  const [respondentKey, setRespondentKey] = useState(() =>
    kiosk ? randomKey() : resolveRespondentKey(token, urlState.respondentKey),
  );
  const [authMode, setAuthMode] = useState<string | null | undefined>(
    undefined,
  );
  /*
   * لینکِ رباتِ پرسنلی توکنِ هویت را همراه دارد؛ پس دروازه‌ی ورود رد می‌شود و
   * فرم مستقیم با همان توکن باز می‌شود (سرور هویت را از توکن می‌گیرد).
   */
  const [authenticated, setAuthenticated] = useState(
    Boolean(urlState.respondentToken),
  );

  // توکنِ هویتِ ربات را همان ابتدا روی هدرِ درخواست‌ها می‌نشانیم.
  useEffect(() => {
    if (urlState.respondentToken) setRespondentToken(urlState.respondentToken);
  }, [urlState.respondentToken]);
  const [pendingCount, setPendingCount] = useState(0);
  /*
   * قطعی شبکه هنگام رفتن بین صفحات.
   *
   * منطق فرم سمت سرور است، پس گام بعد بدون شبکه معلوم نمی‌شود. پیش از این
   * همین خطا کل فرم را با صفحه‌ی خطا عوض می‌کرد و پاسخ‌های پرشده عملا از
   * دست می‌رفت؛ حالا فرم و پاسخ‌ها سر جایشان می‌مانند و فقط پیام می‌آید.
   */
  const [networkIssue, setNetworkIssue] = useState(false);

  /** خطای شبکه فقط پیام گذرا می‌دهد؛ خطای واقعی سرور صفحه‌ی خطا. */
  const handleStepError = useCallback((err: unknown) => {
    if (isNetworkError(err)) {
      setNetworkIssue(true);
      return;
    }
    setError(describeError(err));
  }, []);
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
    if (!token || !respondentKey || kiosk) return;
    formApi
      .getProgress(token, respondentKey)
      .then((data) => {
        if (data.exists) {
          setAnswers(data.answers ?? {});
          setView('form');
        }
      })
      .catch(() => undefined);
  }, [token, respondentKey, kiosk]);

  const loadFirstPage = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const step = await formApi.nextStep(token, {
        answers: answersRef.current,
        params: hiddenParams,
      });
      setNetworkIssue(false);
      setScores(step.scores);
      if (step.finished || !step.page) {
        setView('end');
      } else {
        setCurrentPage(step.page);
        setHistory([]);
        setView('form');
      }
    } catch (err) {
      handleStepError(err);
    } finally {
      setLoading(false);
    }
  }, [token, hiddenParams, setCurrentPage, handleStepError]);

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
      setNetworkIssue(false);
      setScores(step.scores);

      if (step.finished || !step.page) return { finished: true };

      setHistory((prev) => [...prev, page.id]);
      setCurrentPage(step.page);
      return { finished: false };
    } catch (err) {
      handleStepError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, page, hiddenParams, setCurrentPage, handleStepError]);

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
      setNetworkIssue(false);
      setCurrentPage(data.page);
      setScores(data.scores);
      setHistory((prev) => prev.slice(0, -1));
    } catch (err) {
      handleStepError(err);
    } finally {
      setLoading(false);
    }
  }, [token, history, hiddenParams, setCurrentPage, handleStepError]);

  const submit = useCallback(async () => {
    if (!token) return false;
    setLoading(true);
    const payload = {
      respondentKey: respondentKey || undefined,
      answers: answersRef.current,
      meta: {
        respondentKey,
        lang,
        params: hiddenParams,
        ...(kiosk ? { kiosk: true } : {}),
      },
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
  }, [token, respondentKey, lang, hiddenParams, kiosk]);

  /** ارسال پاسخ‌های ذخیره‌شده‌ی آفلاین. */
  const flushOutbox = useCallback(async () => {
    if (flushing) return;
    flushing = true;
    try {
      await sendPending();
    } finally {
      flushing = false;
    }
    setPendingCount(offlineOutbox.count());
  }, []);

  useEffect(() => {
    const onOnline = () => void flushOutbox();
    void flushOutbox();
    window.addEventListener('online', onOnline);
    /*
     * رویداد online همیشه قابل اتکا نیست (مثلا وقتی وای‌فای وصل است ولی
     * اینترنت نه). کیوسک ساعت‌ها روشن می‌ماند، پس دوره‌ای هم تلاش می‌کند.
     */
    const timer = kiosk ? setInterval(onOnline, 60_000) : null;
    return () => {
      // باید همان تابع ثبت‌شده برداشته شود؛ تابع تازه هیچ‌چیز را برنمی‌دارد.
      window.removeEventListener('online', onOnline);
      if (timer) clearInterval(timer);
    };
  }, [flushOutbox, kiosk]);

  const setAnswer = useCallback((questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  // ذخیره‌ی خودکار پیشرفت
  useEffect(() => {
    if (!token || !respondentKey || view !== 'form' || kiosk) return;
    if (form?.settings?.saveProgress === false) return;
    /*
     * باز کردن فرم بدون پاسخ دادن، پیش‌نویس نمی‌سازد.
     *
     * پیش از این هر بازدید یک پاسخ «ناقص» خالی ثبت می‌کرد که آمار
     * «شروع‌شده» را بالا و نرخ تکمیل را پایین نشان می‌داد.
     */
    if (Object.keys(answers).length === 0) return;

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
  }, [answers, form, hiddenParams, lang, respondentKey, token, view, kiosk]);

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
    networkIssue,
    setLang,
    setAnswer,
    loadFirstPage,
    refreshPage,
    goNext,
    goBack,
    submit,
    setView,
  };
}

/** ارسال تک‌تک پاسخ‌های صندوق آفلاین تا اولین خطای شبکه. */
async function sendPending() {
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
}
