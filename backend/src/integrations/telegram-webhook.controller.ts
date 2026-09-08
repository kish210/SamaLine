import { Body, Controller, Param, Post } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';

/**
 * دریافت پیام‌های کاربران از تلگرام.
 *
 * عمداً بدون گارد است — تلگرام توکن JWT ندارد. اعتبار فراخوان از توکن
 * تصادفی داخل مسیر می‌آید: نشانی را فقط تلگرام و خود ما می‌دانیم و توکن
 * ناشناخته هیچ کاری نمی‌کند.
 *
 * همیشه ۲۰۰ برمی‌گرداند، حتی برای توکن نامعتبر: تلگرام در برابر خطا همان
 * به‌روزرسانی را بارها دوباره می‌فرستد، و پاسخ خطا فقط صف را پر می‌کند.
 * ضمناً پاسخ متفاوت به توکن درست و غلط، خودش راهی برای حدس زدن توکن است.
 */
@Controller('public/telegram')
export class TelegramWebhookController {
  constructor(private readonly botService: TelegramBotService) {}

  @Post('webhook/:token')
  async webhook(
    @Param('token') token: string,
    @Body() update: Record<string, unknown>,
  ) {
    await this.botService.handleUpdate(token, update);
    return { ok: true };
  }
}
