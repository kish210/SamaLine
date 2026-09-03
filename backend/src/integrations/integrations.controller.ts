import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrganizationId } from '../common/current-user.decorator';
import { CreateWebhookDto } from './dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('webhooks')
  create(@Body() dto: CreateWebhookDto) {
    return this.integrationsService.createWebhook(dto);
  }

  @Get('webhooks')
  list(@OrganizationId() organizationId: string) {
    return this.integrationsService.listWebhooks(organizationId);
  }

  @Post('webhooks/verify-signature')
  verifySignature(
    @Body()
    body: {
      secret: string;
      signature: string;
      payload: Record<string, unknown>;
    },
  ) {
    return this.integrationsService.verifySignature(
      body.secret,
      body.payload ?? {},
      body.signature,
    );
  }

  @Post('webhooks/simulate-dispatch')
  simulate(
    @Body()
    body: {
      organizationId: string;
      event: string;
      payload: Record<string, unknown>;
    },
  ) {
    return this.integrationsService.buildDispatch(
      body.event,
      body.organizationId,
      body.payload ?? {},
    );
  }
}
