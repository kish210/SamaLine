import {
  OpenAiCompatibleProvider,
  extractJson,
} from './openai-compatible.provider';

const res = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }) as Response;

const chat = (content: string) => res(200, { choices: [{ message: { content } }] });

describe('extractJson — پاسخ‌های نامرتبِ مدل', () => {
  it('JSONِ خالص', () => {
    expect(extractJson('{"answer":"سلام"}')).toEqual({ answer: 'سلام' });
  });

  it('حصارِ ‎```json‎', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('بلوکِ ‎<think>‎ِ مدل‌های استدلالی (DeepSeek R1)', () => {
    expect(
      extractJson('<think>باید JSON بدهم {نه این}</think>\n{"answer":"باشه"}'),
    ).toEqual({ answer: 'باشه' });
  });

  it('جمله پیش و پس از JSON', () => {
    expect(extractJson('بفرمایید: {"x":[1,2]} امیدوارم کمک کند.')).toEqual({
      x: [1, 2],
    });
  });

  it('بی‌JSON خطای روشن می‌دهد', () => {
    expect(() => extractJson('متأسفم، نمی‌توانم.')).toThrow('JSON');
  });
});

describe('OpenAiCompatibleProvider — درخواست', () => {
  const realFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const provider = () =>
    new OpenAiCompatibleProvider(
      'sk-test',
      'https://ai.example.test/v1/',
      'deepseek/deepseek-r1',
    );

  const bodyOf = (call: number) =>
    JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);

  it('اسلشِ انتهاییِ نشانی دو تا نمی‌شود و حالتِ JSON درخواست می‌شود', async () => {
    fetchMock.mockResolvedValue(chat('{"answer":"ok","basis":[]}'));
    await provider().chatWithData({ question: 'سلام' });
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://ai.example.test/v1/chat/completions',
    );
    expect(bodyOf(0).response_format).toEqual({ type: 'json_object' });
    expect(bodyOf(0).model).toBe('deepseek/deepseek-r1');
  });

  it('اگر مدل response_format را رد کند، یک بار بدونِ آن تکرار می‌کند', async () => {
    fetchMock
      .mockResolvedValueOnce(
        res(400, { error: { message: 'response_format is not supported by this model' } }),
      )
      .mockResolvedValueOnce(chat('<think>…</think>```json\n{"answer":"سلام"}\n```'));
    const out = await provider().chatWithData({ question: 'سلام' });
    expect(out).toEqual({ answer: 'سلام' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(1).response_format).toBeUndefined();
  });

  it('۴۰۰ِ دیگر (مثلا مدلِ ناموجود) بدونِ تکرار با پیامِ سرویس خطا می‌دهد', async () => {
    fetchMock.mockResolvedValue(res(400, { error: { message: 'model not found' } }));
    await expect(provider().chatWithData({ question: 'x' })).rejects.toThrow(
      'model not found',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('کلیدِ ردشده (۴۰۱) خطای روشن می‌دهد', async () => {
    fetchMock.mockResolvedValue(res(401, { error: { message: 'invalid api key' } }));
    await expect(provider().chatWithData({ question: 'x' })).rejects.toThrow('401');
  });
});
