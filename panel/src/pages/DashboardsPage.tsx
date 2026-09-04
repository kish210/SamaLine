import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  dashboardsApi,
  describeError,
  formsApi,
  reportsApi,
  workspaceApi,
} from '../api';
import type { DashboardWidget } from '../api';
import { WidgetCard } from './dashboards/WidgetCard';

type WidgetType = DashboardWidget['type'];

const WIDGET_LABELS: Record<WidgetType, string> = {
  stat: 'کارت آماری',
  bar: 'نمودار میله‌ای سوال',
  nps: 'شاخص NPS',
  score: 'میانگین شاخص',
  text: 'متن',
};

const rendererBase =
  import.meta.env.VITE_RENDERER_URL ?? 'http://localhost:5173';

/** داشبوردساز با ویجت‌های قابل تنظیم (بند ۸ سند). */
export function DashboardsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [widgetType, setWidgetType] = useState<WidgetType>('stat');
  const [widgetFormId, setWidgetFormId] = useState('');
  const [widgetQuestionId, setWidgetQuestionId] = useState('');
  const [widgetMetric, setWidgetMetric] = useState('completed');
  const [widgetScoreKey, setWidgetScoreKey] = useState('');
  const [widgetText, setWidgetText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dashboards = useQuery({
    queryKey: ['dashboards'],
    queryFn: dashboardsApi.list,
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

  const data = useQuery({
    queryKey: ['dashboard-data', selectedId],
    queryFn: () => dashboardsApi.data(selectedId),
    enabled: Boolean(selectedId),
  });

  // شناسه‌ی سوال‌ها از پاسخ‌های ثبت‌شده می‌آید تا فقط سوالاتی پیشنهاد
  // شوند که واقعا داده دارند.
  const responses = useQuery({
    queryKey: ['responses', widgetFormId],
    queryFn: () => reportsApi.responses(widgetFormId),
    enabled: Boolean(widgetFormId) && (widgetType === 'bar' || widgetType === 'nps'),
  });

  const questionIds = [
    ...new Set(
      (responses.data ?? []).flatMap((row) => Object.keys(row.answers ?? {})),
    ),
  ];

  const create = useMutation({
    mutationFn: () => dashboardsApi.create(newName),
    onSuccess: async (dashboard) => {
      setNewName('');
      setSelectedId(dashboard.id);
      await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const saveWidgets = useMutation({
    mutationFn: (widgets: DashboardWidget[]) =>
      dashboardsApi.update(selectedId, { widgets }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ['dashboard-data', selectedId],
      });
    },
    onError: (err) => setError(describeError(err)),
  });

  const togglePublic = useMutation({
    mutationFn: (isPublic: boolean) =>
      dashboardsApi.setPublic(selectedId, isPublic),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['dashboard-data', selectedId],
      });
      await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const currentWidgets = (): DashboardWidget[] =>
    (data.data?.widgets ?? []).map((widget) => ({
      id: widget.id,
      type: widget.type,
      title: widget.title,
      formId: widget.formId,
      questionId: widget.questionId,
      metric: widget.metric,
      scoreKey: widget.scoreKey,
      content: widget.content,
      layout: widget.layout,
    }));

  const addWidget = () => {
    const widgets = currentWidgets();
    const title =
      widgetType === 'text'
        ? 'یادداشت'
        : widgetType === 'stat'
          ? 'آمار فرم'
          : widgetType === 'score'
            ? `شاخص ${widgetScoreKey}`
            : widgetType === 'nps'
              ? 'شاخص NPS'
              : `نمودار ${widgetQuestionId}`;

    widgets.push({
      id: `w${Date.now().toString(36)}`,
      type: widgetType,
      title,
      formId: widgetType === 'text' ? undefined : widgetFormId || undefined,
      questionId:
        widgetType === 'bar' || widgetType === 'nps'
          ? widgetQuestionId || undefined
          : undefined,
      metric: widgetType === 'stat' ? widgetMetric : undefined,
      scoreKey: widgetType === 'score' ? widgetScoreKey || undefined : undefined,
      content: widgetType === 'text' ? widgetText : undefined,
      layout: { x: 0, y: widgets.length, w: widgetType === 'stat' ? 3 : 6, h: 2 },
    });

    saveWidgets.mutate(widgets);
  };

  const removeWidget = (id: string) =>
    saveWidgets.mutate(currentWidgets().filter((w) => w.id !== id));

  const resizeWidget = (id: string, delta: -1 | 1) =>
    saveWidgets.mutate(
      currentWidgets().map((widget) =>
        widget.id === id
          ? {
              ...widget,
              layout: {
                ...widget.layout,
                w: Math.min(12, Math.max(2, widget.layout.w + delta * 2)),
              },
            }
          : widget,
      ),
    );

  const publicUrl = data.data?.publicToken
    ? `${rendererBase}/d/${data.data.publicToken}`
    : null;

  const canAdd =
    widgetType === 'text'
      ? widgetText.trim().length > 0
      : widgetType === 'stat'
        ? Boolean(widgetFormId)
        : widgetType === 'score'
          ? Boolean(widgetFormId && widgetScoreKey)
          : Boolean(widgetQuestionId);

  return (
    <div className="page">
      <header className="page-header">
        <h1>داشبوردساز</h1>
        <div className="inline-form">
          <input
            placeholder="نام داشبورد جدید"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="button"
            disabled={!newName.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            ساخت داشبورد
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="two-col">
        <section className="card">
          <h3>داشبوردها</h3>
          {dashboards.data?.length === 0 && (
            <p className="empty">هنوز داشبوردی نساخته‌اید.</p>
          )}
          <ul className="list">
            {dashboards.data?.map((dashboard) => (
              <li key={dashboard.id}>
                <button
                  type="button"
                  className={
                    selectedId === dashboard.id ? 'list-item active' : 'list-item'
                  }
                  onClick={() => setSelectedId(dashboard.id)}
                >
                  {dashboard.name}
                  {dashboard.isPublic && <span className="badge">عمومی</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div>
          {!selectedId && (
            <p className="empty">یک داشبورد را انتخاب یا بسازید.</p>
          )}

          {selectedId && (
            <>
              <section className="card">
                <h3>افزودن ویجت</h3>
                <div className="grid-2">
                  <label>
                    نوع ویجت
                    <select
                      value={widgetType}
                      onChange={(e) =>
                        setWidgetType(e.target.value as WidgetType)
                      }
                    >
                      {Object.entries(WIDGET_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {widgetType !== 'text' && (
                    <label>
                      فرم
                      <select
                        value={widgetFormId}
                        onChange={(e) => setWidgetFormId(e.target.value)}
                      >
                        <option value="">انتخاب کنید</option>
                        {forms.data?.map((form) => (
                          <option key={form.id} value={form.id}>
                            {form.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                {widgetType === 'stat' && (
                  <label>
                    شاخص آماری
                    <select
                      value={widgetMetric}
                      onChange={(e) => setWidgetMetric(e.target.value)}
                    >
                      <option value="visits">بازدید</option>
                      <option value="started">شروع‌شده</option>
                      <option value="completed">تکمیل‌شده</option>
                      <option value="completionRate">نرخ تکمیل</option>
                    </select>
                  </label>
                )}

                {(widgetType === 'bar' || widgetType === 'nps') && (
                  <label>
                    سوال
                    <select
                      value={widgetQuestionId}
                      onChange={(e) => setWidgetQuestionId(e.target.value)}
                    >
                      <option value="">انتخاب کنید</option>
                      {questionIds.map((id) => (
                        <option key={id} value={id}>
                          {id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {widgetType === 'score' && (
                  <label>
                    کلید شاخص
                    <input
                      value={widgetScoreKey}
                      placeholder="satisfaction"
                      onChange={(e) => setWidgetScoreKey(e.target.value)}
                    />
                  </label>
                )}

                {widgetType === 'text' && (
                  <label>
                    متن
                    <textarea
                      rows={2}
                      value={widgetText}
                      onChange={(e) => setWidgetText(e.target.value)}
                    />
                  </label>
                )}

                <button
                  type="button"
                  disabled={!canAdd || saveWidgets.isPending}
                  onClick={addWidget}
                >
                  افزودن به داشبورد
                </button>
              </section>

              <section className="card">
                <div className="section-head">
                  <h3>{data.data?.name}</h3>
                  <div className="inline-form">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(data.data?.isPublic)}
                        onChange={(e) => togglePublic.mutate(e.target.checked)}
                      />
                      اشتراک عمومی
                    </label>
                  </div>
                </div>

                {publicUrl && (
                  <p className="public-link">
                    لینک عمومی:{' '}
                    <a href={publicUrl} target="_blank" rel="noreferrer">
                      {publicUrl}
                    </a>
                  </p>
                )}

                {data.data?.widgets.length === 0 && (
                  <p className="empty">هنوز ویجتی اضافه نشده است.</p>
                )}

                <div className="widget-grid">
                  {data.data?.widgets.map((widget) => (
                    <WidgetCard
                      key={widget.id}
                      widget={widget}
                      onRemove={() => removeWidget(widget.id)}
                      onResize={(delta) => resizeWidget(widget.id, delta)}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
