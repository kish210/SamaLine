import { BadRequestException } from '@nestjs/common';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_LOGO_BYTES, UploadService } from './upload.service';

describe('UploadService — آپلود لوگو', () => {
  let service: UploadService;
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'samaline-uploads-'));
    process.env.UPLOAD_DIR = dir;
    service = new UploadService();
  });

  afterEach(() => {
    delete process.env.UPLOAD_DIR;
  });

  const image = (over: Partial<{ mimetype: string; size: number }> = {}) => ({
    buffer: Buffer.from('fake-image'),
    mimetype: over.mimetype ?? 'image/png',
    size: over.size ?? 1024,
  });

  it('تصویر مجاز را ذخیره می‌کند و نشانی عمومی می‌دهد', async () => {
    const saved = await service.saveImage(image());
    expect(saved.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    expect(readdirSync(dir)).toHaveLength(1);
  });

  it('نوع غیرتصویری را رد می‌کند', async () => {
    await expect(
      service.saveImage(image({ mimetype: 'application/pdf' })),
    ).rejects.toThrow(BadRequestException);
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it('فایل بزرگ‌تر از سقف را رد می‌کند', async () => {
    await expect(
      service.saveImage(image({ size: MAX_LOGO_BYTES + 1 })),
    ).rejects.toThrow(BadRequestException);
  });

  it('نام فایل از UUID ساخته می‌شود نه از ورودی کاربر', async () => {
    // نام ارسالی کاربر می‌تواند حاوی ../ باشد؛ اصلا خوانده نمی‌شود.
    const a = await service.saveImage(image());
    const b = await service.saveImage(image());
    expect(a.fileName).not.toBe(b.fileName);
    expect(readdirSync(dir)).toHaveLength(2);
  });

  it('حذف با نام حاوی مسیر رد می‌شود', async () => {
    await expect(service.remove('../../etc/passwd')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.remove('..%2Fx.png')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('حذف فایل واقعی کار می‌کند', async () => {
    const saved = await service.saveImage(image());
    await service.remove(saved.fileName);
    expect(readdirSync(dir)).toHaveLength(0);
  });
});
