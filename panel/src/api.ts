import axios from "axios";
import type {
  AccountInfo,
  ApiKey,
  AuthPayload,
  ContactList,
  Department,
  DepartmentMember,
  FlowGraph,
  FormAnalytics,
  FormDetail,
  FormPage,
  FormSummary,
  InvitationPreview,
  Menu,
  MenuSection,
  MenuTemplateSummary,
  MenuTheme,
  OrganizationRole,
  Portal,
  Publication,
  ResponseRow,
  TeamInvitation,
  TeamMember,
  Workspace,
} from "./types";

/** ورودی ساخت یا پیش‌نمایش اتصال به API بیرونی. */
export interface ContactSourceInput {
  listId: string;
  name: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  itemsPath?: string;
  mapping: Record<string, string>;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api/v1",
  /*
   * بدونِ تایم‌اوت، درخواستِ گیرکرده هیچ‌وقت خطا نمی‌داد و کاربر تا ابد
   * «در حال بارگذاری…» می‌دید. ۲۰ ثانیه برای گزارش‌های سنگین هم کافی است.
   */
  timeout: 20_000,
});

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common.Authorization = "Bearer " + token;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

/** پیام خطای خواناى فارسی از پاسخ سرور. */
export function describeError(error: unknown): string {
  const shaped = error as {
    code?: string;
    response?: { data?: { message?: string | string[] } };
  };
  // خطای شبکه‌ای/تایم‌اوت پیامِ سرور ندارد؛ بدونِ این، کاربر «خطا در ارتباط»
  // می‌دید در حالی که مشکل کندیِ سرور یا قطعیِ شبکه است.
  if (shaped?.code === 'ECONNABORTED' || shaped?.code === 'ETIMEDOUT') {
    return 'سرور در زمان مقرر پاسخ نداد. اتصال را بررسی کنید و دوباره تلاش کنید.';
  }
  if (shaped?.code === 'ERR_NETWORK') {
    return 'ارتباط با سرور برقرار نشد. اتصال شبکه را بررسی کنید.';
  }
  const message = shaped?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' | ');
  return message ?? 'خطا در ارتباط با سرور';
}

/*
 * نشستِ منقضی (۴۰۱): پاک‌کردنِ نشست و برگشت به صفحه‌ی ورود.
 *
 * فقط وقتی نشستی وجود دارد این کار انجام می‌شود؛ وگرنه رمزِ اشتباه در همان
 * صفحه‌ی ورود هم ۴۰۱ می‌گیرد و ری‌لود، پیامِ خطا را از بین می‌برد.
 * (عمداً از استورِ zustand استفاده نمی‌شود تا چرخه‌ی import نسازیم؛ ری‌لود
 * استور را از localStorage از نو می‌خواند.)
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    if (status === 401) {
      let hadSession = false;
      try {
        hadSession = Boolean(localStorage.getItem('samaline.auth'));
        localStorage.removeItem('samaline.auth');
      } catch {
        // حالتِ خصوصیِ مرورگر: نشستی هم ذخیره نشده بود.
      }
      setAuthToken(undefined);
      if (hadSession) window.location.reload();
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  register: (body: {
    fullName: string;
    email: string;
    password: string;
    organizationName: string;
    workspaceName: string;
  }) => api.post<AuthPayload>("/auth/register", body).then((r) => r.data),

  /**
   * ورود. حساب با ورود دومرحله‌ای بدون `totpCode` پاسخ
   * `{ twoFactorRequired: true }` می‌گیرد و توکنی صادر نمی‌شود.
   */
  login: (body: { email: string; password: string; totpCode?: string }) =>
    api
      .post<AuthPayload | { twoFactorRequired: true }>("/auth/login", body)
      .then((r) => r.data),

  /** تغییر رمز؛ نشست تازه برمی‌گرداند چون نشست‌های قبلی باطل می‌شوند. */
  changePassword: (currentPassword: string, newPassword: string) =>
    api
      .post<AuthPayload>("/auth/password", { currentPassword, newPassword })
      .then((r) => r.data),

  forgotPassword: (email: string) =>
    api
      .post<{ message: string }>("/auth/password/forgot", { email })
      .then((r) => r.data),

  resetPassword: (token: string, newPassword: string) =>
    api
      .post<{ ok: boolean }>("/auth/password/reset", { token, newPassword })
      .then((r) => r.data),

  /** حساب جاری: نقش در سازمان فعلی و فهرست سازمان‌های کاربر. */
  me: () => api.get<AccountInfo>("/auth/me").then((r) => r.data),

  switchOrganization: (organizationId: string) =>
    api
      .post<AuthPayload>("/auth/switch-organization", { organizationId })
      .then((r) => r.data),
};

export const apiKeysApi = {
  list: () => api.get<ApiKey[]>("/organization/api-keys").then((r) => r.data),

  /** کلید کامل فقط در همین پاسخ می‌آید و دیگر قابل بازیابی نیست. */
  create: (body: {
    name: string;
    role: OrganizationRole;
    expiresAt?: string;
  }) =>
    api
      .post<ApiKey & { apiKey: string }>("/organization/api-keys", body)
      .then((r) => r.data),

  revoke: (id: string) =>
    api.delete(`/organization/api-keys/${id}`).then((r) => r.data),
};

export const teamApi = {
  members: () => api.get<TeamMember[]>("/team/members").then((r) => r.data),

  changeRole: (memberId: string, role: OrganizationRole) =>
    api
      .patch<{
        id: string;
        role: OrganizationRole;
      }>(`/team/members/${memberId}`, { role })
      .then((r) => r.data),

  removeMember: (memberId: string) =>
    api.delete(`/team/members/${memberId}`).then((r) => r.data),

  invitations: () =>
    api.get<TeamInvitation[]>("/team/invitations").then((r) => r.data),

  /** لینک دعوت فقط همین یک بار برمی‌گردد؛ در سرور فقط هشش می‌ماند. */
  invite: (email: string, role: OrganizationRole) =>
    api
      .post<{
        id: string;
        email: string;
        role: OrganizationRole;
        expiresAt: string;
        link: string;
        emailStatus: string;
      }>("/team/invitations", { email, role })
      .then((r) => r.data),

  revokeInvitation: (invitationId: string) =>
    api.delete(`/team/invitations/${invitationId}`).then((r) => r.data),

  previewInvitation: (token: string) =>
    api
      .get<InvitationPreview>(`/public/invitations/${token}`)
      .then((r) => r.data),

  acceptInvitation: (body: {
    token: string;
    password: string;
    fullName?: string;
    totpCode?: string;
  }) =>
    api
      .post<
        AuthPayload | { twoFactorRequired: true }
      >("/public/invitations/accept", body)
      .then((r) => r.data),
};

export interface Webhook {
  id: string;
  event: string;
  targetUrl: string;
  secret: string;
  createdAt: string;
}

