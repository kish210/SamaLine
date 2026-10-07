import { SetMetadata } from '@nestjs/common';
import { OrganizationRole } from '../database/entities/organization-user.entity';

/**
 * نقش‌های سازمانی به ترتیب اختیار؛ هر نقش همه‌ی اختیارات نقش‌های پایین‌تر را دارد.
 *
 * - مالک و مدیر: همه‌چیز، از جمله تیم، کلید API، وبهوک و تلگرام
 * - ویرایشگر: ساخت، ویرایش و انتشار فرم، کمپین و مخاطبان
 * - تحلیلگر: گزارش، خروجی اکسل، داشبوردساز و یادداشت روی پاسخ
 * - بیننده: فقط دیدن فرم‌ها و گزارش‌ها (بدون خروجی گرفتن از داده‌ی شخصی)
 */
export const ROLE_RANK: Record<OrganizationRole, number> = {
  [OrganizationRole.VIEWER]: 1,
  [OrganizationRole.ANALYST]: 2,
  [OrganizationRole.EDITOR]: 3,
  [OrganizationRole.ADMIN]: 4,
  [OrganizationRole.OWNER]: 5,
};

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  [OrganizationRole.OWNER]: 'مالک',
  [OrganizationRole.ADMIN]: 'مدیر',
  [OrganizationRole.EDITOR]: 'ویرایشگر',
  [OrganizationRole.ANALYST]: 'تحلیلگر',
  [OrganizationRole.VIEWER]: 'بیننده',
};

export const MIN_ROLE_KEY = 'samaline:min-role';

/**
 * حداقل نقش لازم برای یک مسیر یا کل یک کنترلر.
 *
 * بدون این تزئین، پیش‌فرض امن اعمال می‌شود: خواندن (GET) برای همه‌ی اعضا و
 * هر تغییری دست‌کم «ویرایشگر». پس مسیری که فراموش شود تزئین بخورد، باز
 * نمی‌ماند؛ فقط ممکن است سخت‌گیرانه‌تر از لازم باشد.
 */
export const MinRole = (role: OrganizationRole) =>
  SetMetadata(MIN_ROLE_KEY, role);

/** نقش پیش‌فرض یک درخواست بر پایه‌ی روش HTTP. */
export function defaultRoleFor(method: string): OrganizationRole {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
    ? OrganizationRole.VIEWER
    : OrganizationRole.EDITOR;
}

export function hasRole(
  actual: OrganizationRole | undefined,
  required: OrganizationRole,
): boolean {
  if (!actual) return false;
  return (ROLE_RANK[actual] ?? 0) >= ROLE_RANK[required];
}
