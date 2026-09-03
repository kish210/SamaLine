import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { PublicationType } from '../database/entities/publication.entity';
import { CreateDeliveryLogDto } from './dto';
import { DistributionService } from './distribution.service';

@Controller('distribution')
@UseGuards(JwtAuthGuard)
export class DistributionController {
  constructor(private readonly distributionService: DistributionService) {}

  @Post('delivery-logs')
  createLog(@Body() dto: CreateDeliveryLogDto) {
    return this.distributionService.createLog(dto);
  }

  @Get('delivery-logs')
  listLogs(@Query('publicationId') publicationId: string) {
    return this.distributionService.listLogs(publicationId);
  }

  @Post('forms/:formId/publications/:type')
  createChannel(
    @Param('formId') formId: string,
    @Param('type') type: PublicationType,
  ) {
    return this.distributionService.createChannelPublication(formId, type);
  }

  @Get('publications/:publicationId/assets')
  assets(@Param('publicationId') publicationId: string) {
    return this.distributionService.channelAssets(publicationId);
  }
}
