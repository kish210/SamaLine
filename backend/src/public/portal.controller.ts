import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { TenantAccessService } from '../common/tenant-access.service';
import { PortalService } from './portal.service';

export class PortalDto {
  /** بخشِ مالکِ پرتال؛ خالی یعنی عمومیِ سازمان. */
  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** ترتیب همین آرایه، ترتیب نمایش کارت‌هاست. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  formIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('portals')
@UseGuards(JwtAuthGuard)
export class PortalAdminController {
  constructor(
    private readonly portalService: PortalService,
    private readonly tenant: TenantAccessService,
  ) {}

  @Get()
  async list(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.portalService.assertAccess(workspaceId, user);
    return this.portalService.list(workspaceId, {
      isManager: this.tenant.isManager(user),
      departmentIds: await this.tenant.memberDepartmentIds(user.sub),
    });
  }

  @Post()
  async create(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: PortalDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.portalService.assertAccess(workspaceId, user);
    return this.portalService.save(workspaceId, null, dto);
  }

  @Post(':id')
  async update(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: PortalDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.portalService.assertAccess(workspaceId, user);
    return this.portalService.save(workspaceId, id, dto);
  }

  @Delete(':id')
  async remove(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.portalService.assertAccess(workspaceId, user);
    return this.portalService.remove(workspaceId, id);
  }
}

/** نمای عمومی پرتال؛ بدون احراز هویت، با نشانک. */
@Controller('public/portal')
export class PublicPortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.portalService.publicBySlug(slug);
  }
}
