import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactSourceEntity } from '../database/entities/contact-source.entity';
import { ContactListEntity } from '../database/entities/contact-list.entity';
import { ContactsService } from './contacts.service';
import type { CreateContactSourceDto } from './dto';
import { extractItems, mapRecords } from './source-mapper';
import { assertPublicUrl } from './url-guard';

/** سقف رکورد در هر همگام‌سازی، تا یک پاسخ غول حافظه را پر نکند. */
const MAX_RECORDS = Number(process.env.CONTACT_SOURCE_MAX_RECORDS ?? 5000);
const TIMEOUT_MS = Number(process.env.CONTACT_SOURCE_TIMEOUT_MS ?? 20000);

@Injectable()
export class ContactSourceService {
  private readonly logger = new Logger(ContactSourceService.name);

  constructor(
    @InjectRepository(ContactSourceEntity)
    private readonly sourceRepo: Repository<ContactSourceEntity>,
    @InjectRepository(ContactListEntity)
    private readonly listRepo: Repository<ContactListEntity>,
    private readonly contacts: ContactsService,
  ) {}

  async create(organizationId: string, dto: CreateContactSourceDto) {
    await this.requireList(organizationId, dto.listId);

    const check = await assertPublicUrl(dto.url);
    if (!check.allowed) {
      throw new BadRequestException(check.reason ?? 'نشانی مجاز نیست');
    }

    return this.sourceRepo.save(
      this.sourceRepo.create({
        organizationId,
        listId: dto.listId,
        name: dto.name,
        url: dto.url,
        method: (dto.method ?? 'GET').toUpperCase(),
        headers: dto.headers ?? {},
        body: dto.body ?? {},
        itemsPath: dto.itemsPath ?? '',
        mapping: dto.mapping,
        isActive: true,
      }),
    );
  }

  async list(organizationId: string) {
    const sources = await this.sourceRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });

    // هدرها معمولا کلید API دارند و نباید به کلاینت برگردند.
    return sources.map(({ headers, ...source }) => ({
      ...source,
      headerKeys: Object.keys(headers ?? {}),
    }));
  }

  async remove(organizationId: string, sourceId: string) {
    const source = await this.requireSource(organizationId, sourceId);
    await this.sourceRepo.remove(source);
    return { deleted: true };
  }

  /**
   * پیش‌نمایش بدون ذخیره: چند رکورد اول را می‌گیرد و نتیجه‌ی نگاشت را
   * نشان می‌دهد تا کاربر پیش از همگام‌سازی، تنظیمات را درست کند.
   */
  async preview(organizationId: string, dto: CreateContactSourceDto) {
    await this.requireList(organizationId, dto.listId);
    const fetched = await this.fetchRecords({
      url: dto.url,
      method: (dto.method ?? 'GET').toUpperCase(),
      headers: dto.headers ?? {},
      body: dto.body ?? {},
      itemsPath: dto.itemsPath ?? '',
    });

    const { contacts, unusable } = mapRecords(fetched.items, dto.mapping);

    return {
      totalFetched: fetched.items.length,
      usable: contacts.length,
      unusable,
      sampleRaw: fetched.items.slice(0, 3),
      sampleMapped: contacts.slice(0, 5),
    };
  }

  /** همگام‌سازی واقعی: رکوردها را می‌گیرد و در فهرست می‌نشاند. */
  async sync(organizationId: string, sourceId: string) {
    const source = await this.requireSource(organizationId, sourceId);

    const fetched = await this.fetchRecords({
      url: source.url,
      method: source.method,
      headers: source.headers ?? {},
      body: source.body ?? {},
      itemsPath: source.itemsPath ?? '',
    });

    const { contacts, unusable } = mapRecords(fetched.items, source.mapping);

    // ContactsService خودش تکراری‌ها را بر اساس موبایل/ایمیل ادغام می‌کند،
    // پس همگام‌سازی دوباره رکورد تکراری نمی‌سازد.
    const result = contacts.length
      ? await this.contacts.addContacts(organizationId, source.listId, {
          contacts,
        })
      : { created: 0, updated: 0, skipped: [] };

    const summary = {
      fetched: fetched.items.length,
      created: result.created,
      updated: result.updated,
      unusable,
      at: new Date().toISOString(),
    };

    source.lastSyncedAt = new Date();
    source.lastResult = summary;
    await this.sourceRepo.save(source);

    this.logger.log(
      `همگام‌سازی «${source.name}»: ${summary.created} جدید، ${summary.updated} به‌روزرسانی`,
    );

    return summary;
  }

  /** همگام‌سازی همه‌ی منابع فعال سازمان. */
  async syncAll(organizationId: string) {
    const sources = await this.sourceRepo.find({
      where: { organizationId, isActive: true },
    });

    const results = [];
    for (const source of sources) {
      try {
        results.push({
          sourceId: source.id,
          name: source.name,
          ...(await this.sync(organizationId, source.id)),
        });
      } catch (error) {
        // شکست یک منبع نباید بقیه را متوقف کند.
        results.push({
          sourceId: source.id,
          name: source.name,
          error: error instanceof Error ? error.message : 'خطای نامشخص',
        });
      }
    }

    return results;
  }

  private async fetchRecords(config: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
    itemsPath: string;
  }) {
    const check = await assertPublicUrl(config.url);
    if (!check.allowed) {
      throw new BadRequestException(check.reason ?? 'نشانی مجاز نیست');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const hasBody = config.method !== 'GET' && config.method !== 'HEAD';
      const response = await fetch(config.url, {
        method: config.method,
        headers: {
          accept: 'application/json',
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
          ...config.headers,
        },
        body: hasBody ? JSON.stringify(config.body) : undefined,
        signal: controller.signal,
        redirect: 'error', // تغییر مسیر می‌تواند محافظت SSRF را دور بزند.
      });

      if (!response.ok) {
        throw new BadRequestException(
          `سرویس مقصد خطا داد (${response.status})`,
        );
      }

      const payload: unknown = await response.json();
      const { items, error } = extractItems(payload, config.itemsPath);
      if (error) throw new BadRequestException(error);

      return { items: items.slice(0, MAX_RECORDS) };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const message =
        error instanceof Error ? error.message : 'خطای نامشخص در اتصال';
      throw new BadRequestException(`اتصال به سرویس ناموفق بود: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private async requireList(organizationId: string, listId: string) {
    const list = await this.listRepo.findOne({
      where: { id: listId, organizationId },
    });
    if (!list) throw new NotFoundException('فهرست مخاطبان یافت نشد');
    return list;
  }

  private async requireSource(organizationId: string, sourceId: string) {
    const source = await this.sourceRepo.findOne({
      where: { id: sourceId, organizationId },
    });
    if (!source) throw new NotFoundException('منبع مخاطبان یافت نشد');
    return source;
  }
}
