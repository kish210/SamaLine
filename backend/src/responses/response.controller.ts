import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { TenantAccessService } from '../common/tenant-access.service';
import {
  CreateResponseCommentDto,
  ResponseFilterDto,
  ReviewResponseDto,
} from './dto';
import { ResponseService } from './response.service';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';

/**
 * پاسخ‌نامه‌ها خام‌ترین داده‌ی سامانه‌اند (نام، شماره تماس، متن نظر). هر
 * مسیر پیش از هر کاری مالکیت فرم را بررسی می‌کند؛ شناسه از درخواست می‌آید
 * و توکن چیزی درباره‌ی آن نمی‌گوید.
 */
@Controller('responses')
@UseGuards(JwtAuthGuard)
export class ResponseController {
  constructor(
    private readonly responseService: ResponseService,
    private readonly tenant: TenantAccessService,
  ) {}

  /**
   * کارتابلِ درخواست‌های در انتظارِ تأیید (فاز H).
   *
   * همهٔ درخواست‌های معلقِ فرم‌های نیازمندِ تأیید را که مدیر به بخششان دسترسی
   * دارد، یک‌جا می‌دهد تا لازم نباشد تک‌تکِ فرم‌ها باز شوند.
   */
  @Get('pending')
  async pending(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.responseService.pendingReviews(workspaceId, {
      isManager: this.tenant.isManager(user),
      departmentIds: await this.tenant.memberDepartmentIds(user.sub),
    });
  }

  /** فقط شمارِ درخواست‌های معلق — برای نشانِ منوی «کارتابلِ تأیید». */
  @Get('pending/count')
  async pendingCount(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.responseService.pendingReviewCount(workspaceId, {
      isManager: this.tenant.isManager(user),
      departmentIds: await this.tenant.memberDepartmentIds(user.sub),
    });
  }

  @Get('form/:formId')
  async list(
    @Param('formId') formId: string,
    @Query() query: ResponseFilterDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertForm(formId, user);
    return this.responseService.listByForm(formId, query);
  }

  @MinRole(OrganizationRole.ANALYST)
  @Get('form/:formId/export')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async export(
    @Param('formId') formId: string,
    @Res() res: ExpressResponse,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertForm(formId, user);
    const result = await this.responseService.exportByForm(formId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    return res.send(result.buffer);
  }

  @Get(':responseId/comments')
  async comments(
    @Param('responseId') responseId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.assertResponse(responseId, user);
    return this.responseService.getComments(responseId);
  }

  @MinRole(OrganizationRole.ANALYST)
  @Post(':responseId/comments')
  async addComment(
    @Param('responseId') responseId: string,
    @Body() dto: CreateResponseCommentDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.assertResponse(responseId, user);
    return this.responseService.addComment(responseId, dto);
  }

  /**
   * تأیید/ردِ یک درخواست در گردش‌کارِ HR (فاز E).
   *
   * بررسی‌کننده باید به فرمِ همان درخواست دسترسی داشته باشد (عضوِ بخش یا مدیر)
   * و دستِ‌کم «ویرایشگر» باشد؛ بیننده/تحلیل‌گر فقط می‌خواند، تأیید نمی‌کند.
   */
  @MinRole(OrganizationRole.EDITOR)
  @Patch(':responseId/review')
  async review(
    @Param('responseId') responseId: string,
    @Body() dto: ReviewResponseDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.assertResponse(responseId, user);
    return this.responseService.review(responseId, dto.decision, dto.note, {
      userId: user.sub,
      email: user.email,
    });
  }

  /**
   * مالکیت یک پاسخ از راه فرمش بررسی می‌شود.
   *
   * یادداشت‌های روی یک پاسخ همان‌قدر محرمانه‌اند که خود پاسخ؛ بدون این، هر
   * کاربر واردشده با حدس زدن شناسه‌ی پاسخ می‌توانست آن‌ها را بخواند یا
   * یادداشت تازه بگذارد.
   */
  private async assertResponse(responseId: string, user: JwtUser) {
    const formId = await this.responseService.formIdOf(responseId);
    if (!formId) throw new NotFoundException('پاسخ یافت نشد');
    await this.tenant.assertForm(formId, user);
  }
}
