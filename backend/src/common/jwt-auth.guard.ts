import {
  ForbiddenException,
  Injectable,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { OrganizationRole } from '../database/entities/organization-user.entity';
import {
  ApiKeyAuthService,
  apiKeyFromHeaders,
  isForbiddenForApiKey,
} from './api-key-auth.service';
import type { JwtUser } from './current-user.decorator';
import { defaultRoleFor, hasRole, MIN_ROLE_KEY, ROLE_LABELS } from './roles';

interface GuardedRequest {
  method: string;
  path?: string;
  url?: string;
  headers?: Record<string, unknown>;
  user?: JwtUser;
}

/**
 * احراز هویت با توکن ورود یا کلید API + بررسی نقش سازمانی.
 *
 * نقش همین‌جا بررسی می‌شود نه در یک گارد جدا، تا هر مسیری که JwtAuthGuard
 * دارد (همه‌ی مسیرهای پنل) خودکار پیش‌فرض امن بگیرد: خواندن برای همه‌ی
 * اعضا، هر تغییر دست‌کم «ویرایشگر». استثناها با `@MinRole(...)` روی مسیر یا
 * کنترلر مشخص می‌شوند.
 *
 * کلید API هم از همین‌جا می‌گذرد و نقش خودش را دارد، پس برنامه‌ی بیرونی
 * دقیقا همان محدودیت‌های یک عضو تیم را دارد — به‌جز مسیرهای حساب و مالکیت
 * سازمان که برایش بسته‌اند.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeys?: ApiKeyAuthService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();

    const rawKey = this.apiKeys ? apiKeyFromHeaders(request.headers ?? {}) : '';
    if (rawKey) {
      const path = request.path ?? request.url ?? '';
      if (isForbiddenForApiKey(path)) {
        throw new ForbiddenException(
          'این مسیر با کلید API در دسترس نیست؛ فقط با ورود کاربر انجام می‌شود',
        );
      }
      request.user = await this.apiKeys!.authenticate(rawKey);
    } else {
      const authenticated = await super.canActivate(context);
      if (!authenticated) return false;
    }

    const required =
      this.reflector.getAllAndOverride<OrganizationRole | undefined>(
        MIN_ROLE_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? defaultRoleFor(request.method);

    if (!hasRole(request.user?.role, required)) {
      const actual = request.user?.role;
      throw new ForbiddenException(
        `این کار نقش «${ROLE_LABELS[required]}» یا بالاتر می‌خواهد؛ نقش شما «${actual ? ROLE_LABELS[actual] : 'نامشخص'}» است`,
      );
    }
    return true;
  }
}
