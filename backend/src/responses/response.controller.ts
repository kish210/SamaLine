import { Controller, Get, Header, Param, Res, UseGuards } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ResponseService } from './response.service';

@Controller('responses')
@UseGuards(JwtAuthGuard)
export class ResponseController {
  constructor(private readonly responseService: ResponseService) {}

  @Get('form/:formId')
  list(@Param('formId') formId: string) {
    return this.responseService.listByForm(formId);
  }

  @Get('form/:formId/export')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async export(@Param('formId') formId: string, @Res() res: ExpressResponse) {
    const result = await this.responseService.exportByForm(formId);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  }
}
