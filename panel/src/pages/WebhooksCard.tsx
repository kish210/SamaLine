import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, webhooksApi } from '../api';

/**
 * وبهوک: اتصال بی‌درنگ به نرم‌افزارهای دیگر.
 *
 * با هر پاسخ کامل، سرور یک درخواست POST با بدنه‌ی JSON به نشانی مقصد
 * می‌فرستد. اگر مقصد در دسترس نباشد تا پنج بار دوباره تلاش می‌شود.
 */
export function WebhooksCard() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shownSecret, setShownSecret] = useState<string | null>(null);

  const hooks = useQuery({ queryKey: ['webhooks'], queryFn: webhooksApi.list });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['webhooks'] });

  const create = useMutation({
    mutationFn: () => webhooksApi.create(url.trim()),
    onSuccess: async () => {
      setUrl('');
      setError(null);
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const remove = useMutation({
    mutationFn: webhooksApi.remove,
    onSuccess: refresh,
    onError: (err) => setError(describeError(err)),
  });

  return (
    <section className="card">
      <h3>وبهوک</h3>
      <p className="hint">
        با هر پاسخ کامل، پاسخ‌ها به‌صورت JSON به نشانی زیر فرستاده می‌شوند
        (رویداد <code dir="ltr">response.completed</code>). گیرنده می‌تواند
        اصالت درخواست را با سربرگ <code dir="ltr">X-SamaLine-Signature</code>
        بسنجد: <code dir="ltr">sha256=HMAC-SHA256(راز، بدنه‌ی خام)</code>.
      </p>

      {hooks.data && hooks.data.length > 0 && (
        <div className="table-scroll">
          <table>
            <tbody>
              {hooks.data.map((hook) => (
                <tr key={hook.id}>
                  <td dir="ltr">{hook.targetUrl}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      style={{ width: 'auto' }}
                      onClick={() =>
                        setShownSecret(shownSecret === hook.id ? null : hook.id)
                      }
                    >
                      {shownSecret === hook.id ? 'پنهان کردن راز' : 'نمایش راز'}
                    </button>
                    {shownSecret === hook.id && (
                      <code dir="ltr" className="secret-code">
                        {hook.secret}
                      </code>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      style={{ width: 'auto' }}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(hook.id)}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="inline-form">
        <input
          dir="ltr"
          type="url"
          placeholder="https://example.com/samaline-hook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="button"
          disabled={!url.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          افزودن
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
