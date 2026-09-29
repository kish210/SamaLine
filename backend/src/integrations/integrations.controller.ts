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
import { CreateWebhookDto } from './dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post('webhooks')
  create(
    @Body() dto: CreateWebhookDto,
    @OrganizationId() organizationId: string,
  ) {
    // سازمان فقط از توکن؛ مقدار بدنه نادیده گرفته می‌شود.
    return this.integrationsService.createWebhook({ ...dto, organizationId });
  }

  @Get('webhooks')
  list(@OrganizationId() organizationId: string) {
    return this.integrationsService.listWebhooks(organizationId);
  }

  @Delete('webhooks/:id')
  remove(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.integrationsService.removeWebhook(id, organizationId);
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
      event: string;
      payload: Record<string, unknown>;
    },
    @OrganizationId() organizationId: string,
  ) {
    /*
     * پیش از این سازمان از بدنه خوانده می‌شد؛ یعنی هر کسی می‌توانست با راز
     * وبهوک سازمان دیگر امضا بسازد و نشانی مقصدش را ببیند.
     */
    return this.integrationsService.buildDispatch(
      body.event,
      organizationId,
      body.payload ?? {},
    );
  }
}
