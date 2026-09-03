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
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateApiKeyDto, CreateIdentityProviderDto } from './dto';
import { OrganizationService } from './organization.service';

@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post('api-keys')
  createApiKey(@Body() dto: CreateApiKeyDto) {
    return this.organizationService.createApiKey(dto);
  }

  @Get('api-keys')
  listApiKeys(@Query('organizationId') organizationId: string) {
    return this.organizationService.listApiKeys(organizationId);
  }

  @Delete('api-keys/:id')
  revokeApiKey(@Param('id') id: string) {
    return this.organizationService.revokeApiKey(id);
  }

  @Post('identity-providers')
  createIdentityProvider(@Body() dto: CreateIdentityProviderDto) {
    return this.organizationService.createIdentityProvider(dto);
  }

  @Get('identity-providers')
  listIdentityProviders(@Query('organizationId') organizationId: string) {
    return this.organizationService.listIdentityProviders(organizationId);
  }
}
