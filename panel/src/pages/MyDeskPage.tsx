import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, lettersApi, meApi, type BotLinkCode } from '../api';
import { LettersPanel } from './me/LettersPanel';
import { DeskSections } from './me/DeskSections';

/** نامِ فارسیِ هر پیام‌رسان. */
const PLATFORM_LABELS: Record<string, string> = {
  bale: 'بله',
  telegram: 'تلگرام',
};

const platformName = (key: string) => PLATFORM_LABELS[key] ?? key;

const shortDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('fa-IR') : '—';

/**
 * داشبورد من — میزِ کارِ شخصیِ هر کاربر.
 *
 * در این فاز فقط پروندهٔ پرسنلیِ متصل و اتصالِ پیام‌رسان‌ها را دارد. کارها،
 * درخواست‌ها، مرخصی و نامه‌ها در فازهای بعدی همین‌جا اضافه می‌شوند؛ عمداً
 * چیزی که هنوز ساخته نشده را نشان نمی‌دهیم تا کاربر عددِ توخالی نبیند.
 */
export function MyDeskPage() {
  const qc = useQueryClient();
  const [code, setCode] = useState<BotLinkCode | null>(null);

  const profile = useQuery({ queryKey: ['me-profile'], queryFn: meApi.profile });

  /*
   * میزِ کار جدا از پروفایل خوانده می‌شود.
   *
   * داده‌ی عملیاتی زود کهنه می‌شود (کارِ تازه، نامهٔ تازه)، پس با برگشتن
   * به صفحه تازه می‌شود؛ ولی پروفایل و اتصالِ پیام‌رسان به‌ندرت عوض
   * می‌شوند و نیازی به این تازه‌سازی ندارند.
   */
  const desk = useQuery({
    queryKey: ['my-desk'],
    queryFn: meApi.desk,
    refetchOnWindowFocus: true,
  });

  /*
   * شمارِ نخوانده‌ها جدا خوانده می‌شود.
   *
   * سرور برای حسابِ وصل‌نشده صفر می‌دهد نه خطا، چون این عدد فقط یک نشان
   * است و نباید صفحه را بشکند.
   */
  const unread = useQuery({
    queryKey: ['letters-unread'],
    queryFn: lettersApi.unreadCount,
    retry: false,
  });

  const makeCode = useMutation({
    mutationFn: meApi.createBotLinkCode,
    onSuccess: (data) => setCode(data),
  });

  const removeLink = useMutation({
    mutationFn: (platform: string) => meApi.removeBotLink(platform),
    onSuccess: async () => {
      setCode(null);
      await qc.invalidateQueries({ queryKey: ['me-profile'] });
    },
  });

  const data = profile.data;
  const linkedPlatforms = new Set((data?.botLinks ?? []).map((l) => l.platform));

  return (
    <div className="page">
      <header className="page-header">
        <h1>داشبورد من</h1>
        <div className="header-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => void profile.refetch()}
            disabled={profile.isFetching}
          >
            {profile.isFetching ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی'}
          </button>
        </div>
      </header>

      {profile.isLoading && <p>در حال بارگذاری…</p>}
      {profile.isError && (
        <p className="error">{describeError(profile.error)}</p>
      )}

      {data && (
        <>
          {(unread.data?.count ?? 0) > 0 && (
            <section className="card">
              <h3>توجه</h3>
              <p>
                <strong style={{ color: '#b45309' }}>
                  {(unread.data?.count ?? 0).toLocaleString('fa-IR')}
                </strong>{' '}
                نامهٔ نخوانده دارید.
              </p>
            </section>
          )}

          <section className="card">
            <h3>پروندهٔ من</h3>
            {data.linked && data.personnel ? (
              <dl className="info-list">
                <dt>نام</dt>
                <dd>{data.personnel.fullName}</dd>
                {data.personnel.position && (
                  <>
                    <dt>سمت</dt>
                    <dd>{data.personnel.position}</dd>
                  </>
                )}
                {data.personnel.employeeNo && (
                  <>
                    <dt>کدِ پرسنلی</dt>
                    <dd>{data.personnel.employeeNo}</dd>
                  </>
                )}
                {data.personnel.mobile && (
                  <>
                    <dt>موبایل</dt>
                    <dd>{data.personnel.mobile}</dd>
                  </>
                )}
              </dl>
            ) : (
              /*
               * حالتِ وصل‌نشده صریح گفته می‌شود.
               *
               * اگر فقط فهرستِ خالی نشان داده می‌شد، کاربر فکر می‌کرد کاری
               * ندارد — در حالی که مشکل این است که حسابش به پرونده وصل نیست.
               */
              <p className="hint">
                حسابِ کاربریِ شما به هیچ پروندهٔ پرسنلی وصل نیست، پس کارها،
                شیفت و مرخصیِ شما اینجا دیده نمی‌شود. از واحدِ منابع انسانی
                بخواهید حسابتان را به پرونده‌تان وصل کند.
              </p>
            )}
          </section>

          <section className="card">
            <div className="section-head">
              <h3>حساب‌های پیام‌رسانِ من</h3>
              <span className="hint">
                با وصل کردن، کارها و شیفتتان را از ربات هم می‌گیرید
              </span>
            </div>

            {!data.linked ? (
              <p className="hint">
                برای وصل کردنِ پیام‌رسان، اول حسابتان باید به پروندهٔ پرسنلی
                وصل شود.
              </p>
            ) : (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>پیام‌رسان</th>
                        <th>وضعیت</th>
                        <th>از تاریخ</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.platforms.map((platform) => {
                        const link = data.botLinks.find(
                          (l) => l.platform === platform,
                        );
                        return (
                          <tr key={platform}>
                            <td>{platformName(platform)}</td>
                            <td>
                              {link ? (
                                <strong style={{ color: '#15803d' }}>
                                  وصل است
                                </strong>
                              ) : (
                                <span className="hint">وصل نیست</span>
                              )}
                            </td>
                            <td>{link ? shortDate(link.linkedAt) : '—'}</td>
                            <td>
                              {link && (
                                <button
                                  type="button"
                                  disabled={removeLink.isPending}
                                  onClick={() => removeLink.mutate(platform)}
                                >
                                  قطعِ اتصال
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="inline-form">
                  <button
                    type="button"
                    disabled={makeCode.isPending}
                    onClick={() => makeCode.mutate()}
                  >
                    {makeCode.isPending
                      ? 'در حال ساختِ کد…'
                      : linkedPlatforms.size > 0
                        ? 'وصل کردنِ پیام‌رسانِ دیگر'
                        : 'وصل کردنِ پیام‌رسان'}
                  </button>
                </div>

                {makeCode.isError && (
                  <p className="error">{describeError(makeCode.error)}</p>
                )}
                {removeLink.isError && (
                  <p className="error">{describeError(removeLink.error)}</p>
                )}

                {code && <LinkCodeCard code={code} />}
              </>
            )}
          </section>

          {desk.data?.linked && <DeskSections desk={desk.data} />}

          {data.linked && <LettersPanel />}
        </>
      )}
    </div>
  );
}

/** کدِ اتصال و راهنمای استفاده از آن. */
function LinkCodeCard({ code }: { code: BotLinkCode }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`/start ${code.code}`);
      setCopied(true);
    } catch {
      // کلیپ‌بورد در برخی مرورگرها بی‌اجازه است؛ کد روی صفحه هست و دستی
      // هم می‌شود برداشت، پس خطا را به کاربر نشان نمی‌دهیم.
      setCopied(false);
    }
  };

  return (
    <section
      style={{
        marginTop: '0.8rem',
        padding: '0.8rem',
        borderRadius: 10,
        border: '1px solid var(--border, #d4d4d8)',
      }}
    >
      <p>
        کدِ شما: <strong style={{ fontSize: '1.2rem' }}>{code.code}</strong>
      </p>
      <p className="hint">
        این کد تا {code.expiresInMinutes.toLocaleString('fa-IR')} دقیقه و فقط
        یک‌بار کار می‌کند.
      </p>

      {code.deepLink ? (
        <p>
          <a href={code.deepLink} target="_blank" rel="noreferrer">
            باز کردنِ {platformName(code.platform ?? '')} و وصل شدن
          </a>
        </p>
      ) : (
        <p className="hint">
          در {platformName(code.platform ?? '')} به ربات پیام بدهید:{' '}
          <code>/start {code.code}</code>
        </p>
      )}

      <div className="inline-form">
        <button type="button" onClick={() => void copy()}>
          {copied ? 'کپی شد' : 'کپیِ دستورِ اتصال'}
        </button>
      </div>
    </section>
  );
}
