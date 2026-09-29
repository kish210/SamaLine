import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { TenantAccessService } from '../common/tenant-access.service';
import { PublicationType } from '../database/entities/publication.entity';
import { CreateDeliveryLogDto } from './dto';
import { DistributionService } from './distribution.service';

/**
 * همه‌ی مسیرها شناسه‌ی فرم یا انتشار را از درخواست می‌گیرند؛ پس مالکیت هر
 * کدام پیش از کار بررسی می‌شود تا کاربر یک سازمان به انتشارهای سازمان دیگر
 * دست نزند.
 */
@Controller('distribution')
@UseGuards(JwtAuthGuard)
export class DistributionController {
  constructor(
    private readonly distributionService: DistributionService,
    private readonly tenant: TenantAccessService,
  ) {}

  @Post('delivery-logs')
  async createLog(
    @Body() dto: CreateDeliveryLogDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertPublication(dto.publicationId, user);
    return this.distributionService.createLog(dto);
  }

  @Get('delivery-logs')
  async listLogs(
    @Query('publicationId') publicationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertPublication(publicationId, user);
    return this.distributionService.listLogs(publicationId);
  }

  @Post('forms/:formId/publications/:type')
  async createChannel(
    @Param('formId') formId: string,
    @Param('type') type: PublicationType,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertForm(formId, user);
    return this.distributionService.createChannelPublication(formId, type);
  }

  @Get('publications/:publicationId/assets')
  async assets(
    @Param('publicationId') publicationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertPublication(publicationId, user);
    return this.distributionService.channelAssets(publicationId);
  }
}
