import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
} from '../database/entities/maintenance-request.entity';
import { RoomReadinessStatus } from '../database/entities/room-readiness.entity';
import { MaintenanceService } from './maintenance.service';

class AttachmentDto {
  @IsString()
  @MaxLength(500)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;
}

class CreateRequestDto {
  @IsOptional() @IsString() @MaxLength(160) requesterName?: string;
  @IsOptional() @IsString() @MaxLength(120) building?: string;
  @IsOptional() @IsString() @MaxLength(120) floor?: string;
  @IsOptional() @IsString() @MaxLength(120) room?: string;
  @IsOptional() @IsString() @MaxLength(300) locationNote?: string;
  @IsOptional() @IsEnum(MaintenanceCategory) category?: MaintenanceCategory;
  @IsString() @MaxLength(4000) description: string;
  @IsOptional() @IsEnum(MaintenancePriority) priority?: MaintenancePriority;
  @IsOptional() @IsString() @MaxLength(160) assignedTo?: string;
  @IsOptional() @IsInt() @Min(0) estimatedCost?: number;
  @IsOptional() @IsArray() attachments?: AttachmentDto[];
}

class UpdateRequestDto {
  @IsOptional() @IsString() @MaxLength(120) building?: string;
  @IsOptional() @IsString() @MaxLength(120) floor?: string;
  @IsOptional() @IsString() @MaxLength(120) room?: string;
  @IsOptional() @IsString() @MaxLength(300) locationNote?: string;
  @IsOptional() @IsEnum(MaintenanceCategory) category?: MaintenanceCategory;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsEnum(MaintenancePriority) priority?: MaintenancePriority;
  @IsOptional() @IsString() @MaxLength(160) assignedTo?: string;
  @IsOptional() @IsEnum(MaintenanceStatus) status?: MaintenanceStatus;
  @IsOptional() @IsString() @MaxLength(4000) workNotes?: string;
  @IsOptional() @IsString() @MaxLength(4000) completionNotes?: string;
  @IsOptional() @IsInt() @Min(0) estimatedCost?: number;
  @IsOptional() @IsInt() @Min(0) actualCost?: number;
  @IsOptional() @IsArray() attachments?: AttachmentDto[];
  @IsOptional() @IsString() @MaxLength(2000) eventNote?: string;
}

class RoomReadinessDto {
  @IsString() @MaxLength(120) room: string;
  @IsOptional() @IsString() @MaxLength(120) building?: string;
  @IsOptional() @IsString() @MaxLength(120) floor?: string;
  @IsEnum(RoomReadinessStatus) status: RoomReadinessStatus;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/**
 * ماژول نگهداری و تعمیرات هتل.
 *
 * گارد JwtAuthGuard پیش‌فرض امن می‌دهد: خواندن برای همه‌ی اعضا، تغییر دست‌کم
 * «ویرایشگر». بایگانی (حذف نرم) صریحاً «مدیر» می‌خواهد. مالکیت فضای کاری در
 * سرویس با TenantAccessService بررسی می‌شود؛ `workspaceId` از query می‌آید ولی
 * دسترسی‌اش بر پایه‌ی سازمانِ توکن سنجیده می‌شود.
 */
@Controller('maintenance')
@UseGuards(JwtAuthGuard)
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get('dashboard')
  async dashboard(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.dashboard(workspaceId);
  }

  @Get('requests')
  async list(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
    @Query('status') status?: MaintenanceStatus,
    @Query('category') category?: MaintenanceCategory,
    @Query('priority') priority?: MaintenancePriority,
    @Query('room') room?: string,
    @Query('q') q?: string,
    @Query('includeArchived') includeArchived?: string,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.listRequests(workspaceId, {
      status,
      category,
      priority,
      room,
      q,
      includeArchived: includeArchived === 'true',
    });
  }

  @Get('requests/:id')
  async get(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.getRequest(workspaceId, id);
  }

  @Post('requests')
  async create(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.createRequest(workspaceId, user, dto);
  }

  @Patch('requests/:id')
  async update(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRequestDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.updateRequest(workspaceId, user, id, dto);
  }

  /** بایگانی (حذف نرم) — فقط مدیر. */
  @Delete('requests/:id')
  @MinRole(OrganizationRole.ADMIN)
  async archive(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.archiveRequest(workspaceId, user, id);
  }

  // ── آماده‌بودن اتاق ─────────────────────────────────────────────────────

  @Get('rooms')
  async rooms(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.listRooms(workspaceId);
  }

  @Post('rooms')
  async setRoom(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: RoomReadinessDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.setRoomReadiness(workspaceId, user, dto);
  }
}
