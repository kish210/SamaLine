import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyEntity } from '../database/entities/api-key.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import type { JwtUser } from './current-user.decorator';

/** پیشوند همه‌ی کلیدهای API؛ هر چیز دیگری توکن ورود پنل است. */
export const API_KEY_PREFIX = 'sl_';

/** طول پیشوندِ ذخیره‌شده برای یافتن کلید (`sl_` + ۱۳ نویسه). */
const LOOKUP_PREFIX_LENGTH = 16;

/**
 * مسیرهایی که کلید API هرگز نباید به آن‌ها برسد.
 *
 * اینجا حساب و مالکیت سازمان اداره می‌شود: رمز و ورود دومرحله‌ای، اعضای تیم و
 * نقش‌ها، فاکتور، و خودِ کلیدهای API. بدون این فهرست، کلیدی با نقش «مدیر»
 * می‌توانست کلید تازه بسازد، هم‌تیمی دعوت کند یا رمز کسی را عوض کند — یعنی
 * یک کلید لو رفته به تصاحب کامل سازمان تبدیل می‌شد.
 */
const FORBIDDEN_PREFIXES = [
  '/auth',
  '/team',
  '/billing',
  '/organization',
  '/admin',
  '/platform',
  '/ops',
];

/** فاصله‌ی به‌روزرسانی «آخرین استفاده»؛ هر درخواست یک نوشتن نمی‌خواهد. */
const LAST_USED_THROTTLE_MS = 60_000;

export function hashApiKey(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

/** مقایسه‌ی هش در زمان ثابت تا با سنجش زمان نشود کلید را حدس زد. */
function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** کلید از سربرگ `X-API-Key` یا `Authorization: Bearer sl_…`. */
export function apiKeyFromHeaders(headers: Record<string, unknown>): string {
  const direct = headers['x-api-key'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const authorization = headers['authorization'];
  if (typeof authorization !== 'string') return '';
  const [scheme, value] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return '';
  return value.startsWith(API_KEY_PREFIX) ? value : '';
}

/** آیا این مسیر برای کلید API ممنوع است؟ */
export function isForbiddenForApiKey(path: string): boolean {
  // مسیرها با پیشوند نسخه می‌آیند (`/api/v1/...`)؛ فقط بخش بعد از آن مهم است.
  const route = path.replace(/^\/api\/v\d+/, '');
  return FORBIDDEN_PREFIXES.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`),
  );
}

/**
 * احراز هویت با کلید API — جایگزین توکن ورود برای برنامه‌های بیرونی.
 *
 * کلید مثل یک عضو ماشینی سازمان رفتار می‌کند: نقش دارد و همان بررسی نقشِ
 * مسیرها رویش اعمال می‌شود. تا پیش از این کلید ساخته و ذخیره می‌شد ولی هیچ
 * مسیری با آن احراز هویت نمی‌کرد.
 */
@Injectable()
export class ApiKeyAuthService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly keys: Repository<ApiKeyEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaces: Repository<WorkspaceEntity>,
  ) {}

  /** کلید خام را به هویت درخواست تبدیل می‌کند، یا ۴۰۱ می‌دهد. */
  async authenticate(plain: string): Promise<JwtUser> {
    const invalid = () =>
      new UnauthorizedException('کلید API نامعتبر یا غیرفعال است');

    if (!plain.startsWith(API_KEY_PREFIX)) throw invalid();
    const key = await this.keys.findOne({
      where: { keyPrefix: plain.slice(0, LOOKUP_PREFIX_LENGTH) },
    });
    if (!key || !sameHash(key.keyHash, hashApiKey(plain))) throw invalid();
    if (!key.isActive) throw invalid();
    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('کلید API منقضی شده است');
    }

    await this.touch(key);

    // فضای کاری پیش‌فرض سازمان، برای مسیرهایی که از توکن می‌خوانندش.
    const workspace = await this.workspaces.findOne({
      where: { organizationId: key.organizationId },
      order: { createdAt: 'ASC' },
      select: { id: true },
    });

    return {
      // کاربر واقعی نیست؛ همین باعث می‌شود بررسی سوپرادمین هم ردش کند.
      sub: `apikey:${key.id}`,
      email: `${key.name} (کلید API)`,
      organizationId: key.organizationId,
      workspaceId: workspace?.id ?? null,
      role: key.role,
    };
  }

  /** ثبت آخرین استفاده، حداکثر یک بار در دقیقه برای هر کلید. */
  private async touch(key: ApiKeyEntity): Promise<void> {
    const now = Date.now();
    if (
      key.lastUsedAt &&
      now - key.lastUsedAt.getTime() < LAST_USED_THROTTLE_MS
    ) {
      return;
    }
    await this.keys.update(key.id, { lastUsedAt: new Date(now) });
  }
}
