import { htmlToBaleMarkdown } from './telegram-api';

describe('htmlToBaleMarkdown — رفع نمایش خام HTML در بله', () => {
  it('<b> را به ** (پررنگ بله) تبدیل می‌کند', () => {
    expect(htmlToBaleMarkdown('<b>نام:</b> علی')).toBe('**نام:** علی');
  });

  it('موجودیت‌های HTML را به کاراکتر اصلی برمی‌گرداند', () => {
    expect(htmlToBaleMarkdown('a &amp; b &lt;x&gt;')).toBe('a & b <x>');
  });

  it('تگ‌های ناشناخته را حذف می‌کند', () => {
    expect(htmlToBaleMarkdown('<i>x</i><br>y')).toBe('xy');
  });

  it('پیام چندخطی اعلان پاسخ را درست تبدیل می‌کند', () => {
    const html = '📝 <b>نظرسنجی</b>\n\n<b>اتاق:</b> 23\n📊 <b>رضایت:</b> 8';
    expect(htmlToBaleMarkdown(html)).toBe(
      '📝 **نظرسنجی**\n\n**اتاق:** 23\n📊 **رضایت:** 8',
    );
  });

  it('متن بدون تگ دست‌نخورده می‌ماند', () => {
    expect(htmlToBaleMarkdown('✅ اتصال برقرار است.')).toBe('✅ اتصال برقرار است.');
  });
});
