jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { AiService } from './ai.service';

/** تنظیماتِ سکو؛ همان چیزی که از پنلِ سوپرادمین ذخیره می‌شود. */
function serviceWith(config: {
  provider: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}) {
  const platform = {
    getAiConfig: async () => ({
      baseUrl: '',
      model: '',
      apiKey: '',
      ...config,
    }),
  };
  return new AiService(platform as never);
}

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response;

describe('AiService — فهرستِ مدل‌ها و آزمونِ اتصال', () => {
  let fetchSpy: jest.Mock;
  const realFetch = globalThis.fetch;

  // بدونِ شبکه: fetch با جعل جایگزین و پس از هر تست برگردانده می‌شود.
  beforeEach(() => {
    fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const OPENAI = {
    provider: 'openai',
    baseUrl: 'https://ai.example.test/v1/',
    model: 'openai/gpt-4o-mini',
    apiKey: 'sk-test',
  };

  it('روی ماک مدل نمی‌خواند و به شبکه نمی‌رود', async () => {
    const svc = serviceWith({ provider: 'mock' });
    const models = await svc.listModels();
    expect(models.provider).toBe('mock');
    expect(models.models).toEqual([]);
    const test = await svc.testConnection();
    expect(test.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('مدل‌ها را از ‎/models‎ می‌خواند، مرتب و با کلیدِ Bearer', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, { data: [{ id: 'openai/gpt-4o' }, { id: 'anthropic/claude' }, {}] }),
    );
    const result = await serviceWith(OPENAI).listModels();
    expect(result.models).toEqual(['anthropic/claude', 'openai/gpt-4o']);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    // اسلشِ انتهاییِ نشانیِ پایه دوبار نمی‌شود.
    expect(url).toBe('https://ai.example.test/v1/models');
    expect((init.headers as Record<string, string>).authorization).toBe(
      'Bearer sk-test',
    );
  });

  it('ردِ کلید فهرستِ خالی با علت می‌دهد، نه خطا', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(401, { error: 'bad key' }));
    const result = await serviceWith(OPENAI).listModels();
    expect(result.models).toEqual([]);
    expect(result.error).toContain('401');
  });

  it('آزمونِ موفق پاسخِ مدل را برمی‌گرداند', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        choices: [{ message: { content: '{"answer":"سلام، وصلم","basis":[]}' } }],
      }),
    );
    const result = await serviceWith(OPENAI).testConnection();
    expect(result.ok).toBe(true);
    expect(result.model).toBe('openai/gpt-4o-mini');
    expect(result.message).toContain('سلام، وصلم');
  });

  it('آزمونِ ناموفق ok=false با پیامِ سرویس‌دهنده می‌دهد و throw نمی‌کند', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(401, { error: 'invalid api key' }));
    const result = await serviceWith(OPENAI).testConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('401');
  });
});
