import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrganizationId } from '../common/current-user.decorator';
import { CreateWorkspaceDto } from './dto';
import { WorkspaceService } from './workspace.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  list(@OrganizationId() organizationId: string) {
    return this.workspaceService.list(organizationId);
  }

  @Post()
  create(
    @Body() dto: CreateWorkspaceDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.workspaceService.create({ ...dto, organizationId });
  }
}
