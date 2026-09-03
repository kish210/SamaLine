import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  contactsApi,
  describeError,
  formsApi,
  messagingApi,
  workspaceApi,
} from '../api';

/** ارسال گروهی دعوت‌نامه با لینک یکتای هر گیرنده (بند ۷ سند). */
export function CampaignsPage() {
  const [formId, setFormId] = useState('');
  const [listId, setListId] = useState('');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [template, setTemplate] = useState(
    'سلام {{name}} عزیز، لطفا در نظرسنجی ما شرکت کنید: {{link}}',
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    total: number;
    sent: number;
    failed: number;
  } | null>(null);

  const status = useQuery({
    queryKey: ['messaging-status'],
    queryFn: messagingApi.status,
  });

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.list,
  });
  const workspaceId = workspaces.data?.[0]?.id ?? '';

  const forms = useQuery({
    queryKey: ['forms', workspaceId],
    queryFn: () => formsApi.list(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const lists = useQuery({
    queryKey: ['contact-lists'],
    queryFn: contactsApi.lists,
  });

  const form = useQuery({
    queryKey: ['form', formId],
    queryFn: () => formsApi.get(formId),
    enabled: Boolean(formId),
  });

  const publicationId = form.data?.publication?.id ?? '';

  const pending = useQuery({
    queryKey: ['pending', publicationId],
    queryFn: () => messagingApi.pending(publicationId),
    enabled: Boolean(publicationId),
  });

  const send = useMutation({
    mutationFn: async () => {
      const recipients = await contactsApi.recipients(listId, channel);
      if (!recipients.length) {
        throw new Error('هیچ گیرنده‌ای برای این کانال در فهرست نیست');
      }
      return messagingApi.sendCampaign({
        publicationId,
        channel,
        recipients,
        template,
      });
    },
    onSuccess: async (data) => {
      setResult(data);
      setError(null);
      await pending.refetch();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : describeError(err)),
  });

  const canSend = Boolean(publicationId && listId && template.trim());

  return (
    <div className="page">
      <header className="page-header">
        <h1>ارسال گروهی</h1>
        {status.data && (
          <span className="hint">
            پیامک: {status.data.providers.sms} | ایمیل:{' '}
            {status.data.providers.email}
          </span>
        )}
      </header>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="grid-2">
          <label>
            فرم
            <select value={formId} onChange={(e) => setFormId(e.target.value)}>
              <option value="">انتخاب کنید</option>
              {forms.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            فهرست مخاطبان
            <select value={listId} onChange={(e) => setListId(e.target.value)}>
              <option value="">انتخاب کنید</option>
              {lists.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {formId && !publicationId && (
          <p className="warning-line">
            این فرم هنوز منتشر نشده است. ابتدا از صفحه‌ی فرم، لینک را منتشر کنید.
          </p>
        )}

        <label>
          کانال
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as 'sms' | 'email')}
          >
            <option value="sms">پیامک</option>
            <option value="email">ایمیل</option>
          </select>
        </label>

        <label>
          متن پیام — <code>{'{{name}}'}</code> نام گیرنده و{' '}
          <code>{'{{link}}'}</code> لینک یکتای او
          <textarea
            rows={3}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
        </label>

        <button
          type="button"
          disabled={!canSend || send.isPending}
          onClick={() => send.mutate()}
        >
          {send.isPending ? 'در حال ارسال…' : 'ارسال کمپین'}
        </button>

        {result && (
          <p className="hint">
            مجموع {result.total} پیام: {result.sent} ارسال‌شده، {result.failed}{' '}
            ناموفق
          </p>
        )}
      </section>

      {publicationId && (
        <section className="card">
          <h3>بی‌پاسخ‌ها</h3>
          {pending.data?.length === 0 ? (
            <p className="empty">همه‌ی دعوت‌شدگان پاسخ داده‌اند.</p>
          ) : (
            <ul className="list">
              {pending.data?.map((item) => (
                <li key={item.respondentKey}>{item.recipient}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
