import { useState } from 'react';
import type { FormEvent } from 'react';
import { formApi, setRespondentToken } from './api';

interface Props {
  token: string;
  authMode: string;
  onAuthenticated: (respondentKey: string | null) => void;
}

const describe = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ?? 'خطا در ارتباط با سرور';

/** صفحه‌ی ورود پاسخ‌دهنده برای فرم‌های رمزدار یا کددار. */
export function RespondentAuth({ token, authMode, onAuthenticated }: Props) {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { accessToken } = await formApi.loginWithPassword(token, password);
      setRespondentToken(accessToken);
      onAuthenticated(null);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  /*
   * ورودِ کارمند: همان حسابِ پنل.
   *
   * اگر حسابِ کارمند ورودِ دومرحله‌ای داشته باشد، سرور به‌جای توکن
   * `twoFactorRequired` می‌دهد؛ آن‌وقت فیلد کد نشان داده می‌شود و همان
   * ایمیل/رمز دوباره با کد فرستاده می‌شود.
   */
  const submitStaff = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await formApi.staffLogin(
        email.trim(),
        password,
        needsTotp ? totpCode.trim() : undefined,
      );
      if (result.twoFactorRequired) {
        setNeedsTotp(true);
        setInfo('این حساب ورود دومرحله‌ای دارد؛ کد برنامه‌ی احراز را بزنید.');
        return;
      }
      if (!result.accessToken) {
        setError('ورود ناموفق بود');
        return;
      }
      setRespondentToken(result.accessToken);
      onAuthenticated(email.trim());
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await formApi.requestOtp(token, destination);
      setCodeSent(true);
      setInfo(
        `کد به ${result.channel === 'sms' ? 'شماره' : 'ایمیل'} شما ارسال شد و تا ${Math.round(result.expiresInSeconds / 60)} دقیقه معتبر است.`,
      );
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await formApi.verifyOtp(token, destination, code);
      setRespondentToken(result.accessToken);
      onAuthenticated(result.respondentKey);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <h2>{authMode === 'staff' ? 'ورود کارمند' : 'ورود به نظرسنجی'}</h2>

      {authMode === 'staff' && (
        <form onSubmit={submitStaff}>
          <p>این فرم عملیاتی است؛ با حساب کاربری خود وارد شوید.</p>
          <label htmlFor="staff-email">ایمیل</label>
          <input
            id="staff-email"
            type="email"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="staff-password">رمز عبور</label>
          <input
            id="staff-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {needsTotp && (
            <>
              <label htmlFor="staff-totp">کد ورود دومرحله‌ای</label>
              <input
                id="staff-totp"
                required
                inputMode="numeric"
                maxLength={6}
                dir="ltr"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
              />
            </>
          )}
          {info && <p className="hint">{info}</p>}
          <button type="submit" disabled={busy}>
            {busy ? '...' : 'ورود'}
          </button>
        </form>
      )}

      {authMode === 'password' && (
        <form onSubmit={submitPassword}>
          <p>این فرم با رمز عبور محافظت می‌شود.</p>
          <label htmlFor="respondent-password">رمز عبور</label>
          <input
            id="respondent-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? '...' : 'ورود'}
          </button>
        </form>
      )}

      {authMode === 'otp' && !codeSent && (
        <form onSubmit={sendCode}>
          <p>برای دریافت کد ورود، شماره موبایل یا ایمیل خود را وارد کنید.</p>
          <label htmlFor="respondent-destination">موبایل یا ایمیل</label>
          <input
            id="respondent-destination"
            required
            value={destination}
            placeholder="09121234567"
            onChange={(e) => setDestination(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? '...' : 'ارسال کد'}
          </button>
        </form>
      )}

      {authMode === 'otp' && codeSent && (
        <form onSubmit={submitCode}>
          {info && <p className="hint">{info}</p>}
          <label htmlFor="respondent-code">کد شش‌رقمی</label>
          <input
            id="respondent-code"
            required
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? '...' : 'تایید و ورود'}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              setCodeSent(false);
              setCode('');
              setInfo(null);
            }}
          >
            تغییر شماره
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
