import { RENDERER_BASE } from '../../renderer-url';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, formsApi } from '../../api';

interface Props {
  formId: string;
  token: string;
  currentSlug: string | null;
}



/**
 * نشانی ثابت و خواندنی فرم.
 *
 * لینک توکنی همیشه معتبر می‌ماند؛ این نشانی یک راه ورود اضافه است که
 * می‌توان روی بروشور، بنر یا پیامک گذاشت.
 */
export function CustomLinkCard({ formId, token, currentSlug }: Props) {
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState(currentSlug ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => formsApi.setSlug(formId, slug),
    onSuccess: async (publication) => {
      setError(null);
      setMessage('نشانی اختصاصی ثبت شد');
      setSlug(publication.slug ?? slug);
      await queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
    onError: (err) => {
      setMessage(null);
      setError(describeError(err));
    },
  });

  const check = useMutation({
    mutationFn: () => formsApi.slugAvailability(slug),
    onSuccess: (result) => {
      setError(result.available ? null : (result.reason ?? 'نشانی آزاد نیست'));
      setMessage(result.available ? 'این نشانی آزاد است' : null);
    },
    onError: (err) => setError(describeError(err)),
  });

  const tokenUrl = `${RENDERER_BASE}/f/${token}`;
  const slugUrl = currentSlug ? `${RENDERER_BASE}/f/${currentSlug}` : null;

  return (
    <section className="card">
      <h3>نشانی فرم</h3>

      <dl className="info-list">
        <dt>لینک پیش‌فرض</dt>
        <dd>
          <a href={tokenUrl} target="_blank" rel="noreferrer">
            {tokenUrl}
          </a>
        </dd>
        {slugUrl && (
          <>
            <dt>لینک اختصاصی</dt>
            <dd>
              <a href={slugUrl} target="_blank" rel="noreferrer">
                {slugUrl}
              </a>
            </dd>
          </>
        )}
      </dl>

      <label>
        نشانی اختصاصی — فقط حروف کوچک انگلیسی، رقم و خط تیره
        <div className="inline-form">
          <span className="url-prefix">{RENDERER_BASE}/f/</span>
          <input
            value={slug}
            placeholder="nazarsanji-1405"
            onChange={(e) => {
              setSlug(e.target.value);
              setMessage(null);
              setError(null);
            }}
          />
        </div>
      </label>

      <div className="inline-form">
        <button
          type="button"
          className="secondary"
          disabled={!slug.trim() || check.isPending}
          onClick={() => check.mutate()}
        >
          بررسی آزاد بودن
        </button>
        <button
          type="button"
          disabled={!slug.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          ثبت نشانی
        </button>
      </div>

      {message && <p className="hint success">{message}</p>}
      {error && <p className="error-line">{error}</p>}

      <p className="hint">
        لینک پیش‌فرض همیشه کار می‌کند؛ نشانی اختصاصی راه ورود اضافه است و
        لینک‌های پخش‌شده‌ی قبلی را نمی‌شکند.
      </p>
    </section>
  );
}
