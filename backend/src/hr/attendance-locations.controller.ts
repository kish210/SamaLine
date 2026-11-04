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
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { AttendanceLocationService } from './attendance-location.service';

class CreateLocationDto {
  @IsNotEmpty() @IsString() @MaxLength(120) name: string;
  @IsNumber() @Min(-90) @Max(90) lat: number;
  @IsNumber() @Min(-180) @Max(180) lng: number;
  @IsOptional() @IsNumber() @Min(20) @Max(5000) radiusMeters?: number;
  @IsOptional() @IsString() departmentId?: string | null;
}

class UpdateLocationDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
  @IsOptional() @IsNumber() @Min(20) @Max(5000) radiusMeters?: number;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/**
 * مکان‌های مجازِ حضور.
 *
 * خواندن برای «تحلیلگر» تا سرشیفت ببیند محدوده‌ها کجاست؛ تعریف و ویرایش فقط
 * «مدیر» — یک تغییرِ اشتباه در شعاع، حضورِ کلِ یک بخش را رد می‌کند.
 */
@Controller('shifts/locations')
@UseGuards(JwtAuthGuard)
export class AttendanceLocationsController {
  constructor(private readonly places: AttendanceLocationService) {}

  @Get()
  @MinRole(OrganizationRole.ANALYST)
  list(
    @CurrentUser() user: JwtUser,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.places.list(user.organizationId, {
      includeInactive: includeInactive === 'true',
    });
  }

  @Post()
  @MinRole(OrganizationRole.ADMIN)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateLocationDto) {
    return this.places.create(user.organizationId, dto);
  }

  @Patch(':id')
  @MinRole(OrganizationRole.ADMIN)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.places.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @MinRole(OrganizationRole.ADMIN)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.places.remove(user.organizationId, id);
  }
}
