import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

/** نوع‌های تصویری مجاز و پسوند متناظرشان. */
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

/** سقف حجم لوگو. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * ذخیره‌ی فایل‌های آپلودی روی دیسک همین سرور.
 *
 * عمدا هیچ سرویس ابری‌ای در کار نیست؛ پروژه باید بدون وابستگی بیرونی
 * نصب شود. مسیر با `UPLOAD_DIR` قابل تغییر است تا در استقرار واقعی بتوان
 * روی یک volume جدا نشست.
 */
@Injectable()
export class UploadService {
  readonly directory = uploadDirectory();

  constructor() {
    if (!existsSync(this.directory)) {
      mkdirSync(this.directory, { recursive: true });
    }
  }

  /**
   * ذخیره‌ی یک تصویر و برگرداندن نشانی عمومی آن.
   *
   * نام فایل از UUID ساخته می‌شود، نه از نام ارسالی کاربر: نام کاربر
   * می‌تواند حاوی `../` یا کاراکترهای مسیر باشد و به نوشتن بیرون از پوشه
   * منجر شود.
   */
  async saveImage(file: {
    buffer: Buffer;
    mimetype: string;
    size: number;
  }): Promise<{ url: string; fileName: string }> {
    const extension = ALLOWED[file.mimetype];
    if (!extension) {
      throw new BadRequestException(
        'فقط تصویر PNG، JPG، WEBP، GIF یا SVG پذیرفته می‌شود',
      );
    }

    if (file.size > MAX_LOGO_BYTES) {
      throw new BadRequestException('حجم تصویر نباید از ۲ مگابایت بیشتر باشد');
    }

    const fileName = `${randomUUID()}.${extension}`;
    await writeFile(join(this.directory, fileName), file.buffer);

    return { url: `/uploads/${fileName}`, fileName };
  }

  /** حذف یک فایل آپلودشده؛ نام باید ساده و بدون مسیر باشد. */
  async remove(fileName: string): Promise<void> {
    if (!/^[0-9a-f-]{36}\.[a-z]{3,4}$/.test(fileName)) {
      throw new BadRequestException('نام فایل معتبر نیست');
    }
    await unlink(join(this.directory, fileName)).catch(() => undefined);
  }
}

/** پوشه‌ی آپلودها؛ نسبی‌ها از ریشه‌ی backend حساب می‌شوند. */
export function uploadDirectory(): string {
  const raw = process.env.UPLOAD_DIR ?? 'data/uploads';
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}
