import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** محتوای توکن JWT — منبع معتبر هویت و مستاجر (tenant). */
export interface JwtUser {
  sub: string;
  email: string;
  organizationId: string;
  workspaceId: string | null;
}

/** کل payload توکن جاری. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser =>
    ctx.switchToHttp().getRequest<{ user: JwtUser }>().user,
);

/**
 * شناسه‌ی سازمان از روی توکن.
 * هرگز نباید از query/body خوانده شود؛ در غیر این صورت کاربر می‌تواند
 * داده‌ی سازمان دیگری را بخواند (نقض جداسازی مستاجر).
 */
export const OrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest<{ user: JwtUser }>().user.organizationId,
);

/** شناسه‌ی فضای کاری پیش‌فرض از روی توکن. */
export const TokenWorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<{ user: JwtUser }>().user.workspaceId ?? null,
);
