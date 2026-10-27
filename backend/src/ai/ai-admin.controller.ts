import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { SuperAdminGuard } from '../common/super-admin.guard';
import { AiService } from './ai.service';

/**
 * ابزارِ تنظیمِ هوش مصنوعی برای سوپرادمین: فهرستِ مدل‌های سرویس‌دهنده و
 * آزمونِ اتصال.
 *
 * فقط سوپرادمین، چون هر دو با کلیدِ API سکو به سرویسِ بیرونی درخواست می‌زنند.
 * کلید هرگز در پاسخ نمی‌آید؛ فقط شناسه‌ی مدل‌ها و نتیجه‌ی آزمون.
 */
@Controller('ai/admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AiAdminController {
  constructor(private readonly ai: AiService) {}

  @Get('models')
  models() {
    return this.ai.listModels();
  }

  @Post('test')
  test() {
    return this.ai.testConnection();
  }
}
