interface Props {
  footer?: { enabled: boolean; text: string; url: string };
}

/**
 * نوار پایین ثابت سکو.
 *
 * فقط سوپرادمین سامانه می‌تواند متنش را عوض کند یا خاموشش کند؛ صاحب فرم
 * به آن دسترسی ندارد. اگر سرور چیزی نفرستد (نسخه‌ی قدیمی‌تر بک‌اند)، نواری
 * هم نشان داده نمی‌شود.
 */
export function PlatformFooter({ footer }: Props) {
  if (!footer?.enabled || !footer.text) return null;

  const label = footer.url ? (
    <a href={footer.url} target="_blank" rel="noopener noreferrer">
      {footer.text}
    </a>
  ) : (
    <span>{footer.text}</span>
  );

  return <footer className="platform-footer">{label}</footer>;
}
