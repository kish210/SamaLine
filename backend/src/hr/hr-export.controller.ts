import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrganizationId } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { HrExportService } from './hr-export.service';

/** نوعِ MIME فایل xlsx؛ هر سه اندپوینت. */
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * خروجیِ اکسلِ HR.
 *
 * کنترلرِ جدا از `HrController` است چون پیشوندِ آن `hr/personnel` است و
 * مسیرِ `/hr/personnel/export/personnel.xlsx` بی‌معنا می‌شد؛ اینجا مسیرها
 * `/hr/export/*` و مستقل از فهرست‌ها هستند.
 *
 * `organizationId` همیشه از توکن می‌آید، پس خروجی نمی‌تواند دادهٔ سازمانِ
 * دیگری را بکشد. دستِ‌کم «تحلیل‌گر» لازم است (هم‌ردهٔ فهرست‌ها).
 */
@Controller('hr/export')
@UseGuards(JwtAuthGuard)
export class HrExportController {
  constructor(private readonly exportService: HrExportService) {}

  /** اکسلِ پروندهٔ پرسنل: داده‌ی پایه، وضعیتِ اشتغال و قرارداد. */
  @Get('personnel.xlsx')
  @MinRole(OrganizationRole.ANALYST)
  async personnel(
    @OrganizationId() organizationId: string,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    const buffer = await this.exportService.personnelXlsx(organizationId);
    this.send(res, buffer, 'hr-personnel.xlsx');
  }

  /** اکسلِ درخواست‌های مرخصی با همان فیلترهای صفحه. */
  @Get('leaves.xlsx')
  @MinRole(OrganizationRole.ANALYST)
  async leaves(
    @OrganizationId() organizationId: string,
    @Res() res: ExpressResponse,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    const buffer = await this.exportService.leavesXlsx(organizationId, {
      status,
      type,
      from,
      to,
    });
    this.send(res, buffer, 'hr-leaves.xlsx');
  }

  /**
   * اکسلِ حضوروغیاب در بازهٔ `from..to` (YYYY-MM-DD).
   *
   * بازه اجباری است تا خروجیِ کلِ تاریخچه ساخته نشود.
   */
  @Get('attendance.xlsx')
  @MinRole(OrganizationRole.ANALYST)
  async attendance(
    @OrganizationId() organizationId: string,
    @Res() res: ExpressResponse,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    if (!from || !to) {
      throw new BadRequestException('بازهٔ تاریخ (from و to) لازم است.');
    }
    const buffer = await this.exportService.attendanceXlsx(organizationId, {
      from,
      to,
    });
    this.send(res, buffer, `hr-attendance-${from}_${to}.xlsx`);
  }

  /** سرفصل‌ها و ارسالِ بافر در یک جا، تا سه اندپوینت یکدست بمانند. */
  private send(
    res: ExpressResponse,
    buffer: Buffer,
    filename: string,
  ): void {
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
