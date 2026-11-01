import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  describeError,
  lettersApi,
  type AddressBookEntry,
} from '../../api';

const fa = (n: number) => n.toLocaleString('fa-IR');

const when = (iso: string) =>
  iso
    ? `${new Date(iso).toLocaleDateString('fa-IR')} ${new Date(
        iso,
      ).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`
    : '—';

type Box = 'inbox' | 'sent';

/**
 * نامهٔ داخلی در میزِ کارِ شخصی.
 *
 * نامه سندِ ارتباط است نه پیامِ گپ: شماره دارد، رسیدِ خواندن دارد، و
 * پاسخ‌ها رشته می‌سازند. برای همین نمای باز شده کلِ رشته را نشان می‌دهد،
 * نه یک پیامِ تنها.
 */
export function LettersPanel() {
  const qc = useQueryClient();
  const [box, setBox] = useState<Box>('inbox');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const list = useQuery({
    queryKey: ['letters', box, unreadOnly, search],
    queryFn: () => {
      const query = {
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(unreadOnly && box === 'inbox' ? { unread: true } : {}),
        pageSize: 30,
      };
      return box === 'inbox'
        ? lettersApi.inbox(query)
        : lettersApi.sent(query);
    },
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['letters'] });
    await qc.invalidateQueries({ queryKey: ['letters-unread'] });
  };

  return (
    <section className="card">
      <div className="section-head">
        <h3>نامه‌ها</h3>
        <span className="question-actions">
          <button type="button" onClick={() => setComposing(true)}>
            + نوشتنِ نامه
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void refresh()}
          >
            به‌روزرسانی
          </button>
        </span>
      </div>

      <div className="inline-form">
        <button
          type="button"
          className={box === 'inbox' ? '' : 'secondary'}
          onClick={() => {
            setBox('inbox');
            setOpenId(null);
          }}
        >
          دریافتی
        </button>
        <button
          type="button"
          className={box === 'sent' ? '' : 'secondary'}
          onClick={() => {
            setBox('sent');
            setOpenId(null);
            setUnreadOnly(false);
          }}
        >
          ارسالی
        </button>
        {box === 'inbox' && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            فقط نخوانده
          </label>
        )}
        <input
          value={search}
          placeholder="جست‌وجو در موضوع، شماره یا متن…"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {list.isLoading && <p>در حال بارگذاری…</p>}
      {list.isError && <p className="error">{describeError(list.error)}</p>}
      {list.data && list.data.rows.length === 0 && (
        <p className="hint">
          {box === 'inbox'
            ? unreadOnly
              ? 'نامهٔ نخوانده‌ای ندارید.'
              : 'نامه‌ای دریافت نکرده‌اید.'
            : 'نامه‌ای نفرستاده‌اید.'}
        </p>
      )}

      {list.data && list.data.rows.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>شماره</th>
                <th>موضوع</th>
                <th>{box === 'inbox' ? 'فرستنده' : 'گیرنده'}</th>
                <th>تاریخ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.rows.map((letter) => (
                <tr key={letter.id}>
                  <td>{letter.number}</td>
                  <td>
                    <strong style={{ fontWeight: letter.isUnread ? 700 : 400 }}>
                      {letter.subject}
                    </strong>
                    {letter.priority === 'urgent' && (
                      <span style={{ color: '#b91c1c' }}> · فوری</span>
                    )}
                    {letter.isUnread && (
                      <span className="review-badge pending"> نخوانده</span>
                    )}
                  </td>
                  <td>
                    {box === 'inbox'
                      ? letter.senderName
                      : letter.recipients
                          .map((r) => r.name)
                          .join('، ') || '—'}
                  </td>
                  <td>{when(letter.createdAt)}</td>
                  <td>
                    <button type="button" onClick={() => setOpenId(letter.id)}>
                      باز کردن
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openId && (
        <LetterThread
          letterId={openId}
          onClose={() => setOpenId(null)}
          onChanged={() => void refresh()}
        />
      )}
      {composing && (
        <ComposeLetter
          onClose={() => setComposing(false)}
          onSent={() => void refresh()}
        />
      )}
    </section>
  );
}

