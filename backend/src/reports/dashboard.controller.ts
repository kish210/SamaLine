import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationId } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import {
  CreateDashboardDto,
  SetDashboardPublicDto,
  UpdateDashboardDto,
} from './dto';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';

@Controller('dashboards')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboards: DashboardService) {}

  @MinRole(OrganizationRole.ANALYST)
  @Post()
  create(
    @Body() dto: CreateDashboardDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.dashboards.create(organizationId, dto.name);
  }

  @Get()
  list(@OrganizationId() organizationId: string) {
    return this.dashboards.list(organizationId);
  }

  @Get(':id')
  get(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.dashboards.get(organizationId, id);
  }

  /** داده‌ی محاسبه‌شده‌ی همه‌ی ویجت‌ها. */
  @Get(':id/data')
  render(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.dashboards.render(organizationId, id);
  }

  @MinRole(OrganizationRole.ANALYST)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDashboardDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.dashboards.update(organizationId, id, dto);
  }

  @MinRole(OrganizationRole.ANALYST)
  @Patch(':id/public')
  setPublic(
    @Param('id') id: string,
    @Body() dto: SetDashboardPublicDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.dashboards.setPublic(organizationId, id, dto.isPublic);
  }

  @MinRole(OrganizationRole.ANALYST)
  @Delete(':id')
  remove(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.dashboards.remove(organizationId, id);
  }
}

/** نمای عمومی داشبورد؛ بدون نگهبان ورود. */
@Controller('public/dashboards')
export class PublicDashboardController {
  constructor(private readonly dashboards: DashboardService) {}

  @Get(':publicToken')
  render(@Param('publicToken') publicToken: string) {
    return this.dashboards.renderPublic(publicToken);
  }
}
