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
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { EmailReportService } from './email-report.service';

export class EmailReportDto {
  /** خالی یعنی «همه‌ی فرم‌های این فضای کاری». */
  @IsOptional()
  @IsUUID()
  formId?: string | null;

  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  digest?: 'weekly' | 'monthly';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class EmailReportPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  digest?: 'weekly' | 'monthly';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@MinRole(OrganizationRole.ADMIN)
@Controller('integrations/email-reports')
@UseGuards(JwtAuthGuard)
export class EmailReportController {
  constructor(private readonly service: EmailReportService) {}

  @Get()
  async list(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.list(workspaceId);
  }

  @Post()
  async add(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: EmailReportDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.add(workspaceId, dto);
  }

  @Patch(':id')
  async update(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: EmailReportPatchDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.update(workspaceId, id, dto);
  }

  @Delete(':id')
  async remove(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.remove(workspaceId, id);
  }

  @Post(':id/test')
  async test(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.sendTest(workspaceId, id);
  }
}
