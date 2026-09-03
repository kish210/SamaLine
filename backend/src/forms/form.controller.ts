import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import {
  CreateFormDto,
  CreatePublicationDto,
  SetAuthModeDto,
  SetSlugDto,
  UpdateFormDto,
} from './dto';
import { FormService } from './form.service';

@Controller('forms')
@UseGuards(JwtAuthGuard)
export class FormController {
  constructor(private readonly formService: FormService) {}

  @Get()
  list(@Query('workspaceId') workspaceId: string) {
    return this.formService.list(workspaceId);
  }

  @Post()
  create(@Body() dto: CreateFormDto) {
    return this.formService.create(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.formService.get(id);
  }

  @Get(':id/logic-analysis')
  analyzeLogic(@Param('id') id: string) {
    return this.formService.analyzeLogic(id);
  }

  @Get(':id/flow-graph')
  flowGraph(@Param('id') id: string) {
    return this.formService.flowGraph(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFormDto) {
    return this.formService.update(id, dto);
  }

  @Post(':id/publish-link')
  publish(@Param('id') id: string) {
    return this.formService.publishLink(id);
  }

  /** تعیین نشانی اختصاصی و ثابت فرم. */
  @Patch(':id/slug')
  setSlug(@Param('id') id: string, @Body() dto: SetSlugDto) {
    return this.formService.setPublicationSlug(id, dto.slug);
  }

  @Get('slug-availability/:slug')
  slugAvailability(@Param('slug') slug: string) {
    return this.formService.isSlugAvailable(slug);
  }

  /** تعیین نحوه‌ی احراز هویت پاسخ‌دهنده. */
  @Patch(':id/auth-mode')
  setAuthMode(@Param('id') id: string, @Body() dto: SetAuthModeDto) {
    return this.formService.setAuthMode(id, dto.authMode, dto.password);
  }

  @Post(':id/publications')
  createPublication(
    @Param('id') id: string,
    @Body() dto: CreatePublicationDto,
  ) {
    return this.formService.createPublication(id, dto);
  }
}
