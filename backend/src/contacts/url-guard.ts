import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * محافظت در برابر SSRF.
 *
 * کاربر نشانی دلخواه یک سرویس بیرونی را وارد می‌کند و سرور ما به آن
 * درخواست می‌زند. بدون این بررسی، کاربر می‌تواند سرور را وادار کند به
 * شبکه‌ی داخلی، سرویس متادیتای ابری یا خودِ لوکال‌هاست درخواست بزند و
 * پاسخ را ببیند.
 *
 * در استقرارهایی که سرویس مقصد واقعا داخل شبکه‌ی خصوصی است،
 * `ALLOW_PRIVATE_CONTACT_SOURCES=true` این محدودیت را برمی‌دارد.
 */
export interface UrlCheck {
  allowed: boolean;
  reason: string | null;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
]);

/** بازه‌های خصوصی، لوپ‌بک و لینک‌لوکال IPv4. */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // شامل متادیتای ابری
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80')) return true;
  // IPv4 نگاشته‌شده در IPv6 نباید راه فرار باشد.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return false;
}

export async function assertPublicUrl(rawUrl: string): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'نشانی معتبر نیست' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return {
      allowed: false,
      reason: 'فقط پروتکل http و https پشتیبانی می‌شود',
    };
  }

  if (process.env.ALLOW_PRIVATE_CONTACT_SOURCES === 'true') {
    return { allowed: true, reason: null };
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    return {
      allowed: false,
      reason: 'اتصال به نشانی داخلی مجاز نیست',
    };
  }

  if (isIP(hostname)) {
    return isPrivateAddress(hostname)
      ? { allowed: false, reason: 'اتصال به نشانی شبکه داخلی مجاز نیست' }
      : { allowed: true, reason: null };
  }

  // نام دامنه ممکن است عمدا به آدرس داخلی اشاره کند، پس باید حل شود.
  try {
    const records = await lookup(hostname, { all: true });
    const hasPrivate = records.some((record) =>
      isPrivateAddress(record.address),
    );
    return hasPrivate
      ? {
          allowed: false,
          reason: 'این دامنه به نشانی شبکه داخلی اشاره می‌کند',
        }
      : { allowed: true, reason: null };
  } catch {
    return { allowed: false, reason: 'دامنه قابل resolve نیست' };
  }
}
