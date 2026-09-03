import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileProvider } from './local-file.provider';

describe('LocalFileProvider', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'samaline-outbox-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('پیام را در صندوق خروجی می‌نویسد و وضعیت ارسال می‌دهد', async () => {
    const provider = new LocalFileProvider('sms', dir);
    const result = await provider.send({
      channel: 'sms',
      recipient: '09120000000',
      body: 'سلام',
      meta: { respondentKey: 'abc' },
    });

    expect(result.status).toBe('sent');

    const content = await readFile(join(dir, 'sms.jsonl'), 'utf8');
    const record = JSON.parse(content.trim()) as Record<string, unknown>;
    expect(record.recipient).toBe('09120000000');
    expect(record.body).toBe('سلام');
    expect(record.meta).toEqual({ respondentKey: 'abc' });
  });

  it('پیام‌های متوالی را به همان فایل می‌افزاید', async () => {
    const provider = new LocalFileProvider('email', dir);
    await provider.send({
      channel: 'email',
      recipient: 'a@test.local',
      body: '۱',
    });
    await provider.send({
      channel: 'email',
      recipient: 'b@test.local',
      body: '۲',
    });

    const lines = (await readFile(join(dir, 'email.jsonl'), 'utf8'))
      .trim()
      .split('\n');
    expect(lines).toHaveLength(2);
  });

  it('کانال‌ها فایل جداگانه دارند', async () => {
    await new LocalFileProvider('sms', dir).send({
      channel: 'sms',
      recipient: '0912',
      body: 'x',
    });
    await new LocalFileProvider('email', dir).send({
      channel: 'email',
      recipient: 'a@b.c',
      body: 'y',
    });

    await expect(readFile(join(dir, 'sms.jsonl'), 'utf8')).resolves.toContain(
      '0912',
    );
    await expect(readFile(join(dir, 'email.jsonl'), 'utf8')).resolves.toContain(
      'a@b.c',
    );
  });
});
