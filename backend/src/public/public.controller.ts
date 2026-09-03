import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NextStepDto, SaveProgressDto, SubmitResponseDto } from './dto';
import { PublicService } from './public.service';

@Controller('public/forms')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('portal/:organizationId')
  getPortal(@Param('organizationId') organizationId: string) {
    return this.publicService.getPortalForms(organizationId);
  }

  @Get(':token')
  getForm(@Param('token') token: string) {
    return this.publicService.getByToken(token);
  }

  @Post(':token/next')
  nextStep(@Param('token') token: string, @Body() dto: NextStepDto) {
    return this.publicService.nextStepByToken(token, dto);
  }

  @Post(':token/pages/:pageId')
  resolvePage(
    @Param('token') token: string,
    @Param('pageId') pageId: string,
    @Body() dto: NextStepDto,
  ) {
    return this.publicService.resolvePageByToken(token, pageId, dto);
  }

  @Post(':token/submit')
  submit(@Param('token') token: string, @Body() dto: SubmitResponseDto) {
    return this.publicService.submitByToken(token, dto);
  }

  @Post(':token/save-progress')
  saveProgress(@Param('token') token: string, @Body() dto: SaveProgressDto) {
    return this.publicService.saveProgressByToken(token, dto);
  }

  @Get(':token/progress/:respondentKey')
  getProgress(
    @Param('token') token: string,
    @Param('respondentKey') respondentKey: string,
  ) {
    return this.publicService.getProgressByToken(token, respondentKey);
  }
}
