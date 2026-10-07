import {
  ForbiddenException,
  Injectable,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { OrganizationRole } from '../database/entities/organization-user.entity';
import type { JwtUser } from './current-user.decorator';
import { defaultRoleFor, hasRole, MIN_ROLE_KEY, ROLE_LABELS } from './roles';

/**
 * احراز هویت با توکن + بررسی نقش سازمانی.
 *
 * نقش همین‌جا بررسی می‌شود نه در یک گارد جدا، تا هر مسیری که JwtAuthGuard
 * دارد (همه‌ی مسیرهای پنل) خودکار پیش‌فرض امن بگیرد: خواندن برای همه‌ی
 * اعضا، هر تغییر دست‌کم «ویرایشگر». استثناها با `@MinRole(...)` روی مسیر یا
 * کنترلر مشخص می‌شوند.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    const request = context
      .switchToHttp()
      .getRequest<{ method: string; user?: JwtUser }>();
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
