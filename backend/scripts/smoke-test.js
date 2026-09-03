/**
 * دود تست انتشار: چرخه‌ی کامل سامانه روی نصب تازه.
 * هر گام مستقل گزارش می‌شود تا شکست دقیقا مشخص باشد.
 */
const BASE = process.env.BASE ?? 'http://localhost:3000/api/v1';

const results = [];
let token = '';

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

  const form = await call('POST', '/forms', {
    workspaceId,
    title: 'نظرسنجی دود',
    slug: `smoke-${Date.now()}`,
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
    pages: [
      {
        id: 'p1',
        title: 'صفحه ۱',
        questions: [
          { id: 'rate', type: 'rating', title: 'امتیاز؟', scoring: { indexId: 'i1' } },
        ],
      },
      {
        id: 'p2',
        title: 'صفحه ۲',
        questions: [{ id: 'why', type: 'long_text', title: 'چرا {{rate}}؟' }],
      },
    ],
  });
  const formId = form.data?.id;
  check('ساخت فرم با منطق و شاخص', Boolean(formId), form.data?.message ?? '');

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
  check('منطق نمایش و Piping', piped === 'چرا 2؟', piped ?? '');

  const hidden = await call('POST', `/public/forms/${formToken}/next`, {
    currentPageId: 'p1',
    answers: { rate: 9 },
  });
  check(
    'پنهان شدن سوال شرطی',
    (hidden.data?.page?.questions?.length ?? -1) === 0,
  );

  const submit = await call('POST', `/public/forms/${formToken}/submit`, {
    answers: { rate: 9, why: 'نباید ذخیره شود' },
  });
  check('ثبت پاسخ', submit.data?.status === 'completed');
  check('حذف پاسخ سوال پنهان', submit.data?.scores?.sat === 9);

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
  check('ارسال کمپین', campaign.data?.sent === 2);

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

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} گام موفق`,
  );
  process.exit(failed.length ? 1 : 0);
}

void main();
