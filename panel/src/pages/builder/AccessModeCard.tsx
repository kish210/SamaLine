import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, formsApi } from '../../api';

interface Props {
  formId: string;
  /** حالت فعلیِ احراز روی انتشارِ لینک. */
  authMode: string;
  /** فرم بخشی است یا نظرسنجیِ عمومی. */
  hasDepartment: boolean;
}

type Mode = 'none' | 'password' | 'staff';

const LABELS: Record<Mode, string> = {
  none: 'باز برای همه (نظرسنجی)',
  password: 'با رمز عبور مشترک',
  staff: 'ورود کارمند (فرم عملیاتی)',
};

/**
 * تعیین اینکه چه کسی می‌تواند فرم را پر کند.
 *
 * حالت «کارمند» همان حساب پنل را می‌خواهد؛ سرور از روی آن می‌فهمد کدام
 * کارمند و عضوِ کدام بخش است و گزارش به نام خودش ثبت می‌شود. حالت‌های
 * otp/oauth/ldap اینجا نیامده‌اند چون برای کار روزمره‌ی هتل لازم نیستند و
 * فهرست را شلوغ می‌کنند؛ از API همچنان قابل تنظیم‌اند.
 */
export function AccessModeCard({ formId, authMode, hasDepartment }: Props) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current: Mode =
    authMode === 'staff' || authMode === 'password'
      ? (authMode as Mode)
      : 'none';

  const save = useMutation({
    mutationFn: (mode: Mode) =>
      formsApi.setAuthMode(
        formId,
        mode,
        mode === 'password' ? password : undefined,
      ),
    onSuccess: async () => {
      setError(null);
      setPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
    onError: (err) => setError(describeError(err)),
  });

  return (
    <section className="card">
      <div className="section-head">
        <h3>چه کسی می‌تواند پر کند؟</h3>
        {saved && <span className="saved">ذخیره شد</span>}
      </div>

      {error && <p className="error">{error}</p>}

      <label>
        <span className="field-label">حالت دسترسی</span>
        <select
          value={current}
          onChange={(e) => {
            const next = e.target.value as Mode;
            // رمز باید همراه همان درخواست برود، وگرنه سرور ردش می‌کند.
            if (next === 'password' && !password.trim()) {
              setError('برای حالت رمز عبور، اول رمز را بنویسید.');
              return;
            }
            save.mutate(next);
          }}
          disabled={save.isPending}
        >
          {(Object.keys(LABELS) as Mode[]).map((mode) => (
            <option key={mode} value={mode}>
              {LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="field-label">رمز (فقط برای حالت رمز عبور)</span>
        <input
          type="password"
          value={password}
          placeholder="دست‌کم ۴ نویسه"
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {current === 'staff' && !hasDepartment && (
        <p className="hint">
          این فرم بخش ندارد، پس هر کارمندِ واردشده‌ی سازمان می‌تواند پرش کند.
          برای محدود کردن به یک بخش، در «ظاهر فرم» بخشش را تعیین کنید.
        </p>
      )}

      {current === 'staff' && hasDepartment && (
        <p className="hint">
          فقط اعضای بخشِ این فرم (و مدیران) می‌توانند پرش کنند و هر گزارش به
          نام خودِ کارمند ثبت می‌شود.
        </p>
      )}
    </section>
  );
}
