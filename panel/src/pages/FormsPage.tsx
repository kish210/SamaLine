import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { describeError, formsApi, workspaceApi } from '../api';
import type { FormPage } from '../types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  active: 'فعال',
  closed: 'بسته',
  archived: 'بایگانی',
};

/** یک صفحه‌ی خالی با یک سوال، تا فرم تازه بلافاصله قابل ویرایش باشد. */
const starterPages = (): FormPage[] => [
  {
    id: 'p1',
    title: 'صفحه ۱',
    questions: [
      { id: 'q1', type: 'short_text', title: 'سوال اول شما', required: false },
    ],
  },
];

export function FormsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  const createForm = useMutation({
    mutationFn: () =>
      formsApi.create({
        workspaceId,
        title,
        // اسلاگ یکتا بدون نیاز به ورودی کاربر.
        slug: `form-${Date.now().toString(36)}`,
        pages: starterPages(),
      }),
    onSuccess: async () => {
      setTitle('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['forms', workspaceId] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceId || !title.trim()) return;
    createForm.mutate();
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>فرم‌ها</h1>
        <form className="inline-form" onSubmit={submit}>
          <input
            placeholder="عنوان فرم جدید"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" disabled={createForm.isPending || !workspaceId}>
            ساخت فرم
          </button>
        </form>
      </header>

      {error && <p className="error">{error}</p>}

      {forms.isLoading && <p>در حال بارگذاری…</p>}

      {forms.data?.length === 0 && (
        <p className="empty">هنوز فرمی نساخته‌اید. اولین فرم را بسازید.</p>
      )}

      <div className="card-grid">
        {forms.data?.map((form) => (
          <Link key={form.id} to={`/forms/${form.id}`} className="card form-card">
            <h3>{form.title}</h3>
            <div className="meta">
              <span className={`badge badge-${form.status}`}>
                {STATUS_LABELS[form.status] ?? form.status}
              </span>
              <span className="slug">{form.slug}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
