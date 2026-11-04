import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { describeError, hrDeskApi } from '../api';
import { isoToJalaliText } from '../jalali';

/**
 * میزِ کارِ منابع انسانی.
 *
 * پیش از این مدیر برای یک تصویرِ کامل باید چهار صفحه را باز می‌کرد: کارتابلِ
 * مرخصی، پرسنل، میزِ کارِ پرسنل و قراردادها. اینجا همان اعداد یک‌جا می‌آید و
 * هر سطل به فهرستِ واقعیِ خودش لینک دارد — عددی که به جایی نرسد، نمایش داده
 * نمی‌شود.
 */
export function HrDeskPage() {
  const desk = useQuery({
    queryKey: ['hr-desk'],
    queryFn: () => hrDeskApi.overview(),
    // دادهٔ حضور و کارتابل با هر بازگشت به صفحه تازه شود.
    refetchOnWindowFocus: true,
  });

  const data = desk.data;
  const attendance = data?.attendance;

  const toneColor: Record<string, string> = {
    warn: 'var(--warning-500)',
    danger: 'var(--danger-500)',
    info: 'var(--blue-600)',
    ok: 'var(--success-500)',
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>میزِ کارِ منابع انسانی</h1>
        <div className="header-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => void desk.refetch()}
            disabled={desk.isFetching}
          >
            {desk.isFetching ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی'}
          </button>
          <Link className="button-link secondary" to="/workforce">
            میزِ کارِ پرسنل
          </Link>
        </div>
      </header>

      {desk.isLoading && <p>در حال بارگذاری…</p>}
      {desk.isError && <p className="error">{describeError(desk.error)}</p>}

      {data && attendance && (
        <>
          <section className="card">
            <div className="section-head">
              <h3>چه چیزی توجه می‌خواهد؟</h3>
              <span className="hint">
                {isoToJalaliText(data.date)} · ساخته‌شده در{' '}
                {new Date(data.generatedAt).toLocaleTimeString('fa-IR')}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))',
                gap: '0.6rem',
              }}
            >
              {data.buckets.map((bucket) => (
                <Link
                  key={bucket.key}
                  to={bucket.href}
                  className="card"
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    borderInlineStart: `3px solid ${
                      toneColor[bucket.tone] ?? 'var(--border-strong)'
                    }`,
                  }}
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
                    {bucket.count.toLocaleString('fa-IR')}
                  </div>
                  <div className="hint">{bucket.label}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h3>امروز</h3>
              <span className="hint">
                {data.headcount.toLocaleString('fa-IR')} نفرِ فعال ·{' '}
                {data.terminated.toLocaleString('fa-IR')} قطعِ همکاری
              </span>
            </div>
            <div className="stat-row">
              <div className="stat">
                <span className="stat-value">
                  {attendance.scheduled.toLocaleString('fa-IR')}
                </span>
                <span className="stat-label">شیفتِ امروز</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {attendance.present.toLocaleString('fa-IR')}
                </span>
                <span className="stat-label">حاضر</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {attendance.late.toLocaleString('fa-IR')}
                </span>
                <span className="stat-label">تأخیر</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {attendance.absent.toLocaleString('fa-IR')}
                </span>
                <span className="stat-label">غایب</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {attendance.onLeave.toLocaleString('fa-IR')}
                </span>
                <span className="stat-label">در مرخصی</span>
              </div>
              <div className="stat">
                <span className="stat-value">
                  {attendance.unrecorded.toLocaleString('fa-IR')}
                </span>
                <span className="stat-label">ثبت‌نشده</span>
              </div>
            </div>
            <p className="hint">
              ثبتِ حضور از{' '}
              <Link to={`/workforce?filter=unrecorded`}>میزِ کارِ پرسنل</Link>{' '}
              انجام می‌شود.
            </p>
          </section>

          <div className="builder-layout">
            <section className="card">
              <div className="section-head">
                <h3>مرخصیِ منتظرِ تأیید</h3>
                <Link to="/leaves" className="link-button">
                  همه
                </Link>
              </div>
              {data.pendingLeaves.length === 0 ? (
                <p className="hint">چیزی در انتظار نیست.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>پرسنل</th>
                        <th>بخش</th>
                        <th>نوع</th>
                        <th>از</th>
                        <th>روز</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pendingLeaves.map((row) => (
                        <tr key={row.id}>
                          <td>{row.personnelName || '—'}</td>
                          <td>{row.departmentName || '—'}</td>
                          <td>{row.typeLabel}</td>
                          <td className="nowrap">
                            {isoToJalaliText(row.fromDate)}
                          </td>
                          <td>{row.days.toLocaleString('fa-IR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card">
              <div className="section-head">
                <h3>قراردادِ رو به پایان</h3>
                <Link to="/personnel" className="link-button">
                  پرونده‌ها
                </Link>
              </div>
              {data.expiringContracts.length === 0 ? (
                <p className="hint">قراردادی در ۳۰ روزِ آینده تمام نمی‌شود.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>پرسنل</th>
                        <th>بخش</th>
                        <th>پایان</th>
                        <th>روزِ مانده</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expiringContracts.map((row) => (
                        <tr key={row.id}>
                          <td>
                            {row.fullName}
                            {row.position && (
                              <span className="hint"> — {row.position}</span>
                            )}
                          </td>
                          <td>{row.departmentName || '—'}</td>
                          <td className="nowrap">
                            {isoToJalaliText(row.contractEndsAt)}
                          </td>
                          <td>{row.daysLeft.toLocaleString('fa-IR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <section className="card">
            <div className="section-head">
              <h3>واحدها</h3>
              <span className="hint">شمارِ نفر و وضعیتِ امروزِ هر واحد</span>
            </div>
            {data.departments.length === 0 ? (
              <p className="hint">
                هنوز بخشی ساخته نشده است؛ از «واحدهای هتل» راه‌اندازی کنید.
              </p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>واحد</th>
                      <th>پرسنل</th>
                      <th>ثبت‌نشدهٔ امروز</th>
                      <th>در مرخصی</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.departments.map((dep) => (
                      <tr key={dep.id}>
                        <td>{dep.name}</td>
                        <td>{dep.headcount.toLocaleString('fa-IR')}</td>
                        <td>
                          {dep.unrecorded > 0 ? (
                            <strong style={{ color: 'var(--danger-500)' }}>
                              {dep.unrecorded.toLocaleString('fa-IR')}
                            </strong>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{dep.onLeave.toLocaleString('fa-IR')}</td>
                        <td>
                          <Link
                            to={`/workforce?filter=unrecorded&department=${dep.id}`}
                            className="link-button"
                          >
                            میزِ کار
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