/** وبهوک‌های سازمان؛ با هر پاسخ کامل، بدنه‌ی امضاشده به نشانی مقصد می‌رود. */
export const webhooksApi = {
  list: () => api.get<Webhook[]>("/integrations/webhooks").then((r) => r.data),
  create: (targetUrl: string) =>
    api
      .post<Webhook>("/integrations/webhooks", {
        event: "response.completed",
        targetUrl,
      })
      .then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/integrations/webhooks/${id}`).then((r) => r.data),
};

export const twoFactorApi = {
  status: () => api.get<{ enabled: boolean }>("/auth/2fa").then((r) => r.data),
  setup: () =>
    api
      .post<{ secret: string; otpauthUrl: string }>("/auth/2fa/setup")
      .then((r) => r.data),
  enable: (code: string) =>
    api
      .post<{ enabled: boolean }>("/auth/2fa/enable", { code })
      .then((r) => r.data),
  disable: (code: string) =>
    api
      .post<{ enabled: boolean }>("/auth/2fa/disable", { code })
      .then((r) => r.data),
};

export const workspaceApi = {
  list: () => api.get<Workspace[]>("/workspaces").then((r) => r.data),
  create: (name: string) =>
    api.post<Workspace>("/workspaces", { name }).then((r) => r.data),
};

/** بخش‌ها و عضویتشان؛ پایه‌ی دسترسیِ فرم‌های عملیاتی. */
export interface RoomAsset {
  name: string;
  serial?: string;
  note?: string;
}

export interface HotelRoom {
  id: string;
  number: string;
  floor: number;
  kind: string;
  assets: RoomAsset[];
  isActive: boolean;
}

/** اتاق‌های هتل به‌عنوان داده‌ی پایه. */
export const roomsApi = {
  list: () => api.get<HotelRoom[]>('/rooms').then((r) => r.data),

  create: (body: Partial<HotelRoom>) =>
    api.post<HotelRoom>('/rooms', body).then((r) => r.data),

  update: (id: string, body: Partial<HotelRoom>) =>
    api.patch<HotelRoom>(`/rooms/${id}`, body).then((r) => r.data),

  remove: (id: string) =>
    api.delete<{ ok: boolean }>(`/rooms/${id}`).then((r) => r.data),

  bulk: (body: {
    floors: number;
    roomsPerFloor: number;
    numberingBase?: number;
    startFloor?: number;
    kind?: string;
  }) =>
    api
      .post<{ created: number; skipped: number }>('/rooms/bulk', body)
      .then((r) => r.data),
};

export interface PersonnelDocument {
  name: string;
  url?: string;
  note?: string;
}

export interface Personnel {
  id: string;
  fullName: string;
  mobile: string;
  employeeNo: string;
  position: string;
  departmentId: string | null;
  hireDate: string;
  documents: PersonnelDocument[];
  notes: string;
  isActive: boolean;
  /** حسابِ ورودِ پنلی که همین پرسنل است؛ null یعنی وصل‌نشده. */
  userId: string | null;
  /** سکوهای پیام‌رسانِ وصل‌شده؛ از `personnel_bot_links` می‌آید. */
  botPlatforms?: string[];
  /** @deprecated اتصال به `personnel_bot_links` منتقل شد. */
  botChatId: string | null;
  /** @deprecated اتصال به `personnel_bot_links` منتقل شد. */
  botPlatform: string;
}

/** پروندهٔ پرسنل به‌عنوان داده‌ی پایهٔ HR. */
export const hrApi = {
  list: () => api.get<Personnel[]>('/hr/personnel').then((r) => r.data),

  create: (body: Partial<Personnel>) =>
    api.post<Personnel>('/hr/personnel', body).then((r) => r.data),

  update: (id: string, body: Partial<Personnel>) =>
    api.patch<Personnel>(`/hr/personnel/${id}`, body).then((r) => r.data),

  remove: (id: string) =>
    api.delete<{ ok: boolean }>(`/hr/personnel/${id}`).then((r) => r.data),

  /**
   * خروجیِ اکسلِ HR (پرسنل، مرخصی، حضوروغیاب).
   *
   * مثلِ بقیهٔ خروجی‌ها blob گرفته می‌شود، چون اندپوینت هدرِ Authorization
   * می‌خواهد و لینکِ ساده توکن را نمی‌فرستد.
   */
  exportXlsx: async (
    kind: 'personnel' | 'leaves' | 'attendance',
    params: Record<string, string | undefined> = {},
  ) => {
    const response = await api.get<Blob>(`/hr/export/${kind}.xlsx`, {
      params,
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hr-${kind}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  },

  /** اتصال/قطعِ حسابِ ورودِ پنل به پروندهٔ پرسنل (کارِ منابع انسانی). */
  setUserLink: (id: string, userId: string | null) =>
    api
      .patch<Personnel>(`/hr/personnel/${id}/user-link`, { userId })
      .then((r) => r.data),

  /** اطلاعیهٔ سازمانی به رباتِ پرسنلِ وصل‌شده (فاز F). */
  announce: (body: { title: string; body: string; departmentId?: string | null }) =>
    api
      .post<{ sent: number; skipped: number }>("/hr/announcements", body)
      .then((r) => r.data),

  /** گزارش: خلاصهٔ درخواست‌های هر پرسنل. */
  requestStats: () =>
    api
      .get<
        Array<{
          personnelId: string;
          total: number;
          pending: number;
          approved: number;
          rejected: number;
        }>
      >("/hr/personnel/request-stats")
      .then((r) => r.data),

  /** تاریخچهٔ اطلاعیه‌های سازمان (فاز G). */
  announcements: () =>
    api.get<Announcement[]>("/hr/announcements").then((r) => r.data),
};

export interface Announcement {
  id: string;
  departmentId: string | null;
  title: string;
  body: string;
  sentByEmail: string;
  recipientCount: number;
  createdAt: string;
}

export interface UnitSetupResult {
  key: string;
  name: string;
  departmentId: string;
  department: "created" | "existing";
  form: "created" | "existing" | "skipped";
  dashboard: "created" | "existing";
  note?: string;
}

/** راه‌اندازیِ یک‌کلیکیِ واحدهای استانداردِ هتل. */
export const hotelSetupApi = {
  standardUnits: (workspaceId: string) =>
    api
      .post<UnitSetupResult[]>("/hotel-setup/standard-units", null, {
        params: { workspaceId },
      })
      .then((r) => r.data),

  /** ساختِ خودکارِ داشبورد + پرتال برای یک فرم. */
  formReport: (formId: string) =>
    api
      .post<{ dashboardId: string; portalSlug: string | null }>(
        "/hotel-setup/form-report",
        null,
        { params: { formId } },
      )
      .then((r) => r.data),
};

export const departmentsApi = {
  list: () => api.get<Department[]>('/departments').then((r) => r.data),

  /** بخش‌هایی که کاربرِ جاری عضوشان است. */
  mine: () => api.get<Department[]>('/departments/mine').then((r) => r.data),

  create: (body: { name: string; key?: string }) =>
    api.post<Department>('/departments', body).then((r) => r.data),

  rename: (id: string, body: { name?: string; key?: string }) =>
    api.patch<Department>(`/departments/${id}`, body).then((r) => r.data),

  remove: (id: string) =>
    api.delete<{ ok: boolean }>(`/departments/${id}`).then((r) => r.data),

  members: (id: string) =>
    api
      .get<DepartmentMember[]>(`/departments/${id}/members`)
      .then((r) => r.data),

  addMember: (id: string, userId: string) =>
    api
      .post<DepartmentMember>(`/departments/${id}/members`, { userId })
      .then((r) => r.data),

  removeMember: (id: string, userId: string) =>
    api
      .delete<{ ok: boolean }>(`/departments/${id}/members/${userId}`)
      .then((r) => r.data),
};

export const formsApi = {
  list: (workspaceId: string, includeArchived = false) =>
    api
      .get<FormSummary[]>("/forms", {
        params: { workspaceId, includeArchived },
      })
      .then((r) => r.data),

  get: (id: string) => api.get<FormDetail>(`/forms/${id}`).then((r) => r.data),

  create: (body: {
    workspaceId: string;
    title: string;
    slug: string;
    /** ساختار قالب سمت سرور باز می‌شود؛ با templateKey نیازی به pages نیست. */
    pages?: FormPage[];
    templateKey?: string;
    settings?: Record<string, unknown>;
    logic?: Record<string, unknown>;
    scoreConfig?: Record<string, unknown>;
  }) =>
    api
      .post<FormDetail & { planSkipped?: string[] }>("/forms", body)
      .then((r) => r.data),

  templates: () =>
    api.get<FormTemplateSummary[]>("/forms/templates").then((r) => r.data),

  update: (id: string, body: Record<string, unknown>) =>
    api.patch<FormDetail>(`/forms/${id}`, body).then((r) => r.data),

  /** بایگانی یا بازگرداندن؛ برگشت‌پذیر. */
  setArchived: (id: string, archived: boolean) =>
    api
      .patch<FormDetail>(`/forms/${id}/archived`, { archived })
      .then((r) => r.data),

  /**
   * حذف همیشگی. سرور تعداد پاسخ‌ها را با عددی که می‌فرستیم می‌سنجد و اگر
   * برابر نباشد رد می‌کند — پس عدد باید تازه خوانده شده باشد.
   */
  remove: (id: string, acknowledgedResponses: number) =>
    api
      .delete<{ ok: boolean; deletedResponses: number }>(`/forms/${id}`, {
        params: { acknowledgedResponses },
      })
      .then((r) => r.data),

  publishLink: (id: string) =>
    api.post<Publication>(`/forms/${id}/publish-link`).then((r) => r.data),

  /** چه کسی اجازه‌ی پر کردن فرم را دارد (باز / رمزدار / کارمند). */
  setAuthMode: (id: string, authMode: string, password?: string) =>
    api
      .patch<Publication>(`/forms/${id}/auth-mode`, {
        authMode,
        ...(password ? { password } : {}),
      })
      .then((r) => r.data),

  logicAnalysis: (id: string) =>
    api
      .get<{
        errors: string[];
        warnings: string[];
        isValid: boolean;
      }>(`/forms/${id}/logic-analysis`)
      .then((r) => r.data),

  flowGraph: (id: string) =>
    api.get<FlowGraph>(`/forms/${id}/flow-graph`).then((r) => r.data),

  setSlug: (id: string, slug: string) =>
    api.patch<Publication>(`/forms/${id}/slug`, { slug }).then((r) => r.data),

  slugAvailability: (slug: string) =>
    api
      .get<{
        available: boolean;
        reason: string | null;
      }>(`/forms/slug-availability/${encodeURIComponent(slug)}`)
      .then((r) => r.data),
};

export const reportsApi = {
  summary: (formId: string) =>
    api
      .get<{
        views: number;
        started: number;
        completed: number;
        /** درصد بازدیدهایی که به پاسخ کامل رسیده‌اند. */
        responseRate: number;
        /** درصد شروع‌کننده‌هایی که تا آخر رفته‌اند. */
        completionRate: number;
        averageDurationSeconds: number | null;
      }>(`/reports/forms/${formId}/summary`)
      .then((r) => r.data),

  /**
   * یک صفحه از پاسخ‌ها + شمارشِ کل.
   *
   * سرور به‌جای «۵۰۰ ردیفِ اول و سکوت»، صفحه‌بندی و `total` می‌دهد؛ پنل با
   * همین عدد «۱–۱۰۰ از N» را نشان می‌دهد.
   */
  responses: (
    formId: string,
    params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) =>
    api
      .get<{
        rows: ResponseRow[];
        total: number;
        page: number;
        pageSize: number;
      }>(`/reports/forms/${formId}/responses`, { params })
      .then((r) => r.data),

  /**
   * دانلود خروجی. چون اندپوینت با هدر Authorization محافظت می‌شود،
   * فایل را به‌صورت blob می‌گیریم و در مرورگر ذخیره می‌کنیم.
   */
  download: async (
    formId: string,
    format: "xlsx" | "csv" | "pptx",
    advanced = false,
  ) => {
    const response = await api.get<Blob>(
      `/reports/forms/${formId}/export.${format}`,
      { params: { advanced }, responseType: "blob" },
    );

    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${format === "pptx" ? "report" : "responses"}-${formId}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  },

  /** تجمیع همه‌ی سوال‌ها برای گزارش تصویری. */
  analytics: (formId: string, range?: { from?: string; to?: string }) =>
    api
      .get<FormAnalytics>(`/reports/forms/${formId}/analytics`, {
        params: range,
      })
      .then((r) => r.data),

  breakdown: (questionId: string, formId: string) =>
    api
      .get<
        Array<{ label: string; count: number }>
      >(`/reports/questions/${questionId}/breakdown`, { params: { formId } })
      .then((r) => r.data),
};

export interface PendingReview {
  responseId: string;
  formId: string;
  formTitle: string;
  respondentKey: string | null;
  submittedAt: string | null;
  requestedAt: string | null;
  answers: Record<string, unknown>;
}

/** گردش‌کارِ تأیید روی پاسخ‌نامه‌ها (درخواست‌های HR؛ فاز E/H). */
export const responsesApi = {
  review: (
    responseId: string,
    body: { decision: "approved" | "rejected"; note?: string },
  ) =>
    api
      .patch<ResponseRow>(`/responses/${responseId}/review`, body)
      .then((r) => r.data),

  /** کارتابلِ درخواست‌های در انتظارِ تأیید در یک فضای کاری (فاز H). */
  pending: (workspaceId: string) =>
    api
      .get<PendingReview[]>("/responses/pending", { params: { workspaceId } })
      .then((r) => r.data),

  /** فقط شمارِ معلق‌ها — برای نشانِ منو (فاز H). */
  pendingCount: (workspaceId: string) =>
    api
      .get<{ count: number }>("/responses/pending/count", {
        params: { workspaceId },
      })
      .then((r) => r.data),
};

export const contactsApi = {
  lists: () => api.get<ContactList[]>("/contacts/lists").then((r) => r.data),

  createList: (name: string) =>
    api.post<ContactList>("/contacts/lists", { name }).then((r) => r.data),

  importCsv: (listId: string, csv: string) =>
    api
      .post<{
        created: number;
        updated: number;
        skipped: string[];
      }>(`/contacts/lists/${listId}/import`, { csv })
      .then((r) => r.data),

  contacts: (listId: string) =>
    api
      .get<
        Array<{
          id: string;
          fullName: string | null;
          mobile: string | null;
          email: string | null;
          unsubscribed: boolean;
        }>
      >(`/contacts/lists/${listId}/contacts`)
      .then((r) => r.data),

  // ── اتصال به API نرم‌افزارهای دیگر ──
  sources: () =>
    api
      .get<
        Array<{
          id: string;
          name: string;
          url: string;
          listId: string;
          itemsPath: string;
          headerKeys: string[];
          lastSyncedAt: string | null;
          lastResult: Record<string, unknown>;
        }>
      >("/contacts/sources")
      .then((r) => r.data),

  previewSource: (body: ContactSourceInput) =>
    api
      .post<{
        totalFetched: number;
        usable: number;
        unusable: number;
        sampleRaw: Array<Record<string, unknown>>;
        sampleMapped: Array<Record<string, unknown>>;
      }>("/contacts/sources/preview", body)
      .then((r) => r.data),

  createSource: (body: ContactSourceInput) =>
    api.post("/contacts/sources", body).then((r) => r.data),

  syncSource: (sourceId: string) =>
    api
      .post<{
        fetched: number;
        created: number;
        updated: number;
        unusable: number;
      }>(`/contacts/sources/${sourceId}/sync`)
      .then((r) => r.data),

  removeSource: (sourceId: string) =>
    api.delete(`/contacts/sources/${sourceId}`).then((r) => r.data),

  recipients: (listId: string, channel: "sms" | "email") =>
    api
      .get<
        Array<{ to: string; variables: Record<string, unknown> }>
      >(`/contacts/lists/${listId}/recipients`, { params: { channel } })
      .then((r) => r.data),
};

export const messagingApi = {
  status: () =>
    api
      .get<{
        providers: { sms: string; email: string };
        queue: { pending: number; active: number };
      }>("/messaging/status")
      .then((r) => r.data),

  sendCampaign: (body: {
    publicationId: string;
    channel: "sms" | "email";
    recipients: Array<{ to: string; variables?: Record<string, unknown> }>;
    template: string;
    subject?: string;
  }) =>
    api
      .post<{
        total: number;
        sent: number;
        failed: number;
      }>("/messaging/campaigns", body)
      .then((r) => r.data),

  pending: (publicationId: string) =>
    api
      .get<
        Array<{ recipient: string; respondentKey: string }>
      >(`/messaging/campaigns/${publicationId}/pending`)
      .then((r) => r.data),
};

export const aiApi = {
  createSurvey: (goal: string) =>
    api
      .post<Record<string, unknown>>("/ai/generate-form", { goal })
      .then((r) => r.data),

  review: (structure: Record<string, unknown>) =>
    api
      .post<Record<string, unknown>>("/ai/review-form", { structure })
      .then((r) => r.data),

  analyze: (answers: string[]) =>
    api
      .post<Record<string, unknown>>("/ai/analyze-open-text", { answers })
      .then((r) => r.data),
};

export interface DashboardWidget {
  id: string;
  type:
    | "stat"
    | "bar"
    | "nps"
    | "text"
    | "score"
    | "trend"
    | "table"
    | "verbatim";
  title: string;
  formId?: string;
  questionId?: string;
  metric?: string;
  scoreKey?: string;
  content?: string;
  /** گامِ زمانیِ ویجتِ روند. */
  interval?: "day" | "week" | "month";
  /** سقفِ ردیف در جدول/نظرها. */
  limit?: number;
  layout: { x: number; y: number; w: number; h: number };
}

export interface WidgetData extends DashboardWidget {
  value?: number | string;
  series?: Array<{ label: string; count: number }>;
  error?: string;
  /** ردیف‌های ویجتِ جدول؛ هر کدام به خودِ پاسخ می‌رسد. */
  rows?: Array<{
    responseId: string;
    submittedAt: string | null;
    score?: number | null;
    summary: string;
  }>;
  /** نظرهای متنیِ اخیر. */
  quotes?: Array<{ responseId: string; text: string; at: string | null }>;
  /** درصدِ تغییر نسبت به نیمهٔ اولِ بازه. */
  changePercent?: number | null;
}

export interface Dashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  isPublic: boolean;
  publicToken: string | null;
  /** بخشِ مالک؛ null یعنی داشبوردِ عمومیِ سازمان. */
  departmentId?: string | null;
}

export const dashboardsApi = {
  list: () => api.get<Dashboard[]>("/dashboards").then((r) => r.data),

  create: (name: string, departmentId?: string | null) =>
    api
      .post<Dashboard>("/dashboards", { name, departmentId })
      .then((r) => r.data),

  get: (id: string) =>
    api.get<Dashboard>(`/dashboards/${id}`).then((r) => r.data),

  data: (id: string, range: { from?: string; to?: string } = {}) =>
    api
      .get<{
        id: string;
        name: string;
        isPublic: boolean;
        publicToken: string | null;
        widgets: WidgetData[];
      }>(`/dashboards/${id}/data`, {
        // بازه‌ی خالی فرستاده نمی‌شود تا «از ابتدا» معنای خودش را بدهد.
        params: {
          ...(range.from ? { from: range.from } : {}),
          ...(range.to ? { to: range.to } : {}),
        },
      })
      .then((r) => r.data),

  update: (id: string, body: { name?: string; widgets?: DashboardWidget[] }) =>
    api.patch<Dashboard>(`/dashboards/${id}`, body).then((r) => r.data),

  setPublic: (id: string, isPublic: boolean) =>
    api
      .patch<{
        isPublic: boolean;
        publicToken: string | null;
      }>(`/dashboards/${id}/public`, { isPublic })
      .then((r) => r.data),

  remove: (id: string) => api.delete(`/dashboards/${id}`).then((r) => r.data),
};

export const plansApi = {
  policy: (organizationId: string) =>
    api
      .get<Record<string, unknown>>(`/plans/policy/${organizationId}`)
      .then((r) => r.data),
};

/** فراداده‌ی یک قالب آماده. */
export interface FormTemplateSummary {
  key: string;
  title: string;
  summary: string;
  category: string;
  icon: string;
  questionCount: number;
}

/** تنظیمات سراسری سکو؛ فقط سوپرادمین. */
export interface PlatformSettings {
  footerEnabled: boolean;
  footerText: string;
  footerUrl: string;
  registrationEnabled: boolean;
  aiProvider: "mock" | "openai";
  aiBaseUrl: string;
  aiModel: string;
  /** کلید هرگز برنمی‌گردد؛ فقط می‌دانیم تنظیم شده یا نه. */
  aiApiKeySet?: boolean;
}

/** تکه‌ای از تنظیمات که سوپرادمین می‌فرستد؛ aiApiKey فقط هنگام تغییر. */
export type PlatformSettingsPatch = Partial<
  Omit<PlatformSettings, "aiApiKeySet">
> & { aiApiKey?: string };

/** تنظیمات عمومی که پیش از ورود خوانده می‌شوند. */
export interface PublicConfig {
  registrationEnabled: boolean;
}

export interface ManagerOverview {
  days: number;
  totals: { current: number; previous: number; changePct: number | null };
  review: { pending: number; approved: number; rejected: number };
  activeForms: number;
  series: Array<{ date: string; count: number }>;
  byUnit: Array<{ departmentId: string | null; name: string; count: number }>;
  topForms: Array<{ formId: string; title: string; count: number }>;
}

/** نمای کلیِ مدیریتی (داشبوردِ مدیر). */
export const overviewApi = {
  get: (workspaceId: string, days: number) =>
    api
      .get<ManagerOverview>("/reports/overview", {
        params: { workspaceId, days },
      })
      .then((r) => r.data),
};

/** ابزارِ تنظیمِ هوش مصنوعی برای سوپرادمین (روی تنظیماتِ ذخیره‌شده کار می‌کند). */
export const aiAdminApi = {
  models: () =>
    api
      .get<{ provider: string; models: string[]; error?: string }>(
        "/ai/admin/models",
      )
      .then((r) => r.data),

  test: () =>
    api
      .post<{ ok: boolean; provider: string; model?: string; message: string }>(
        "/ai/admin/test",
      )
      .then((r) => r.data),
};

export interface PlatformOverview {
  organizations: number;
  users: number;
  workspaces: number;
  forms: number;
  activeForms: number;
  responses: number;
  completedResponses: number;
  departments: number;
  personnel: number;
}

export const platformApi = {
  me: () =>
    api.get<{ isSuperAdmin: boolean }>("/platform/me").then((r) => r.data),

  overview: () =>
    api.get<PlatformOverview>("/platform/overview").then((r) => r.data),

  publicConfig: () =>
    api.get<PublicConfig>("/platform/public-config").then((r) => r.data),

  getSettings: () =>
    api.get<PlatformSettings>("/platform/settings").then((r) => r.data),

  updateSettings: (body: PlatformSettingsPatch) =>
    api.patch<PlatformSettings>("/platform/settings", body).then((r) => r.data),

  /** همه‌ی فضاهای کاری سکو؛ فقط برای سوپرادمین. */
  workspaces: () =>
    api
      .get<
        Array<{
          id: string;
          name: string;
          organizationId: string;
          organizationName: string;
        }>
      >("/platform/workspaces")
      .then((r) => r.data),
};

export type PlanCode = "free" | "pro" | "org" | "enterprise";

export interface OrganizationOverview {
  organization: { id: string; name: string; createdAt: string };
  subscription: {
    planCode: PlanCode;
    expiresAt: string | null;
    isActive: boolean;
  } | null;
}

/** مدیریت سازمان‌ها و پلن‌ها؛ فقط سوپرادمین. */
export const adminApi = {
  organizations: () =>
    api
      .get<OrganizationOverview[]>("/admin/organizations-overview")
      .then((r) => r.data),

  setPlan: (organizationId: string, planCode: PlanCode, expiresAt?: string) =>
    api
      .patch(`/admin/organizations/${organizationId}/plan`, {
        planCode,
        expiresAt: expiresAt || undefined,
      })
      .then((r) => r.data),
};

export const uploadApi = {
  /** آپلود تصویر (لوگو) و گرفتن نشانی عمومی آن. */
  image: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const response = await api.post<{ url: string; fileName: string }>(
      "/uploads/image",
      form,
    );
    return response.data;
  },
};

/**
 * نشانی مطلق یک فایل آپلودشده.
 *
 * سرور نشانی نسبی (`/uploads/...`) می‌دهد چون خودش نمی‌داند از کجا دیده
 * می‌شود؛ ولی این نشانی در تم فرم ذخیره و به رندرر (روی دامنه‌ی دیگر)
 * فرستاده می‌شود، پس باید مطلق شود.
 */
export function absoluteUploadUrl(url: string): string {
  if (!url || /^https?:\/\//.test(url)) return url;
  const base = (api.defaults.baseURL ?? "").replace(/\/api\/v1\/?$/, "");
  return `${base}${url}`;
}

/** وضعیت ربات تلگرام/بله؛ توکن هرگز از سرور برنمی‌گردد. */
export interface TelegramBotStatus {
  configured: boolean;
  isActive: boolean;
  /** پیام‌رسان مقصد: تلگرام یا بله. */
  platform: "telegram" | "bale";
  botUsername: string | null;
  lastError: string | null;
  lastSentAt: string | null;
}

export interface TelegramRecipient {
  id: string;
  formId: string | null;
  chatId: string;
  label: string;
  scoreThreshold: number | null;
  isActive: boolean;
  /** گزارش دوره‌ای؛ جدا از اعلان تک‌تک پاسخ‌ها. */
  digest: "none" | "weekly" | "monthly";
  notifyOnResponse: boolean;
  lastError: string | null;
  lastSentAt: string | null;
}

export const telegramApi = {
  getBot: (workspaceId: string) =>
    api
      .get<TelegramBotStatus>("/integrations/telegram", {
        params: { workspaceId },
      })
      .then((r) => r.data),

  saveBot: (
    workspaceId: string,
    body: {
      botToken?: string;
      platform?: "telegram" | "bale";
      isActive?: boolean;
    },
  ) =>
    api
      .post<TelegramBotStatus>("/integrations/telegram", body, {
        params: { workspaceId },
      })
      .then((r) => r.data),

  removeBot: (workspaceId: string) =>
    api
      .delete("/integrations/telegram", { params: { workspaceId } })
      .then((r) => r.data),

  /** گفتگوهایی که به‌تازگی به ربات پیام داده‌اند. */
  chats: (workspaceId: string) =>
    api
      .get<
        Array<{ id: string; title: string }>
      >("/integrations/telegram/chats", { params: { workspaceId } })
      .then((r) => r.data),

  recipients: (workspaceId: string) =>
    api
      .get<TelegramRecipient[]>("/integrations/telegram/recipients", {
        params: { workspaceId },
      })
      .then((r) => r.data),

  addRecipient: (
    workspaceId: string,
    body: {
      formId: string | null;
      chatId: string;
      label?: string;
      scoreThreshold?: number | null;
    },
  ) =>
    api
      .post<TelegramRecipient>("/integrations/telegram/recipients", body, {
        params: { workspaceId },
      })
      .then((r) => r.data),

  updateRecipient: (
    workspaceId: string,
    id: string,
    body: {
      label?: string;
      scoreThreshold?: number | null;
      isActive?: boolean;
      digest?: "none" | "weekly" | "monthly";
      notifyOnResponse?: boolean;
    },
  ) =>
    api
      .patch<TelegramRecipient>(
        `/integrations/telegram/recipients/${id}`,
        body,
        { params: { workspaceId } },
      )
      .then((r) => r.data),

  removeRecipient: (workspaceId: string, id: string) =>
    api
      .delete(`/integrations/telegram/recipients/${id}`, {
        params: { workspaceId },
      })
      .then((r) => r.data),

  /** کد یک‌بارمصرف برای وصل شدن مدیر از داخل خود ربات. */
  createLinkCode: (
    workspaceId: string,
    body: { formId: string | null; label?: string; maxUses?: number },
  ) =>
    api
      .post<{
        code: string;
        expiresAt: string;
        expiresInMinutes: number;
        maxUses: number | null;
        botUsername: string | null;
      }>("/integrations/telegram/link-code", body, { params: { workspaceId } })
      .then((r) => r.data),

  test: (workspaceId: string, id: string) =>
    api
      .post<{
        ok: boolean;
      }>(`/integrations/telegram/recipients/${id}/test`, null, {
        params: { workspaceId },
      })
      .then((r) => r.data),
};

/** گیرنده‌ی گزارش دوره‌ای ایمیلی. */
export interface EmailReportRecipient {
  id: string;
  formId: string | null;
  email: string;
  label: string;
  digest: "weekly" | "monthly";
  isActive: boolean;
  lastError: string | null;
  lastSentAt: string | null;
}

export const emailReportApi = {
  list: (workspaceId: string) =>
    api
      .get<EmailReportRecipient[]>("/integrations/email-reports", {
        params: { workspaceId },
      })
      .then((r) => r.data),

  add: (
    workspaceId: string,
    body: {
      formId: string | null;
      email: string;
      label?: string;
      digest?: "weekly" | "monthly";
    },
  ) =>
    api
      .post<EmailReportRecipient>("/integrations/email-reports", body, {
        params: { workspaceId },
      })
      .then((r) => r.data),

  update: (
    workspaceId: string,
    id: string,
    body: { label?: string; digest?: "weekly" | "monthly"; isActive?: boolean },
  ) =>
    api
      .patch<EmailReportRecipient>(`/integrations/email-reports/${id}`, body, {
        params: { workspaceId },
      })
      .then((r) => r.data),

  remove: (workspaceId: string, id: string) =>
    api
      .delete(`/integrations/email-reports/${id}`, { params: { workspaceId } })
      .then((r) => r.data),

  test: (workspaceId: string, id: string) =>
    api
      .post<{
        ok: boolean;
      }>(`/integrations/email-reports/${id}/test`, null, { params: { workspaceId } })
      .then((r) => r.data),
};

export const menusApi = {
  templates: () =>
    api.get<MenuTemplateSummary[]>("/menus/templates").then((r) => r.data),

  /** ظاهرهای آماده‌ی صفحه‌ی منو. */
  themes: () => api.get<MenuTheme[]>("/menus/themes").then((r) => r.data),

  list: (workspaceId: string) =>
    api.get<Menu[]>("/menus", { params: { workspaceId } }).then((r) => r.data),

  save: (
    workspaceId: string,
    id: string | null,
    body: Partial<{
      slug: string;
      title: string;
      description: string;
      logoUrl: string;
      images: string[];
      sections: MenuSection[];
      isActive: boolean;
      templateKey: string;
      theme: string;
    }>,
  ) =>
    api
      .post<Menu>(id ? `/menus/${id}` : "/menus", body, {
        params: { workspaceId },
      })
      .then((r) => r.data),

  remove: (workspaceId: string, id: string) =>
    api.delete(`/menus/${id}`, { params: { workspaceId } }).then((r) => r.data),
};

export const portalsApi = {
  list: (workspaceId: string) =>
    api
      .get<Portal[]>("/portals", { params: { workspaceId } })
      .then((r) => r.data),

  save: (
    workspaceId: string,
    id: string | null,
    body: {
      slug: string;
      title: string;
      description?: string;
      logoUrl?: string;
      formIds: string[];
      isActive: boolean;
      departmentId?: string | null;
    },
  ) =>
    api
      .post<Portal>(id ? `/portals/${id}` : "/portals", body, {
        params: { workspaceId },
      })
      .then((r) => r.data),

  remove: (workspaceId: string, id: string) =>
    api
      .delete(`/portals/${id}`, { params: { workspaceId } })
      .then((r) => r.data),
};

export interface ServiceStatus {
  name: string;
  description: string;
  activeState: string;
  subState: string;
  isSelf: boolean;
  since: string | null;
  memoryBytes: number | null;
}

/** پایش و کنترل سرویس‌های سامانه؛ فقط سوپرادمین. */
export const opsApi = {
  services: () =>
    api
      .get<{ supported: boolean; services: ServiceStatus[] }>("/ops/services")
      .then((r) => r.data),

  control: (name: string, action: "start" | "stop" | "restart") =>
    api
      .post<{
        ok: boolean;
        message: string;
      }>(`/ops/services/${encodeURIComponent(name)}/${action}`)
      .then((r) => r.data),
};

// ── لاگ ممیزی ───────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  action: string;
  actorType: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export const auditApi = {
  list: () => api.get<AuditEntry[]>('/audit').then((r) => r.data),
};

// ── دامنهٔ فنی (CMMS) ────────────────────────────────────────────────────

/** یک سطلِ قابلِ‌اقدام روی داشبوردِ عملیاتی. */
export interface OpsBucket {
  key: string;
  label: string;
  count: number;
  /** روی کدام فهرست drill-down می‌کند. */
  kind: 'request' | 'workOrder' | 'asset' | 'part';
  /** فیلتری که همان فهرست را بازمی‌سازد. */
  filter: Record<string, unknown>;
  tone: 'info' | 'warn' | 'danger';
}

export interface OpsActivity {
  kind: 'request' | 'workOrder';
  id: string;
  number: string;
  title: string;
  status: string;
  at: string;
}

export interface OpsDashboard {
  buckets: OpsBucket[];
  workload: Array<{ personnelId: string; name: string; openCount: number }>;
  recent: OpsActivity[];
  cost: {
    internal: number;
    contractor: number;
    laborMinutes: number;
    days: number;
  };
  /** ارزشِ انبار و مصرفِ ۳۰ روز؛ از سرویسِ انبار می‌آید. */
  inventory?: {
    valuation: number;
    consumption: { cost: number; quantity: number; days: number };
  };
  generatedAt: string;
}

export interface CmmsPage<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MaintenanceRequest {
  id: string;
  number: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  departmentId: string | null;
  roomId: string | null;
  assetId: string | null;
  location: string;
  dueDate: string;
  guestRelated: boolean;
  createdAt: string;
}

export interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  category: string;
  dueDate: string;
  laborMinutes: number;
  internalCost: number;
  contractorCost: number;
  createdAt: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
  criticality: string;
  location: string;
  createdAt: string;
}

/** پارامترهای فهرست؛ همان چیزی که سطل‌ها در `filter` می‌دهند. */
export type CmmsQuery = Record<string, unknown>;

export const cmmsApi = {
  dashboard: (departmentId?: string) =>
    api
      .get<OpsDashboard>('/cmms/dashboard', {
        params: departmentId ? { departmentId } : {},
      })
      .then((r) => r.data),

  requests: (query: CmmsQuery = {}) =>
    api
      .get<CmmsPage<MaintenanceRequest>>('/cmms/requests', { params: query })
      .then((r) => r.data),

  workOrders: (query: CmmsQuery = {}) =>
    api
      .get<CmmsPage<WorkOrder>>('/cmms/work-orders', { params: query })
      .then((r) => r.data),

  /**
   * خروجیِ اکسلِ درخواست‌ها یا دستورهای کار، با همان فیلترهای فهرست.
   *
   * اندپوینت با هدر Authorization محافظت می‌شود، پس فایل را به‌صورت blob
   * می‌گیریم و در مرورگر ذخیره می‌کنیم؛ همان الگوی خروجیِ گزارش‌ها.
   */
  exportXlsx: async (
    kind: 'requests' | 'work-orders',
    query: CmmsQuery = {},
  ) => {
    const response = await api.get<Blob>(`/cmms/export/${kind}.xlsx`, {
      params: query,
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cmms-${kind}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  },

  assets: (query: CmmsQuery = {}) =>
    api.get<CmmsPage<Asset>>('/cmms/assets', { params: query }).then((r) => r.data),

  createAsset: (body: Record<string, unknown>) =>
    api.post<Asset>('/cmms/assets', body).then((r) => r.data),

  request: (id: string) =>
    api.get<MaintenanceRequest>(`/cmms/requests/${id}`).then((r) => r.data),

  workOrder: (id: string) =>
    api
      .get<WorkOrder & { technicians: Array<{ personnelId: string; isPrimary: boolean }> }>(
        `/cmms/work-orders/${id}`,
      )
      .then((r) => r.data),

  createRequest: (body: Partial<MaintenanceRequest>) =>
    api.post<MaintenanceRequest>('/cmms/requests', body).then((r) => r.data),

  setRequestStatus: (id: string, status: string, note?: string) =>
    api
      .patch<MaintenanceRequest>(`/cmms/requests/${id}/status`, { status, note })
      .then((r) => r.data),

  createWorkOrder: (body: Record<string, unknown>) =>
    api.post<WorkOrder>('/cmms/work-orders', body).then((r) => r.data),

  setWorkOrderStatus: (id: string, status: string, note?: string) =>
    api
      .patch<WorkOrder>(`/cmms/work-orders/${id}/status`, { status, note })
      .then((r) => r.data),

  // ── انبارِ قطعات ───────────────────────────────────────────────────────

  parts: (query: CmmsQuery = {}) =>
    api
      .get<CmmsPage<SparePart>>('/cmms/parts', { params: query })
      .then((r) => r.data),

  createPart: (body: Record<string, unknown>) =>
    api.post<SparePart>('/cmms/parts', body).then((r) => r.data),

  updatePart: (id: string, body: Record<string, unknown>) =>
    api.patch<SparePart>(`/cmms/parts/${id}`, body).then((r) => r.data),

  stockMovements: (query: CmmsQuery = {}) =>
    api
      .get<CmmsPage<StockMovement>>('/cmms/stock-movements', { params: query })
      .then((r) => r.data),

  move: (body: Record<string, unknown>) =>
    api.post<StockMovement>('/cmms/stock-movements', body).then((r) => r.data),

  recount: (id: string, countedQuantity: number, note?: string) =>
    api
      .post<{ part: SparePart }>(`/cmms/parts/${id}/recount`, {
        countedQuantity,
        note,
      })
      .then((r) => r.data),
};

/** قطعهٔ انبار. */
export interface SparePart {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost: number;
  location: string;
  supplier: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
}

/** یک سطرِ دفترِ گردشِ انبار. */
export interface StockMovement {
  id: string;
  partId: string;
  partCode: string;
  partName: string;
  partUnit: string;
  type: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  balanceAfter: number;
  workOrderId: string | null;
  reference: string;
  note: string;
  createdAt: string;
}

// ── مرخصی و ماندهٔ آن (HR) ──────────────────────────────────────────────

export interface LeaveRequest {
  id: string;
  number: string;
  personnelId: string;
  /** نامِ پرسنل؛ سرور آن را به ردیف می‌چسباند. */
  personnelName?: string;
  employeeNo?: string;
  departmentId: string | null;
  type: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: string;
  decisionNote: string;
  decidedAt: string | null;
  createdAt: string;
}

export interface LeaveBalanceRow {
  type: string;
  entitled: number;
  used: number;
  remaining: number;
}

export interface HrBucket {
  key: string;
  label: string;
  count: number;
  kind: 'leave' | 'personnel';
  filter: Record<string, unknown>;
  tone: 'info' | 'warn' | 'danger';
}

export interface HrSummary {
  buckets: HrBucket[];
  headcount: number;
  terminated: number;
  generatedAt: string;
}

export const leavesApi = {
  summary: () => api.get<HrSummary>('/hr/leaves/summary').then((r) => r.data),

  list: (query: Record<string, unknown> = {}) =>
    api
      .get<{
        rows: LeaveRequest[];
        total: number;
        page: number;
        pageSize: number;
      }>('/hr/leaves', { params: query })
      .then((r) => r.data),

  create: (body: {
    personnelId: string;
    type?: string;
    fromDate: string;
    toDate: string;
    reason?: string;
    days?: number;
  }) => api.post<LeaveRequest>('/hr/leaves', body).then((r) => r.data),

  decide: (id: string, status: string, note?: string) =>
    api
      .patch<LeaveRequest>(`/hr/leaves/${id}/decision`, { status, note })
      .then((r) => r.data),

  balance: (personnelId: string, year: number) =>
    api
      .get<LeaveBalanceRow[]>(`/hr/leaves/balance/${personnelId}`, {
        params: { year },
      })
      .then((r) => r.data),

  setBalance: (body: {
    personnelId: string;
    year: number;
    type?: string;
    entitledDays: number;
  }) => api.post('/hr/leaves/balance', body).then((r) => r.data),
};

// ── «خودم»: پروندهٔ متصل و پیام‌رسان‌ها ─────────────────────────────────

export interface MyProfile {
  linked: boolean;
  personnel: {
    id: string;
    fullName: string;
    position: string;
    departmentId: string | null;
    employeeNo: string;
    mobile: string;
    employmentStatus: string;
  } | null;
  botLinks: Array<{ platform: string; linkedAt: string }>;
  /** سکوهایی که همین حالا پشتیبانی می‌شوند. */
  platforms: string[];
}

export interface BotLinkCode {
  code: string;
  expiresAt: string;
  expiresInMinutes: number;
  botUsername: string | null;
  platform: string | null;
  /** لینکِ آماده؛ اگر نامِ کاربریِ ربات معلوم نباشد null است. */
  deepLink: string | null;
}

export const meApi = {
  profile: () => api.get<MyProfile>('/me/profile').then((r) => r.data),

  createBotLinkCode: () =>
    api.post<BotLinkCode>('/me/bot-links/code').then((r) => r.data),

  removeBotLink: (platform: string) =>
    api
      .delete<{ unlinked: boolean }>(`/me/bot-links/${platform}`)
      .then((r) => r.data),

  desk: () => api.get<MyDesk>('/me/desk').then((r) => r.data),

  /** ثبتِ مرخصیِ خودم؛ پرونده از توکن می‌آید، نه از بدنه. */
  requestLeave: (body: Record<string, unknown>) =>
    api.post('/me/leaves', body).then((r) => r.data),
};

// ── میزِ کارِ شخصی ──────────────────────────────────────────────────────

export interface MyAttentionItem {
  key: string;
  text: string;
  count: number;
  tone: 'info' | 'warn' | 'danger';
  href: string;
}

export interface MyDesk {
  linked: boolean;
  /** وقتی وصل نیست: دلیلِ روشن به‌جای عددهای صفر. */
  reason?: string;
  generatedAt: string;
  date?: string;
  me?: {
    personnelId: string;
    fullName: string;
    position: string;
    departmentId: string | null;
  };
  attention?: MyAttentionItem[];
  tasks?: {
    open: number;
    toStart: number;
    inProgress: number;
    overdue: number;
    rows: Array<{
      id: string;
      number: string;
      title: string;
      status: string;
      priority: string;
      dueDate: string;
      isOverdue: boolean;
    }>;
  };
  requests?: {
    total: number;
    rows: Array<{
      id: string;
      number: string;
      title: string;
      status: string;
      priority: string;
      createdAt: string;
    }>;
  };
  leaves?: {
    pending: number;
    rows: Array<{
      id: string;
      number: string;
      type: string;
      status: string;
      fromDate: string;
      toDate: string;
      days: number;
    }>;
    balance: Array<{
      type: string;
      entitledDays: number;
      usedDays: number;
      remainingDays: number;
    }>;
  };
  shifts?: {
    today: Array<{
      id: string;
      label: string;
      startTime: string;
      endTime: string;
      note: string;
    }>;
    week: Array<{
      id: string;
      date: string;
      label: string;
      startTime: string;
      endTime: string;
    }>;
  };
  attendance?: {
    today: {
      status: string;
      checkIn: string;
      checkOut: string;
      minutesWorked: number;
    } | null;
    month: {
      from: string;
      to: string;
      byStatus: Record<string, number>;
      minutesWorked: number;
    };
  };
  letters?: {
    unread: number;
    rows: Array<{
      id: string;
      number: string;
      subject: string;
      senderName: string;
      priority: string;
      isUnread: boolean;
      createdAt: string;
    }>;
  };
  announcements?: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
  degraded?: string[];
}

// ── نامهٔ داخلی ─────────────────────────────────────────────────────────

export interface LetterRecipient {
  personnelId: string;
  name: string;
  kind: 'to' | 'cc';
  /** رسیدِ خواندن؛ null یعنی نخوانده. */
  readAt: string | null;
}

export interface Letter {
  id: string;
  number: string;
  subject: string;
  body: string;
  senderPersonnelId: string;
  senderName: string;
  priority: 'normal' | 'urgent';
  parentLetterId: string | null;
  threadId: string;
  attachments: Array<{ name: string; url: string }>;
  createdAt: string;
  recipients: LetterRecipient[];
  /** نامه را خودم فرستاده‌ام. */
  isMine: boolean;
  readAt: string | null;
  isUnread: boolean;
}

export interface LetterPage {
  rows: Letter[];
  total: number;
  page: number;
  pageSize: number;
}

/** یک همکار در دفترِ نشانی. */
export interface AddressBookEntry {
  personnelId: string;
  fullName: string;
  position: string;
  departmentId: string | null;
}

export const lettersApi = {
  inbox: (query: Record<string, unknown> = {}) =>
    api.get<LetterPage>('/me/letters', { params: query }).then((r) => r.data),

  sent: (query: Record<string, unknown> = {}) =>
    api
      .get<LetterPage>('/me/letters/sent', { params: query })
      .then((r) => r.data),

  unreadCount: () =>
    api
      .get<{ count: number }>('/me/letters/unread-count')
      .then((r) => r.data),

  addressBook: () =>
    api
      .get<AddressBookEntry[]>('/me/letters/recipients')
      .then((r) => r.data),

  thread: (id: string) =>
    api.get<Letter[]>(`/me/letters/${id}/thread`).then((r) => r.data),

  send: (body: Record<string, unknown>) =>
    api.post<Letter>('/me/letters', body).then((r) => r.data),

  reply: (id: string, body: Record<string, unknown>) =>
    api.post<Letter>(`/me/letters/${id}/reply`, body).then((r) => r.data),

  markRead: (id: string) =>
    api.post<{ read: boolean }>(`/me/letters/${id}/read`).then((r) => r.data),
};

// ── میزِ فرماندهیِ مدیریت ───────────────────────────────────────────────

/** یک عددِ قابلِ‌اقدام روی میزِ کار؛ `href` مقصدِ drill-down است. */
export interface DeskTile {
  key: string;
  label: string;
  count: number;
  tone: 'info' | 'warn' | 'danger';
  href: string;
}

export interface DeskSection {
  key: string;
  title: string;
  href: string;
  tiles: DeskTile[];
}

export interface AttentionItem {
  key: string;
  text: string;
  count: number;
  tone: 'info' | 'warn' | 'danger';
  href: string;
}

export interface CommandDesk {
  generatedAt: string;
  date: string;
  sections: DeskSection[];
  /** «این الان توجه می‌خواهد»؛ خالی یعنی واقعاً چیزی معلق نیست. */
  attention: AttentionItem[];
  cost: {
    internal: number;
    contractor: number;
    laborMinutes: number;
    days: number;
  } | null;
  inventoryValue: number | null;
  headcount: number;
  /** بخش‌هایی که خطا دادند و در پاسخ نیستند. */
  degraded: string[];
}

export const commandCenterApi = {
  get: (departmentId?: string) =>
    api
      .get<CommandDesk>('/command-center', {
        params: departmentId ? { departmentId } : {},
      })
      .then((r) => r.data),
};

// ── برنامهٔ کار و حضور ──────────────────────────────────────────────────

/** الگوی شیفت: «صبح ۰۷:۰۰–۱۵:۰۰». */
export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  departmentId: string | null;
  color: string;
  isActive: boolean;
}

/** شیفتِ یک پرسنل در یک روز. */
export interface ShiftAssignment {
  id: string;
  personnelId: string;
  fullName?: string;
  departmentId?: string | null;
  templateId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  note: string;
}

export interface AttendanceRecord {
  id: string;
  personnelId: string;
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
  minutesWorked: number;
  source: string;
  note: string;
}

/** یک ردیفِ «امروز چه کسی کار می‌کند». */
export interface DayBoardRow {
  personnelId: string;
  fullName: string;
  position: string;
  departmentId: string | null;
  shifts: Array<{
    id: string;
    label: string;
    startTime: string;
    endTime: string;
    note: string;
  }>;
  attendance: {
    status: string;
    checkIn: string;
    checkOut: string;
    minutesWorked: number;
    note: string;
  } | null;
  onLeave: boolean;
}

export interface DayBoard {
  date: string;
  rows: DayBoardRow[];
  totals: {
    people: number;
    scheduled: number;
    present: number;
    late: number;
    absent: number;
    onLeave: number;
    unrecorded: number;
  };
}

export const shiftsApi = {
  day: (date?: string, departmentId?: string) =>
    api
      .get<DayBoard>('/shifts/day', {
        params: {
          ...(date ? { date } : {}),
          ...(departmentId ? { departmentId } : {}),
        },
      })
      .then((r) => r.data),

  roster: (from: string, to: string, personnelId?: string) =>
    api
      .get<ShiftAssignment[]>('/shifts/roster', {
        params: { from, to, ...(personnelId ? { personnelId } : {}) },
      })
      .then((r) => r.data),

  templates: () =>
    api.get<ShiftTemplate[]>('/shifts/templates').then((r) => r.data),

  createTemplate: (body: Record<string, unknown>) =>
    api.post<ShiftTemplate>('/shifts/templates', body).then((r) => r.data),

  updateTemplate: (id: string, body: Record<string, unknown>) =>
    api
      .patch<ShiftTemplate>(`/shifts/templates/${id}`, body)
      .then((r) => r.data),

  assign: (body: Record<string, unknown>) =>
    api.post<ShiftAssignment>('/shifts/assign', body).then((r) => r.data),

  removeAssignment: (id: string) =>
    api.delete<{ ok: boolean }>(`/shifts/assign/${id}`).then((r) => r.data),

  setAttendance: (body: Record<string, unknown>) =>
    api.post<AttendanceRecord>('/shifts/attendance', body).then((r) => r.data),

  attendanceOf: (personnelId: string, from?: string, to?: string) =>
    api
      .get<{
        from: string;
        to: string;
        rows: AttendanceRecord[];
        byStatus: Record<string, number>;
        minutesWorked: number;
      }>(`/shifts/attendance/${personnelId}`, {
        params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
      })
      .then((r) => r.data),
};
