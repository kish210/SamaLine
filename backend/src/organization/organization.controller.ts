import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrganizationId } from '../common/current-user.decorator';
import { CreateApiKeyDto, CreateIdentityProviderDto } from './dto';
import { OrganizationService } from './organization.service';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';

@MinRole(OrganizationRole.ADMIN)
@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post('api-keys')
  createApiKey(
    @Body() dto: CreateApiKeyDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.organizationService.createApiKey({ ...dto, organizationId });
  }

  @Get('api-keys')
  listApiKeys(@OrganizationId() organizationId: string) {
    return this.organizationService.listApiKeys(organizationId);
  }

  @Delete('api-keys/:id')
  revokeApiKey(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.organizationService.revokeApiKey(id, organizationId);
  }

  @Post('identity-providers')
  createIdentityProvider(
    @Body() dto: CreateIdentityProviderDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.organizationService.createIdentityProvider({
      ...dto,
      organizationId,
    });
  }

  @Get('identity-providers')
  listIdentityProviders(@OrganizationId() organizationId: string) {
    return this.organizationService.listIdentityProviders(organizationId);
  }
}
