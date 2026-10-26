import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { TenantAccessService } from '../common/tenant-access.service';
import {
  CreateFormDto,
  CreatePublicationDto,
  SetArchivedDto,
  SetAuthModeDto,
  SetSlugDto,
  UpdateFormDto,
} from './dto';
import { FORM_TEMPLATES } from '../templates/form-templates';
import { FormService } from './form.service';

/**
 * همه‌ی مسیرهایی که شناسه‌ی فرم یا فضای کاری را از درخواست می‌گیرند، پیش
 * از هر کاری مالکیت را بررسی می‌کنند. بدون این، هر کاربر واردشده با حدس
 * زدن یک شناسه می‌توانست فرم‌ها و ساختار سازمان دیگری را بخواند یا عوض کند.
 */
@Controller('forms')
@UseGuards(JwtAuthGuard)
export class FormController {
  constructor(
    private readonly formService: FormService,
    private readonly tenant: TenantAccessService,
  ) {}

  @Get()
  async list(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
    @Query('includeArchived') includeArchived?: string,
  ) {
    await this.tenant.assertWorkspace(workspaceId, user);
    return this.formService.list(workspaceId, includeArchived === 'true', {
      isManager: this.tenant.isManager(user),
      departmentIds: await this.tenant.memberDepartmentIds(user.sub),
    });
  }

  /**
   * فهرست قالب‌های آماده.
   *
   * فقط فراداده برمی‌گردد نه کل ساختار؛ ساختار هنگام ساخت فرم سمت سرور
   * باز می‌شود و پنل نیازی به دیدنش ندارد. محتوایش برای همه یکسان است، پس
   * بررسی مالکیت ندارد.
   */
  @Get('templates')
  templates() {
    return FORM_TEMPLATES.map((template) => ({
      key: template.key,
      title: template.title,
      summary: template.summary,
      category: template.category,
      icon: template.icon,
      questionCount: template.structure.pages.reduce(
        (total, page) => total + (page.questions?.length ?? 0),
        0,
      ),
    }));
  }

  @Post()
  async create(@Body() dto: CreateFormDto, @CurrentUser() user: JwtUser) {
    await this.tenant.assertWorkspace(dto.workspaceId, user);
    return this.formService.create(dto);
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    await this.tenant.assertForm(id, user);
    return this.formService.get(id);
  }

  @Get(':id/logic-analysis')
  async analyzeLogic(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    await this.tenant.assertForm(id, user);
    return this.formService.analyzeLogic(id);
  }

  @Get(':id/flow-graph')
  async flowGraph(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    await this.tenant.assertForm(id, user);
    return this.formService.flowGraph(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFormDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertForm(id, user);
    return this.formService.update(id, dto);
  }

  @Post(':id/publish-link')
  async publish(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    await this.tenant.assertForm(id, user);
    return this.formService.publishLink(id);
  }

  /** تعیین نشانی اختصاصی و ثابت فرم. */
  @Patch(':id/slug')
  async setSlug(
    @Param('id') id: string,
    @Body() dto: SetSlugDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertForm(id, user);
    return this.formService.setPublicationSlug(id, dto.slug);
  }

  /**
   * آزاد بودن یک نشانی.
   *
   * بررسی مالکیت ندارد چون نشانی‌ها فضای نام مشترک کل سکو هستند؛ پاسخش هم
   * فقط «آزاد است یا نه» است، نه اطلاعاتی درباره‌ی صاحبش.
   */
  @Get('slug-availability/:slug')
  slugAvailability(@Param('slug') slug: string) {
    return this.formService.isSlugAvailable(slug);
  }

  /** تعیین نحوه‌ی احراز هویت پاسخ‌دهنده. */
  @Patch(':id/auth-mode')
  async setAuthMode(
    @Param('id') id: string,
    @Body() dto: SetAuthModeDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertForm(id, user);
    return this.formService.setAuthMode(id, dto.authMode, dto.password);
  }

  /** بایگانی یا بازگرداندن؛ برگشت‌پذیر و بدون از دست رفتن داده. */
  @Patch(':id/archived')
  async setArchived(
    @Param('id') id: string,
    @Body() dto: SetArchivedDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertForm(id, user);
    return this.formService.setArchived(id, dto.archived);
  }

  /**
   * حذف همیشگی فرم و همه‌ی پاسخ‌هایش.
   *
   * `acknowledgedResponses` باید با تعداد واقعی پاسخ‌ها برابر باشد؛ پاسخ‌ها
   * برگشتی ندارند و کاربر باید بداند دارد چه چیزی را از بین می‌برد.
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Query('acknowledgedResponses') acknowledged?: string,
  ) {
    await this.tenant.assertForm(id, user);
    return this.formService.remove(id, Number(acknowledged ?? NaN));
  }

  @Post(':id/publications')
  async createPublication(
    @Param('id') id: string,
    @Body() dto: CreatePublicationDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertForm(id, user);
    return this.formService.createPublication(id, dto);
  }
}
