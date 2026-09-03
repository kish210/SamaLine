import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
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
  list(@Query('organizationId') organizationId: string) {
    return this.integrationsService.listWebhooks(organizationId);
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
