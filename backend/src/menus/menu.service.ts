import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { MenuEntity } from '../database/entities/menu.entity';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import type { MenuSection } from '../database/entities/menu.entity';
import { validateSlug } from '../forms/slug';
import { findMenuTemplate } from '../templates/menu-templates';
import { DEFAULT_MENU_THEME, isMenuTheme } from '../templates/menu-themes';

export interface MenuInput {
  slug?: string;
  title?: string;
  description?: string;
  logoUrl?: string;
  images?: string[];
  sections?: MenuSection[];
  isActive?: boolean;
  /**
   * پر کردن بخش‌ها از یک قالبِ محتوای آماده — هم هنگام ساخت، هم روی منوی
   * موجود (بخش‌های فعلی جایگزین می‌شوند؛ عنوان/لوگو/عکس‌ها می‌مانند).
   */
  templateKey?: string;
  /** ظاهرِ صفحه (کلیدِ menu-themes.ts). */
  theme?: string;
}

/** حداکثر تعداد عکس و قلم؛ جلوی صفحه‌ای که روی موبایل باز نمی‌شود را می‌گیرد. */
const MAX_IMAGES = 30;
const MAX_ITEMS = 400;

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuEntity)
    private readonly menus: Repository<MenuEntity>,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  list(workspaceId: string) {
    return this.menus.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(workspaceId: string, id: string) {
    const menu = await this.menus.findOne({ where: { id, workspaceId } });
    if (!menu) throw new NotFoundException('منو یافت نشد');
    return menu;
  }

  async save(workspaceId: string, id: string | null, input: MenuInput) {
    const existing = id
      ? await this.menus.findOne({ where: { id, workspaceId } })
      : null;
    if (id && !existing) throw new NotFoundException('منو یافت نشد');

    // همان قاعده‌ی نشانک فرم‌ها و پرتال؛ دو قاعده‌ی موازی با هم واگرا می‌شوند.
    const check = validateSlug(input.slug ?? existing?.slug ?? '');
    if (!check.valid) {
      throw new BadRequestException(check.reason ?? 'نشانی نامعتبر است');
    }
    const slug = check.normalized;

    const clash = await this.menus.findOne({
      where: existing ? { slug, id: Not(existing.id) } : { slug },
    });
    if (clash) throw new BadRequestException('این نشانی قبلا گرفته شده است');

    const template = input.templateKey
      ? findMenuTemplate(input.templateKey)
      : undefined;
    if (input.templateKey && !template) {
      throw new BadRequestException('قالب انتخاب‌شده وجود ندارد');
    }

    /*
     * وقتی کاربر یک قالب انتخاب می‌کند، باید محتوای همان قالب بیاید. پیش‌تر
     * چون پنل هنگام ساخت، `sections: []` هم می‌فرستاد و `[] ?? x` همان `[]`
     * می‌ماند، قالب نادیده گرفته می‌شد و همه‌ی قالب‌ها یک منوی خالیِ یکسان
     * می‌ساختند. پس اگر قالبی صریح انتخاب شده، بخش‌های همان قالب مرجع‌اند.
     */
    const sections = template
      ? template.sections
      : (input.sections ?? existing?.sections ?? []);
    const images = input.images ?? existing?.images ?? [];
    this.assertSize(images, sections);

    if (input.theme !== undefined && !isMenuTheme(input.theme)) {
      throw new BadRequestException('ظاهرِ انتخاب‌شده وجود ندارد');
    }
    const theme = input.theme ?? existing?.theme ?? DEFAULT_MENU_THEME;

    const saved = await this.menus.save(
      this.menus.create({
        ...(existing ?? {}),
        workspaceId,
        slug,
        title: input.title ?? existing?.title ?? template?.title ?? 'منو',
        description:
          input.description ??
          existing?.description ??
          template?.description ??
          '',
        logoUrl: input.logoUrl ?? existing?.logoUrl ?? '',
        images,
        sections,
        theme,
        isActive: input.isActive ?? existing?.isActive ?? true,
      }),
    );
    return saved;
  }

  async remove(workspaceId: string, id: string) {
    const result = await this.menus.delete({ id, workspaceId });
    if (!result.affected) throw new NotFoundException('منو یافت نشد');
    return { ok: true };
  }

  /** نمای عمومی؛ آنچه با اسکن QR باز می‌شود. */
  async publicBySlug(rawSlug: string) {
    const slug = (rawSlug ?? '').trim().toLowerCase();
    const menu = await this.menus.findOne({ where: { slug } });
    if (!menu || !menu.isActive) throw new NotFoundException('منو یافت نشد');

    return {
      title: menu.title,
      description: menu.description,
      logoUrl: menu.logoUrl,
      theme: isMenuTheme(menu.theme) ? menu.theme : DEFAULT_MENU_THEME,
      images: menu.images ?? [],
      // بخش یا قلمِ بی‌نام روی صفحه‌ی مهمان جای خالی می‌شد.
      sections: (menu.sections ?? [])
        .map((section) => ({
          ...section,
          items: (section.items ?? []).filter((item) => item.name?.trim()),
        }))
        .filter((section) => section.title?.trim() || section.items.length),
      footer: await this.platformSettings.publicFooter(),
      updatedAt: menu.updatedAt,
    };
  }

  private assertSize(images: string[], sections: MenuSection[]) {
    if (images.length > MAX_IMAGES) {
      throw new BadRequestException(
        `حداکثر ${MAX_IMAGES.toLocaleString('fa-IR')} عکس برای یک منو ممکن است`,
      );
    }
    const items = sections.reduce((n, s) => n + (s.items?.length ?? 0), 0);
    if (items > MAX_ITEMS) {
      throw new BadRequestException(
        `حداکثر ${MAX_ITEMS.toLocaleString('fa-IR')} قلم برای یک منو ممکن است`,
      );
    }
  }
}
