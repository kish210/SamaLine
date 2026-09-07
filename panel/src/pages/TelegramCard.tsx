import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, formsApi, telegramApi } from '../api';

/**
 * اتصال تلگرام: یک ربات برای فضای کاری، و چند مقصد که می‌گویند پاسخ‌های
 * کدام فرم به کدام گفتگو برود.
 *
 * توکن ربات هیچ‌وقت از سرور برنمی‌گردد، پس فیلد توکن همیشه خالی باز می‌شود
 * و خالی ماندنش یعنی «همان توکن قبلی» — این را زیر فیلد نوشته‌ایم، وگرنه
 * کاربر فکر می‌کند اتصال پاک شده است.
 */
export function TelegramCard({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState('');
  const [message, setMessage] = useState('');

  const bot = useQuery({
    queryKey: ['telegram-bot', workspaceId],
    queryFn: () => telegramApi.getBot(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const recipients = useQuery({
    queryKey: ['telegram-recipients', workspaceId],
    queryFn: () => telegramApi.recipients(workspaceId),
    enabled: Boolean(workspaceId) && Boolean(bot.data?.configured),
  });

  const forms = useQuery({
    queryKey: ['forms', workspaceId],
    queryFn: () => formsApi.list(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['telegram-bot'] });
    void queryClient.invalidateQueries({ queryKey: ['telegram-recipients'] });
  };

  const saveBot = useMutation({
    mutationFn: () => telegramApi.saveBot(workspaceId, { botToken: botToken.trim() }),
    onSuccess: (data) => {
      setBotToken('');
      setMessage(
        data.botUsername
          ? `ربات @${data.botUsername} متصل شد.`
          : 'ربات متصل شد.',
      );
      refresh();
    },
    onError: (error) => setMessage(describeError(error)),
  });

  const removeBot = useMutation({
    mutationFn: () => telegramApi.removeBot(workspaceId),
    onSuccess: () => {
      setMessage('ربات و همه‌ی مقصدها حذف شدند.');
      refresh();
    },
  });

  return (
    <section className="card">
      <h3>ربات تلگرام</h3>
      <p className="hint">
        با هر پاسخ کامل، خلاصه‌ی پاسخ به مدیرانی که برای آن فرم تعریف کرده‌اید
        فرستاده می‌شود. ابتدا از <b>@BotFather</b> یک ربات بسازید و توکنش را
        اینجا بگذارید.
      </p>

      <div className="inline-form">
        <input
          type="password"
          dir="ltr"
          autoComplete="off"
          placeholder={
            bot.data?.configured ? '••••••  (ذخیره‌شده)' : '123456:ABC-DEF…'
          }
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
        />
        <button
          type="button"
          onClick={() => saveBot.mutate()}
          disabled={saveBot.isPending || !botToken.trim()}
        >
          {saveBot.isPending ? 'در حال بررسی…' : 'اتصال ربات'}
        </button>
        {bot.data?.configured && (
          <button
            type="button"
            className="danger"
            onClick={() => removeBot.mutate()}
          >
            حذف ربات
          </button>
        )}
      </div>

      {bot.data?.configured && (
        <p className="hint">
          ربات متصل است
          {bot.data.botUsername && (
            <>
              {' '}
              (<b dir="ltr">@{bot.data.botUsername}</b>)
            </>
          )}
          . توکن را خالی بگذارید تا دست‌نخورده بماند.
        </p>
      )}

      {message && <p className="hint">{message}</p>}

      {bot.data?.configured && (
        <RecipientList
          workspaceId={workspaceId}
          recipients={recipients.data ?? []}
          forms={forms.data ?? []}
          onChanged={refresh}
          onMessage={setMessage}
        />
      )}
    </section>
  );
}

interface RecipientListProps {
  workspaceId: string;
  recipients: Array<{
    id: string;
    formId: string | null;
    chatId: string;
    label: string;
    scoreThreshold: number | null;
    isActive: boolean;
    lastError: string | null;
  }>;
  forms: Array<{ id: string; title: string }>;
  onChanged: () => void;
  onMessage: (text: string) => void;
}

function RecipientList({
  workspaceId,
  recipients,
  forms,
  onChanged,
  onMessage,
}: RecipientListProps) {
  const [formId, setFormId] = useState('');
  const [chatId, setChatId] = useState('');
  const [label, setLabel] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [threshold, setThreshold] = useState(5);

  const chats = useQuery({
    queryKey: ['telegram-chats', workspaceId],
    queryFn: () => telegramApi.chats(workspaceId),
    // فقط وقتی کاربر خواست؛ getUpdates با هر بار صدا زدن پیام‌ها را مصرف
    // می‌کند و نباید خودکار اجرا شود.
    enabled: false,
    retry: false,
  });

  const add = useMutation({
    mutationFn: () =>
      telegramApi.addRecipient(workspaceId, {
        formId: formId || null,
        chatId: chatId.trim(),
        label: label.trim(),
        scoreThreshold: onlyLow ? threshold : null,
      }),
    onSuccess: () => {
      setChatId('');
      setLabel('');
      onMessage('مقصد اضافه شد.');
      onChanged();
    },
    onError: (error) => onMessage(describeError(error)),
  });

  const test = useMutation({
    mutationFn: (id: string) => telegramApi.test(workspaceId, id),
    onSuccess: () => onMessage('پیام آزمایشی فرستاده شد؛ تلگرام را ببینید.'),
    onError: (error) => onMessage(describeError(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => telegramApi.removeRecipient(workspaceId, id),
    onSuccess: onChanged,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      telegramApi.updateRecipient(workspaceId, id, { isActive }),
    onSuccess: onChanged,
  });

  const formTitle = (id: string | null) =>
    id === null
      ? 'همه‌ی فرم‌ها'
      : (forms.find((f) => f.id === id)?.title ?? 'فرم حذف‌شده');

  return (
    <>
      <h4>مقصدها</h4>

      {recipients.length === 0 ? (
        <p className="empty">
          هنوز مقصدی تعریف نشده؛ تا وقتی مقصدی نباشد هیچ پیامی فرستاده
          نمی‌شود.
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>فرم</th>
                <th>مدیر</th>
                <th>شناسه‌ی گفتگو</th>
                <th>فقط ناراضی‌ها</th>
                <th>فعال</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recipients.map((row) => (
                <tr key={row.id}>
                  <td>{formTitle(row.formId)}</td>
                  <td>{row.label || '—'}</td>
                  <td dir="ltr">{row.chatId}</td>
                  <td>
                    {row.scoreThreshold === null
                      ? '—'
                      : `زیر ${row.scoreThreshold}`}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.isActive}
                      onChange={(e) =>
                        toggle.mutate({
                          id: row.id,
                          isActive: e.target.checked,
                        })
                      }
                    />
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => test.mutate(row.id)}
                    >
                      آزمایش
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => remove.mutate(row.id)}
                    >
                      حذف
                    </button>
                    {row.lastError && (
                      <span className="error" title={row.lastError}>
                        خطای ارسال
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4>افزودن مقصد</h4>
      <div className="form-grid">
        <label>
          <span className="field-label">فرم</span>
          <select value={formId} onChange={(e) => setFormId(e.target.value)}>
            <option value="">همه‌ی فرم‌ها</option>
            {forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="field-label">نام مدیر</span>
          <input
            placeholder="مدیر هتل"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>

        <label>
          <span className="field-label">شناسه‌ی گفتگو</span>
          <input
            dir="ltr"
            placeholder="-1001234567890"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
          />
          <small className="hint">
            مدیر باید یک‌بار به ربات پیام بدهد (یا ربات به گروهش اضافه شود)،
            بعد «خواندن گفتگوها» را بزنید.
          </small>
        </label>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={onlyLow}
          onChange={(e) => setOnlyLow(e.target.checked)}
        />
        فقط وقتی شاخص رضایت کمتر از
        <input
          type="number"
          min={0}
          max={10}
          className="inline-number"
          value={threshold}
          disabled={!onlyLow}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
        باشد
      </label>

      <div className="inline-form">
        <button
          type="button"
          onClick={() => add.mutate()}
          disabled={!chatId.trim() || add.isPending}
        >
          افزودن
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => void chats.refetch()}
          disabled={chats.isFetching}
        >
          {chats.isFetching ? 'در حال خواندن…' : 'خواندن گفتگوها'}
        </button>
      </div>

      {chats.error && <p className="error">{describeError(chats.error)}</p>}

      {chats.data && chats.data.length === 0 && (
        <p className="hint">
          گفتگوی تازه‌ای پیدا نشد. در تلگرام به ربات پیام بدهید و دوباره
          بزنید.
        </p>
      )}

      {chats.data && chats.data.length > 0 && (
        <div className="chat-picks">
          {chats.data.map((chat) => (
            <button
              key={chat.id}
              type="button"
              className="secondary"
              onClick={() => {
                setChatId(chat.id);
                if (!label) setLabel(chat.title);
              }}
            >
              {chat.title} <small dir="ltr">({chat.id})</small>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
