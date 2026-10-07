/**
 * دود تست انتشار: چرخه‌ی کامل سامانه روی نصب تازه.
 * هر گام مستقل گزارش می‌شود تا شکست دقیقا مشخص باشد.
 */
const BASE = process.env.BASE ?? 'http://localhost:3000/api/v1';

/*
 * پلن سازمان تازه «رایگان» است و منطق شرطی، شاخص، داشبورد و کمپین را ندارد.
 * برای آزمودن چرخه‌ی کامل، حساب مدیر کل لازم است تا سازمانِ تست ارتقا یابد:
 *
 *   npm run superadmin -- admin@example.com
 *   SMOKE_ADMIN_EMAIL=admin@example.com SMOKE_ADMIN_PASSWORD=... npm run smoke
 *
 * بدون آن، همان گام‌ها به‌جای امکانات، اعمالِ سقف پلن را می‌سنجند؛ پس دود
 * تست روی هر نصبی اجرا می‌شود.
 */
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? '';

const results = [];
let token = '';
/** آیا سازمان تست به پلن کامل ارتقا یافت؟ */
let fullPlan = false;

async function call(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const email = `smoke${Date.now()}@test.local`;

  const reg = await call('POST', '/auth/register', {
    fullName: 'دود تست',
    email,
    password: 'Passw0rd!',
    organizationName: 'سازمان دود',
    workspaceName: 'فضا',
  });
  token = reg.data.accessToken ?? '';
  check('ثبت‌نام و ورود', Boolean(token));

  const ws = await call('GET', '/workspaces');
  const workspaceId = ws.data?.[0]?.id;
  check('فضای کاری', Boolean(workspaceId));

  const organizationId = reg.data?.user?.organizationId;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const ownerSession = token;
    const admin = await call('POST', '/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    token = admin.data?.accessToken ?? '';
    const upgrade = await call(
      'PATCH',
      `/admin/organizations/${organizationId}/plan`,
      { planCode: 'enterprise' },
    );
    fullPlan = upgrade.status === 200;
    check('ارتقای سازمان تست به پلن کامل (مدیر کل)', fullPlan, String(upgrade.status));
    token = ownerSession;
  } else {
    console.log(
      'ℹ بدون SMOKE_ADMIN_EMAIL: سازمان روی پلن رایگان می‌ماند و گام‌های امکانات پولی، اعمالِ سقف پلن را می‌سنجند.',
    );
  }

  const structure = {
    scoreConfig: { indices: [{ id: 'i1', key: 'sat', method: 'avg' }] },
    logic: {
      display: [
        {
          targetQuestionId: 'why',
          when: {
            combinator: 'and',
            conditions: [{ source: 'score.sat', operator: 'lt', value: 5 }],
          },
        },
      ],
    },
  };
  const pages = [
    {
      id: 'p1',
      title: 'صفحه ۱',
      questions: [
        {
          id: 'rate',
          type: 'rating',
          title: 'امتیاز؟',
          scoring: { indexId: 'i1' },
        },
      ],
    },
    {
      id: 'p2',
      title: 'صفحه ۲',
      questions: [{ id: 'why', type: 'long_text', title: 'چرا {{rate}}؟' }],
    },
  ];

  if (!fullPlan) {
    // روی پلن رایگان همین ساختار باید رد شود؛ این خودش یک گام است.
    const blocked = await call('POST', '/forms', {
      workspaceId,
      title: 'نظرسنجی دود',
      slug: `smoke-blocked-${Date.now()}`,
      ...structure,
      pages,
    });
    check(
      'منطق و شاخص در پلن رایگان رد می‌شود',
      blocked.status === 403,
      blocked.data?.message ?? '',
    );
  }

  const form = await call('POST', '/forms', {
    workspaceId,
    title: 'نظرسنجی دود',
    slug: `smoke-${Date.now()}`,
    ...(fullPlan ? structure : {}),
    pages,
  });
  const formId = form.data?.id;
  check('ساخت فرم', Boolean(formId), form.data?.message ?? '');

  const pub = await call('POST', `/forms/${formId}/publish-link`);
  const formToken = pub.data?.token;
  check('انتشار لینک', Boolean(formToken));

  const slug = `smoke-link-${Date.now().toString(36)}`;
  const slugRes = await call('PATCH', `/forms/${formId}/slug`, { slug });
  check('لینک اختصاصی', slugRes.data?.slug === slug);

  const flow = await call('POST', `/public/forms/${slug}/next`, {});
  check(
    'گام اول با نشانی اختصاصی',
    flow.data?.page?.id === 'p1',
    flow.data?.message ?? '',
  );

  const step2 = await call('POST', `/public/forms/${formToken}/next`, {
    currentPageId: 'p1',
    answers: { rate: 2 },
  });
  const piped = step2.data?.page?.questions?.[0]?.title;
  check('Piping (درج پاسخ قبلی در متن سوال)', piped === 'چرا 2؟', piped ?? '');

  if (fullPlan) {
    const hidden = await call('POST', `/public/forms/${formToken}/next`, {
      currentPageId: 'p1',
      answers: { rate: 9 },
    });
    check(
      'پنهان شدن سوال شرطی',
      (hidden.data?.page?.questions?.length ?? -1) === 0,
    );
  }

  const submit = await call('POST', `/public/forms/${formToken}/submit`, {
    answers: { rate: 9, why: 'نباید ذخیره شود' },
  });
  check('ثبت پاسخ', submit.data?.status === 'completed');
  if (fullPlan) {
    check('حذف پاسخ سوال پنهان', submit.data?.scores?.sat === 9);
  }

  const summary = await call('GET', `/reports/forms/${formId}/summary`);
  check('گزارش', summary.data?.completed === 1);

  const csv = await call('GET', `/reports/forms/${formId}/export.csv`);
  check('خروجی CSV', csv.status === 200 && String(csv.data).includes('امتیاز'));

  const list = await call('POST', '/contacts/lists', { name: 'دود' });
  const listId = list.data?.id;
  check('فهرست مخاطبان', Boolean(listId));

  const imported = await call('POST', `/contacts/lists/${listId}/import`, {
    csv: 'مریم,+989121112233,\nعلی,۰۹۱۲۴۴۴۵۵۶۶,ali@t.local',
  });
  check('بارگذاری مخاطب و یکسان‌سازی شماره', imported.data?.created === 2);

  const recipients = await call(
    'GET',
    `/contacts/lists/${listId}/recipients?channel=sms`,
  );
  check(
    'گیرندگان کمپین',
    recipients.data?.[0]?.to === '09121112233',
    recipients.data?.[0]?.to ?? '',
  );

  const campaign = await call('POST', '/messaging/campaigns', {
    publicationId: pub.data.id,
    channel: 'sms',
    template: 'سلام {{name}}: {{link}}',
    recipients: recipients.data,
  });
  check(
    fullPlan ? 'ارسال کمپین' : 'پنل پیامکی در پلن رایگان رد می‌شود',
    fullPlan ? campaign.data?.sent === 2 : campaign.status === 403,
    campaign.data?.message ?? '',
  );

  const ssrf = await call('POST', '/contacts/sources/preview', {
    listId,
    name: 'x',
    url: 'http://169.254.169.254/latest/meta-data',
    mapping: { mobile: 'phone' },
  });
  check('مسدودسازی SSRF', ssrf.status === 400);

  const authMode = await call('PATCH', `/forms/${formId}/auth-mode`, {
    authMode: 'password',
    password: 'secret123',
  });
  check('تنظیم رمز فرم', authMode.data?.authMode === 'password');

  const blocked = await call('GET', `/public/forms/${formToken}`);
  check('مسدودسازی فرم رمزدار', blocked.status === 401);

  const login = await call('POST', `/public/forms/${formToken}/auth/password`, {
    password: 'secret123',
  });
  check('ورود با رمز', Boolean(login.data?.accessToken));

  const opened = await call('GET', `/public/forms/${formToken}`, undefined, {
    'x-respondent-token': login.data.accessToken,
  });
  check('دسترسی پس از ورود', opened.status === 200);

  // ── داشبوردساز ──
  const dashboard = await call('POST', '/dashboards', { name: 'دود' });
  const dashboardId = dashboard.data?.id;
  check(
    fullPlan ? 'ساخت داشبورد' : 'داشبوردساز در پلن رایگان رد می‌شود',
    fullPlan ? Boolean(dashboardId) : dashboard.status === 403,
    dashboard.data?.message ?? '',
  );

  if (fullPlan) {
    await call('PATCH', `/dashboards/${dashboardId}`, {
      widgets: [
        {
          id: 'w1',
          type: 'stat',
          title: 'تکمیل‌شده',
          formId,
          metric: 'completed',
          layout: { x: 0, y: 0, w: 3, h: 2 },
        },
      ],
    });
    const rendered = await call('GET', `/dashboards/${dashboardId}/data`);
    check('محاسبه‌ی ویجت', rendered.data?.widgets?.[0]?.value === 1);

    const shared = await call('PATCH', `/dashboards/${dashboardId}/public`, {
      isPublic: true,
    });
    const publicView = await call(
      'GET',
      `/public/dashboards/${shared.data.publicToken}`,
    );
    check('اشتراک عمومی داشبورد', publicView.status === 200);
  }

  // ── پرداخت ──
  const invoice = await call('POST', '/billing/invoices', { amount: 250000 });
  const started = await call('POST', '/billing/payments', {
    invoiceId: invoice.data.id,
    gateway: 'x',
    // مبلغ ناچیز از کلاینت؛ باید نادیده گرفته شود.
    amount: 1,
  });
  check('مبلغ پرداخت از فاکتور می‌آید', started.data?.amount === 250000);

  const verified = await call(
    'PATCH',
    `/billing/payments/${started.data.paymentId}/verify`,
  );
  check('تایید پرداخت از درگاه', verified.data?.status === 'success');

  const paidInvoice = await call('GET', '/billing/invoices');
  check(
    'تسویه‌ی فاکتور',
    paidInvoice.data?.some(
      (row) => row.id === invoice.data.id && row.status === 'paid',
    ),
  );

  /*
   * جداسازی مستاجرها: کاربر یک سازمان دیگر نباید به انتشار، کمپین،
   * فهرست سازمان‌ها یا تغییر پلن دسترسی داشته باشد.
   */
  const ownerToken = token;
  const intruder = await call('POST', '/auth/register', {
    fullName: 'مهاجم',
    email: `intruder${Date.now()}@test.local`,
    password: 'Passw0rd!',
    organizationName: 'سازمان دیگر',
    workspaceName: 'فضا',
  });
  token = intruder.data.accessToken ?? '';

  const foreignCampaign = await call('POST', '/messaging/campaigns', {
    publicationId: pub.data.id,
    channel: 'sms',
    template: '{{link}}',
    recipients: [{ to: '09120000000' }],
  });
  check('کمپین روی انتشار سازمان دیگر رد می‌شود', foreignCampaign.status === 403);

  const foreignPending = await call(
    'GET',
    `/messaging/campaigns/${pub.data.id}/pending`,
  );
  check('گیرندگان سازمان دیگر دیده نمی‌شوند', foreignPending.status === 403);

  const overview = await call('GET', '/admin/organizations-overview');
  check('فهرست همه‌ی سازمان‌ها فقط برای مدیر کل', overview.status === 403);

  const selfUpgrade = await call('POST', '/billing/subscriptions', {
    planCode: 'enterprise',
  });
  check('ارتقای پلن بدون مدیر کل رد می‌شود', selfUpgrade.status === 403);

  token = ownerToken;

  const health = await call('GET', '/health');
  check('بررسی سلامت', health.data?.status === 'ok');

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} گام موفق`,
  );
  process.exit(failed.length ? 1 : 0);
}

void main();
