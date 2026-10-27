import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { TenantAccessService } from '../common/tenant-access.service';
import type { MenuSection } from '../database/entities/menu.entity';
import { menuTemplateSummaries } from '../templates/menu-templates';
import { MENU_THEMES } from '../templates/menu-themes';
import { MenuService } from './menu.service';

export class MenuDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  images?: string[];

  /** ساختار بخش‌ها؛ شکل دقیقش در سرویس بررسی و هرس می‌شود. */
  @IsOptional()
  @IsArray()
  sections?: MenuSection[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  templateKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  theme?: string;
}

/**
 * منوی QR — ساخت و ویرایش.
 *
 * نقش‌ها از پیش‌فرض خودِ گارد می‌آیند: خواندن برای همه‌ی اعضا، تغییر دست‌کم
 * «ویرایشگر». منو محتواست نه تنظیمات سازمان، پس «مدیر» لازم نیست.
 */
@Controller('menus')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(
    private readonly menus: MenuService,
    private readonly tenant: TenantAccessService,
  ) {}

  /** قالب‌های آماده؛ فقط فراداده، بدون محتوا. */
  @Get('templates')
  templates() {
    return menuTemplateSummaries();
  }

  /** ظاهرهای آماده‌ی صفحه‌ی منو (برای پیش‌نمایشِ پنل). */
  @Get('themes')
  themes() {
    return MENU_THEMES;
  }

  @Get()
  async list(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertWorkspace(workspaceId, user);
    return this.menus.list(workspaceId);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertWorkspace(workspaceId, user);
    return this.menus.get(workspaceId, id);
  }

  @Post()
  async create(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: MenuDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertWorkspace(workspaceId, user);
    return this.menus.save(workspaceId, null, dto);
  }

  @Post(':id')
  async update(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @Body() dto: MenuDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertWorkspace(workspaceId, user);
    return this.menus.save(workspaceId, id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertWorkspace(workspaceId, user);
    return this.menus.remove(workspaceId, id);
  }
}

/** صفحه‌ای که مهمان با اسکن QR باز می‌کند؛ بدون ورود. */
@Controller('public/menu')
export class PublicMenuController {
  constructor(private readonly menus: MenuService) {}

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.menus.publicBySlug(slug);
  }
}
