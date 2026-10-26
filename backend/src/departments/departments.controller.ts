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
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { DepartmentsService } from './departments.service';

class DepartmentDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(40) key?: string;
}

class AddMemberDto {
  @IsString() userId: string;
}

/**
 * مدیریت بخش‌ها و عضویت. خواندن برای همه‌ی اعضا؛ ساخت/ویرایش/عضوگیری فقط
 * «مدیر» (یا بالاتر). `organizationId` همیشه از توکن.
 */
@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.service.list(user.organizationId);
  }

  /** بخش‌های همین کاربر (باید پیش از مسیرهای پارامتری اعلام شود). */
  @Get('mine')
  mine(@CurrentUser() user: JwtUser) {
    return this.service.myDepartments(user);
  }

  @Post()
  @MinRole(OrganizationRole.ADMIN)
  create(@Body() dto: DepartmentDto, @CurrentUser() user: JwtUser) {
    return this.service.create(user.organizationId, dto);
  }

  @Patch(':id')
  @MinRole(OrganizationRole.ADMIN)
  rename(
    @Param('id') id: string,
    @Body() dto: DepartmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.rename(user.organizationId, id, dto);
  }

  @Delete(':id')
  @MinRole(OrganizationRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.remove(user.organizationId, id);
  }

  @Get(':id/members')
  @MinRole(OrganizationRole.ADMIN)
  members(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.service.listMembers(user.organizationId, id);
  }

  @Post(':id/members')
  @MinRole(OrganizationRole.ADMIN)
  addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.addMember(user.organizationId, id, dto.userId);
  }

  @Delete(':id/members/:userId')
  @MinRole(OrganizationRole.ADMIN)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.removeMember(user.organizationId, id, userId);
  }
}
