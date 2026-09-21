import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { SuperAdminGuard } from '../common/super-admin.guard';
import {
  SERVICE_ACTIONS,
  ServiceControlService,
  type ServiceAction,
} from './service-control.service';
import { BadRequestException } from '@nestjs/common';

/**
 * پایش و کنترل سرویس‌های سامانه — فقط برای مدیر کل.
 *
 * هر دو گارد لازم‌اند: JwtAuthGuard کاربر را می‌شناسد و SuperAdminGuard
 * مطمئن می‌شود فقط سوپرادمین است. این کنترلر با دسترسی root فرمانِ سیستمی
 * اجرا می‌کند، پس گاردش سخت‌گیرترین حالت سامانه است.
 */
@ApiTags('ops')
@Controller('ops')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class OpsController {
  constructor(private readonly services: ServiceControlService) {}

  @Get('services')
  async list() {
    return {
      supported: this.services.supported,
      services: await this.services.list(),
    };
  }

  /**
   * اجرای یک کار روی یک سرویس.
   *
   * هم نام و هم کار اعتبارسنجی می‌شوند: کار باید یکی از سه مقدار مجاز باشد و
   * نام در سرویس بررسی می‌شود که در allowlist باشد. هیچ‌کدام مستقیم به پوسته
   * نمی‌رود.
   */
  @Post('services/:name/:action')
  async control(
    @Param('name') name: string,
    @Param('action') action: string,
  ) {
    if (!SERVICE_ACTIONS.includes(action as ServiceAction)) {
      throw new BadRequestException('کارِ درخواستی مجاز نیست.');
    }
    return this.services.control(name, action as ServiceAction);
  }
}
