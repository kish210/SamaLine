import { OrganizationRole } from '../database/entities/organization-user.entity';
import { ROLE_LABELS } from '../common/roles';

/** نقش‌هایی که با دعوت داده می‌شوند؛ مالکیت فقط با تغییر نقش منتقل می‌شود. */
export const INVITABLE_ROLES = [
  OrganizationRole.ADMIN,
  OrganizationRole.EDITOR,
  OrganizationRole.ANALYST,
  OrganizationRole.VIEWER,
] as const;

/** نتیجه‌ی بررسی یک تغییر در تیم: null یعنی مجاز، متن یعنی دلیل رد. */
export type RuleResult = string | null;

/**
 * آیا `actor` می‌تواند نقش عضوی با نقش `current` را به `next` تغییر دهد؟
 *
 * - فقط مالک به مالک‌ها دست می‌زند یا کسی را مالک می‌کند؛ وگرنه مدیر
 *   می‌توانست مالک را کنار بگذارد و سازمان را تصاحب کند.
 * - آخرین مالک را نمی‌شود پایین آورد؛ سازمان بی‌مالک کسی را ندارد که
 *   پلن و تیم را اداره کند.
 */
export function checkRoleChange(input: {
  actor: OrganizationRole;
  current: OrganizationRole;
  next: OrganizationRole;
  ownerCount: number;
}): RuleResult {
  const { actor, current, next, ownerCount } = input;
  if (!Object.values(OrganizationRole).includes(next)) {
    return 'نقش نامعتبر است';
  }
  const touchesOwner =
    current === OrganizationRole.OWNER || next === OrganizationRole.OWNER;
  if (touchesOwner && actor !== OrganizationRole.OWNER) {
    return `فقط ${ROLE_LABELS[OrganizationRole.OWNER]} می‌تواند نقش مالک را بدهد یا بگیرد`;
  }
  if (
    current === OrganizationRole.OWNER &&
    next !== OrganizationRole.OWNER &&
    ownerCount <= 1
  ) {
    return 'سازمان دست‌کم یک مالک لازم دارد؛ اول نفر دیگری را مالک کنید';
  }
  return null;
}

/** آیا `actor` می‌تواند عضوی با نقش `target` را از تیم حذف کند؟ */
export function checkRemoval(input: {
  actor: OrganizationRole;
  target: OrganizationRole;
  self: boolean;
  ownerCount: number;
}): RuleResult {
  const { actor, target, self, ownerCount } = input;
  if (self) {
    return 'نمی‌توانید خودتان را حذف کنید؛ از مدیر دیگری بخواهید';
  }
  if (target === OrganizationRole.OWNER) {
    if (actor !== OrganizationRole.OWNER) {
      return 'فقط مالک می‌تواند مالک دیگری را حذف کند';
    }
    if (ownerCount <= 1) return 'سازمان دست‌کم یک مالک لازم دارد';
  }
  return null;
}

/**
 * آیا سقف کاربران پلن جای عضو تازه دارد؟
 *
 * دعوت‌های در انتظار هم شمرده می‌شوند؛ وگرنه می‌شد پیش از پذیرش هر کدام،
 * ده‌ها دعوت فرستاد و از سقف گذشت. مقدار منفی یعنی نامحدود.
 */
export function checkSeatLimit(input: {
  limit: number;
  members: number;
  pending: number;
}): RuleResult {
  const { limit, members, pending } = input;
  if (!Number.isFinite(limit) || limit < 0) return null;
  if (members + pending >= limit) {
    return `سقف کاربران پلن شما (${limit.toLocaleString('fa-IR')} نفر، با دعوت‌های در انتظار) پر است؛ برای افزودن هم‌تیمی پلن را ارتقا دهید`;
  }
  return null;
}
