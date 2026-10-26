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
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrganizationId } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import type { RoomAsset } from '../database/entities/hotel-room.entity';
import { RoomsService } from './rooms.service';

class RoomDto {
  @IsOptional() @IsString() @MaxLength(20) number?: string;
  @IsOptional() @IsInt() floor?: number;
  @IsOptional() @IsString() @MaxLength(60) kind?: string;
  @IsOptional() @IsArray() assets?: RoomAsset[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class BulkDto {
  @IsInt() @Min(1) @Max(100) floors: number;
  @IsInt() @Min(1) @Max(200) roomsPerFloor: number;
  @IsOptional() @IsInt() numberingBase?: number;
  @IsOptional() @IsInt() startFloor?: number;
  @IsOptional() @IsString() @MaxLength(60) kind?: string;
}

/**
 * اتاق‌های هتل. خواندن برای هر کاربرِ واردشده‌ی سازمان؛ تغییرِ داده‌ی پایه
 * فقط «مدیر» (یا بالاتر). `organizationId` همیشه از توکن.
 */
@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly service: RoomsService) {}

  @Get()
  list(@OrganizationId() organizationId: string) {
    return this.service.list(organizationId);
  }

  @Post()
  @MinRole(OrganizationRole.ADMIN)
  create(@Body() dto: RoomDto, @OrganizationId() organizationId: string) {
    return this.service.create(organizationId, dto);
  }

  @Post('bulk')
  @MinRole(OrganizationRole.ADMIN)
  bulk(@Body() dto: BulkDto, @OrganizationId() organizationId: string) {
    return this.service.bulkCreate(organizationId, dto);
  }

  @Patch(':id')
  @MinRole(OrganizationRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: RoomDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.service.update(organizationId, id, dto);
  }

  @Delete(':id')
  @MinRole(OrganizationRole.ADMIN)
  remove(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.service.remove(organizationId, id);
  }
}
