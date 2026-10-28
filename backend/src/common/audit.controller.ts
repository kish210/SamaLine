import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, type JwtUser } from './current-user.decorator';
import { MinRole } from './roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { AuditService } from './audit.service';

/** نمای لاگِ ممیزی — فقط مدیر و بالاتر، و فقط سازمانِ خودِ کاربر. */
@Controller('audit')
@UseGuards(JwtAuthGuard)
@MinRole(OrganizationRole.ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.audit.list(user.organizationId);
  }
}
