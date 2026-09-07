import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { describeError, telegramApi } from '../api';

/**
 * اتصال فضای کاری به ربات تلگرام.
 *
 * توکن ربات هیچ‌وقت از سرور برنمی‌گردد، پس فیلد توکن همیشه خالی باز می‌شود
 * و خالی ماندنش یعنی «همان توکن قبلی». این را در راهنمای زیر فیلد نوشته‌ایم
 * چون در غیر این صورت کاربر فکر می‌کند اتصال پاک شده است.
 */
export function TelegramCard({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [notifyOnResponse, setNotifyOnResponse] = useState(true);
  const [onlyLowScores, setOnlyLowScores] = useState(false);
  const [threshold, setThreshold] = useState(5);
  const [message, setMessage] = useState('');

  const settings = useQuery({
    queryKey: ['telegram', workspaceId],
    queryFn: () => telegramApi.get(workspaceId),
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    const data = settings.data;
    if (!data) return;
    setChatId(data.chatId);
    setNotifyOnResponse(data.notifyOnResponse);
    setOnlyLowScores(data.scoreThreshold !== null);
    if (data.scoreThreshold !== null) setThreshold(data.scoreThreshold);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      telegramApi.save(workspaceId, {
        botToken: botToken.trim() || undefined,
        chatId: chatId.trim(),
        notifyOnResponse,
        scoreThreshold: onlyLowScores ? threshold : null,
        isActive: true,
      }),
    onSuccess: () => {
      setBotToken('');
      setMessage('تنظیمات ذخیره شد.');
      void queryClient.invalidateQueries({ queryKey: ['telegram'] });
    },
    onError: (error) => setMessage(describeError(error)),
  });

  const test = useMutation({
    mutationFn: () => telegramApi.test(workspaceId),
    onSuccess: () => setMessage('پیام آزمایشی فرستاده شد؛ تلگرام را ببینید.'),
    onError: (error) => setMessage(describeError(error)),
  });

  const remove = useMutation({
    mutationFn: () => telegramApi.remove(workspaceId),
    onSuccess: () => {
      setChatId('');
      setBotToken('');
      setMessage('اتصال حذف شد.');
      void queryClient.invalidateQueries({ queryKey: ['telegram'] });
    },
  });

  const configured = settings.data?.configured ?? false;

  return (
    <section className="card">
      <h3>ربات تلگرام</h3>
      <p className="hint">
        با هر پاسخ کامل، خلاصه‌ی پاسخ در گفتگو یا گروه تلگرام شما فرستاده
        می‌شود. برای شروع، از <b>@BotFather</b> یک ربات بسازید، ربات را به
        گروه اضافه کنید و شناسه‌ی گفتگو را اینجا بگذارید.
      </p>

      <div className="form-grid">
        <label>
          <span className="field-label">توکن ربات</span>
          <input
            type="password"
            dir="ltr"
            autoComplete="off"
            placeholder={configured ? '••••••  (ذخیره‌شده)' : '123456:ABC-DEF…'}
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
          />
          <small className="hint">
            {configured
              ? 'خالی بگذارید تا توکن فعلی دست‌نخورده بماند.'
              : 'توکنی که BotFather می‌دهد.'}
          </small>
        </label>

        <label>
          <span className="field-label">شناسه‌ی گفتگو (chat id)</span>
          <input
            dir="ltr"
            placeholder="-1001234567890"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
          />
          <small className="hint">
            شناسه‌ی گروه با «-» شروع می‌شود؛ برای گفتگوی شخصی عدد مثبت است.
          </small>
        </label>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={notifyOnResponse}
          onChange={(e) => setNotifyOnResponse(e.target.checked)}
        />
        با هر پاسخ کامل پیام بفرست
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={onlyLowScores}
          onChange={(e) => setOnlyLowScores(e.target.checked)}
        />
        فقط وقتی شاخص رضایت کمتر از
        <input
          type="number"
          min={0}
          max={10}
          className="inline-number"
          value={threshold}
          disabled={!onlyLowScores}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
        باشد
      </label>

      <div className="inline-form">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || !chatId.trim()}
        >
          {save.isPending ? 'در حال ذخیره…' : 'ذخیره'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => test.mutate()}
          disabled={!configured || test.isPending}
        >
          ارسال پیام آزمایشی
        </button>
        {configured && (
          <button
            type="button"
            className="danger"
            onClick={() => remove.mutate()}
          >
            حذف اتصال
          </button>
        )}
      </div>

      {message && <p className="hint">{message}</p>}

      {settings.data?.lastError && (
        <p className="error">
          آخرین ارسال ناموفق بود: {settings.data.lastError}
        </p>
      )}
    </section>
  );
}
