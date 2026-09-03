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
import { CreateFormDto, CreatePublicationDto, UpdateFormDto } from './dto';
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

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFormDto) {
    return this.formService.update(id, dto);
  }

  @Post(':id/publish-link')
  publish(@Param('id') id: string) {
    return this.formService.publishLink(id);
  }

  @Post(':id/publications')
  createPublication(
    @Param('id') id: string,
    @Body() dto: CreatePublicationDto,
  ) {
    return this.formService.createPublication(id, dto);
  }
}