/** یک رشتهٔ مکاتبه با کادرِ پاسخ. */
function LetterThread({
  letterId,
  onClose,
  onChanged,
}: {
  letterId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const thread = useQuery({
    queryKey: ['letter-thread', letterId],
    queryFn: () => lettersApi.thread(letterId),
  });

  /*
   * باز کردنِ نامه، آن را خوانده می‌کند.
   *
   * فقط نامه‌هایی که خودم گیرنده‌شان بوده‌ام و هنوز نخوانده‌اند؛ نامهٔ
   * خودم «خوانده» نمی‌شود و سرور هم همان را می‌گوید.
   */
  useEffect(() => {
    const rows = thread.data ?? [];
    const unread = rows.filter((l) => l.isUnread);
    if (unread.length === 0) return;
    void Promise.all(unread.map((l) => lettersApi.markRead(l.id)))
      .then(() => {
        onChanged();
        return qc.invalidateQueries({ queryKey: ['letter-thread', letterId] });
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.data]);

  const reply = useMutation({
    mutationFn: () =>
      lettersApi.reply(
        (thread.data ?? []).at(-1)?.id ?? letterId,
        { body: body.trim() },
      ),
    onSuccess: async () => {
      setBody('');
      onChanged();
      await qc.invalidateQueries({ queryKey: ['letter-thread', letterId] });
    },
  });

  const rows = thread.data ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-label="نامه"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h3>{rows[0]?.subject ?? 'نامه'}</h3>
          <button type="button" className="link-button" onClick={onClose}>
            بستن
          </button>
        </div>

        {thread.isLoading && <p>در حال بارگذاری…</p>}
        {thread.isError && (
          <p className="error">{describeError(thread.error)}</p>
        )}

        {rows.map((letter) => (
          <article
            key={letter.id}
            style={{
              padding: '0.7rem 0',
              borderTop: '1px solid var(--border, #e4e4e7)',
            }}
          >
            <div className="hint">
              <strong>{letter.number}</strong> · {letter.senderName} ·{' '}
              {when(letter.createdAt)}
              {letter.priority === 'urgent' && (
                <span style={{ color: '#b91c1c' }}> · فوری</span>
              )}
            </div>
            <div className="hint">
              به: {letter.recipients.map((r) => r.name).join('، ')}
            </div>
            <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.4rem' }}>
              {letter.body || '—'}
            </p>
            {letter.isMine && letter.recipients.length > 0 && (
              <div className="hint">
                رسیدِ خواندن:{' '}
                {letter.recipients
                  .map(
                    (r) => `${r.name} ${r.readAt ? '✓' : '—'}`,
                  )
                  .join(' · ')}
              </div>
            )}
          </article>
        ))}

        <div style={{ marginTop: '0.8rem' }}>
          <label>
            پاسخ
            <textarea
              rows={4}
              value={body}
              placeholder="پاسخِ خود را بنویسید…"
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {reply.isError && (
            <p className="error">{describeError(reply.error)}</p>
          )}
          <div className="inline-form">
            <button
              type="button"
              disabled={reply.isPending || !body.trim()}
              onClick={() => reply.mutate()}
            >
              {reply.isPending ? 'در حال ارسال…' : 'ارسالِ پاسخ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** نوشتنِ نامهٔ تازه. */
function ComposeLetter({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [urgent, setUrgent] = useState(false);

  const book = useQuery({
    queryKey: ['letter-address-book'],
    queryFn: lettersApi.addressBook,
  });

  const send = useMutation({
    mutationFn: () =>
      lettersApi.send({
        subject: subject.trim(),
        body: body.trim(),
        to,
        cc,
        priority: urgent ? 'urgent' : 'normal',
      }),
    onSuccess: () => {
      onSent();
      onClose();
    },
  });

  const people = book.data ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-label="نامهٔ تازه"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h3>نامهٔ تازه</h3>
          <button type="button" className="link-button" onClick={onClose}>
            بستن
          </button>
        </div>

        <label>
          موضوع *
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>

        <PeoplePicker
          label="گیرنده *"
          people={people}
          selected={to}
          onChange={setTo}
        />
        <PeoplePicker
          label="رونوشت"
          people={people.filter((p) => !to.includes(p.personnelId))}
          selected={cc}
          onChange={setCc}
        />

        <label>
          متنِ نامه
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={urgent}
            onChange={(e) => setUrgent(e.target.checked)}
          />
          فوری
        </label>

        {book.isError && (
          <p className="error">{describeError(book.error)}</p>
        )}
        {send.isError && <p className="error">{describeError(send.error)}</p>}

        <div className="inline-form">
          <button
            type="button"
            disabled={send.isPending || !subject.trim() || to.length === 0}
            onClick={() => send.mutate()}
          >
            {send.isPending ? 'در حال ارسال…' : 'ارسالِ نامه'}
          </button>
          <span className="hint">
            {to.length > 0
              ? `${fa(to.length)} گیرنده${
                  cc.length > 0 ? ` و ${fa(cc.length)} رونوشت` : ''
                }`
              : 'دست‌کم یک گیرنده لازم است'}
          </span>
        </div>
      </div>
    </div>
  );
}

/** انتخابِ چند همکار با جست‌وجو. */
function PeoplePicker({
  label,
  people,
  selected,
  onChange,
}: {
  label: string;
  people: AddressBookEntry[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [filter, setFilter] = useState('');
  const shown = filter.trim()
    ? people.filter(
        (p) =>
          p.fullName.includes(filter.trim()) ||
          p.position.includes(filter.trim()),
      )
    : people;

  const toggle = (id: string) =>
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );

  return (
    <div style={{ marginBlock: '0.6rem' }}>
      <div className="hint">{label}</div>
      <input
        value={filter}
        placeholder="جست‌وجوی همکار…"
        onChange={(e) => setFilter(e.target.value)}
      />
      <div
        style={{
          maxHeight: '9rem',
          overflowY: 'auto',
          marginTop: '0.3rem',
          border: '1px solid var(--border, #d4d4d8)',
          borderRadius: 8,
          padding: '0.3rem',
        }}
      >
        {shown.length === 0 ? (
          <p className="hint">همکاری پیدا نشد.</p>
        ) : (
          shown.map((p) => (
            <label
              key={p.personnelId}
              className="checkbox-label"
              style={{ display: 'block' }}
            >
              <input
                type="checkbox"
                checked={selected.includes(p.personnelId)}
                onChange={() => toggle(p.personnelId)}
              />
              {p.fullName}
              {p.position && <span className="hint"> — {p.position}</span>}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
