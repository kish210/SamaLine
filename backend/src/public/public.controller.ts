import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SubmitResponseDto } from './dto';
import { PublicService } from './public.service';

@Controller('public/forms')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':token')
  getForm(@Param('token') token: string) {
    return this.publicService.getByToken(token);
  }

  @Post(':token/submit')
  submit(@Param('token') token: string, @Body() dto: SubmitResponseDto) {
    return this.publicService.submitByToken(token, dto);
  }
}
