import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import {
  LoginPasswordDto,
  NextStepDto,
  RequestOtpDto,
  SaveProgressDto,
  SubmitResponseDto,
  VerifyOtpDto,
} from './dto';
import { PublicService } from './public.service';

/**
 * اعتبار دسترسی پاسخ‌دهنده در هدر جداگانه می‌آید و با توکن ورود پنل
 * قاطی نمی‌شود، چون این مسیرها اصلا نگهبان JWT پنل را ندارند.
 */
const RESPONDENT_HEADER = 'x-respondent-token';

@Controller('public/forms')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('portal/:organizationId')
  getPortal(@Param('organizationId') organizationId: string) {
    return this.publicService.getPortalForms(organizationId);
  }

  /** نوع احراز هویت لازم، پیش از نمایش فرم. */
  @Get(':token/auth-info')
  authInfo(@Param('token') token: string) {
    return this.publicService.getAuthInfo(token);
  }

  @Post(':token/auth/password')
  loginWithPassword(
    @Param('token') token: string,
    @Body() dto: LoginPasswordDto,
  ) {
    return this.publicService.loginWithPassword(token, dto.password);
  }

  @Post(':token/auth/otp/request')
  requestOtp(@Param('token') token: string, @Body() dto: RequestOtpDto) {
    return this.publicService.requestOtp(token, dto.destination);
  }

  @Post(':token/auth/otp/verify')
  verifyOtp(@Param('token') token: string, @Body() dto: VerifyOtpDto) {
    return this.publicService.verifyOtp(token, dto.destination, dto.code);
  }

  @Get(':token')
  getForm(
    @Param('token') token: string,
    @Headers(RESPONDENT_HEADER) accessToken?: string,
  ) {
    return this.publicService.openForm(token, accessToken);
  }

  @Post(':token/next')
  nextStep(
    @Param('token') token: string,
    @Body() dto: NextStepDto,
    @Headers(RESPONDENT_HEADER) accessToken?: string,
  ) {
    return this.publicService.nextStepByToken(token, dto, accessToken);
  }

  @Post(':token/pages/:pageId')
  resolvePage(
    @Param('token') token: string,
    @Param('pageId') pageId: string,
    @Body() dto: NextStepDto,
    @Headers(RESPONDENT_HEADER) accessToken?: string,
  ) {
    return this.publicService.resolvePageByToken(
      token,
      pageId,
      dto,
      accessToken,
    );
  }

  @Post(':token/submit')
  submit(
    @Param('token') token: string,
    @Body() dto: SubmitResponseDto,
    @Headers(RESPONDENT_HEADER) accessToken?: string,
  ) {
    return this.publicService.submitByToken(token, dto, accessToken);
  }

  @Post(':token/save-progress')
  saveProgress(
    @Param('token') token: string,
    @Body() dto: SaveProgressDto,
    @Headers(RESPONDENT_HEADER) accessToken?: string,
  ) {
    return this.publicService.saveProgressByToken(token, dto, accessToken);
  }

  @Get(':token/progress/:respondentKey')
  getProgress(
    @Param('token') token: string,
    @Param('respondentKey') respondentKey: string,
    @Headers(RESPONDENT_HEADER) accessToken?: string,
  ) {
    return this.publicService.getProgressByToken(
      token,
      respondentKey,
      accessToken,
    );
  }
}
