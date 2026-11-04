import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AttendanceLocationEntity,
  PunchLocation,
} from '../database/entities/work-shift.entity';

/** مختصاتِ خامِ گزارش‌شدهٔ پیام‌رسان. */
export interface PunchCoords {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** نتیجهٔ سنجشِ یک نقطه با مکان‌های مجاز. */
export interface GeofenceVerdict {
  /** سازمان مکانی تعریف کرده و باید رعایت شود. */
  enforced: boolean;
  /** داخلِ نزدیک‌ترین مکانِ مجاز است (یا مکانی تعریف نشده). */
  inside: boolean;
  /** نزدیک‌ترین مکان و فاصله‌اش؛ اگر مکانی نباشد null. */
  nearest: { id: string; name: string; distanceMeters: number } | null;
}

const EARTH_RADIUS_M = 6371000;

/**
 * فاصلهٔ دو نقطه روی کره، به متر (فرمولِ Haversine).
 *
 * عمداً بدونِ کتابخانه: یک تابعِ خالصِ ۱۵ خطی، بدونِ وابستگی و کاملاً
 * قابلِ تست. دقتِ کافی برای دایره‌های چندصد متری دارد.
 */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface LocationInput {
  name?: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  departmentId?: string | null;
  isActive?: boolean;
}

/**
 * مکان‌های مجازِ حضور و سنجشِ مختصاتِ ربات با آن‌ها.
 *
 * چرا دایره و نه چندضلعی: تعریفِ چندضلعی در پنل به نقشهٔ تعاملی نیاز دارد و
 * خطای کاربر در آن زیاد است؛ دایره با «مرکز + شعاع» همان نیازِ عملی
 * («کارمند در محلِ کار است؟») را برمی‌آورد.
 */
@Injectable()
export class AttendanceLocationService {
  constructor(
    @InjectRepository(AttendanceLocationEntity)
    private readonly places: Repository<AttendanceLocationEntity>,
  ) {}

  list(
    organizationId: string,
    opts: { includeInactive?: boolean; departmentId?: string } = {},
  ) {
    const where: Record<string, unknown> = { organizationId };
    if (!opts.includeInactive) where.isActive = true;
    if (opts.departmentId) where.departmentId = opts.departmentId;
    return this.places.find({ where, order: { name: 'ASC' } });
  }

  async create(organizationId: string, input: LocationInput) {
    const row = this.places.create({
      organizationId,
      ...this.clean(input, true),
    } as Partial<AttendanceLocationEntity>);
    return this.places.save(row);
  }

  async update(organizationId: string, id: string, input: LocationInput) {
    const row = await this.assert(organizationId, id);
    Object.assign(row, this.clean(input, false));
    return this.places.save(row);
  }

  /**
   * حذفِ واقعی، نه غیرفعال‌سازی.
   *
   * مختصاتِ ثبت‌شده روی سطرهای حضور به‌شکلِ JSON کپی شده‌اند و به این جدول
   * ارجاع نمی‌دهند؛ پس حذف، تاریخچهٔ حضور را خراب نمی‌کند.
   */
  async remove(organizationId: string, id: string) {
    const row = await this.assert(organizationId, id);
    await this.places.remove(row);
    return { ok: true };
  }

  /**
   * آیا این نقطه داخلِ یکی از مکان‌های مجاز است؟
   *
   * اگر سازمان هیچ مکانِ فعالی نداشته باشد، `enforced: false` برمی‌گردد تا
   * رفتارِ پیشین (ثبتِ بدونِ موقعیت) برای سازمان‌های موجود نشکند.
   */
  async evaluate(
    organizationId: string,
    coords: PunchCoords,
    opts: { departmentId?: string | null } = {},
  ): Promise<GeofenceVerdict> {
    const places = await this.places.find({
      where: { organizationId, isActive: true },
    });
    if (places.length === 0) {
      return { enforced: false, inside: true, nearest: null };
    }

    // مکانِ بخشِ خودِ پرسنل مقدم است؛ اگر نبود، مکانِ عمومیِ سازمان.
    const own = opts.departmentId
      ? places.filter((p) => p.departmentId === opts.departmentId)
      : [];
    const pool = own.length > 0 ? own : places.filter((p) => !p.departmentId);
    const candidates = pool.length > 0 ? pool : places;

    let best: { place: AttendanceLocationEntity; distance: number } | null =
      null;
    for (const place of candidates) {
      const distance = haversineMeters(
        { lat: coords.lat, lng: coords.lng },
        { lat: place.lat, lng: place.lng },
      );
      if (!best || distance < best.distance) best = { place, distance };
    }

    const nearest = best
      ? {
          id: best.place.id,
          name: best.place.name,
          distanceMeters: Math.round(best.distance),
        }
      : null;

    /*
     * خطای GPS به نفعِ پرسنل بخشیده می‌شود، ولی سقف دارد: دقتِ گزارش‌شده
     * حداکثر ۵۰ متر به شعاع اضافه می‌کند. بدونِ سقف، دستگاهی که «دقتِ
     * ۵۰۰ متر» اعلام کند عملاً هر نقطه‌ای را داخل می‌کند.
     */
    const slack = Math.min(Math.max(coords.accuracy ?? 0, 0), 50);
    const inside = best
      ? best.distance <= best.place.radiusMeters + slack
      : false;

    return { enforced: true, inside, nearest };
  }

  /**
   * ساختِ شیءِ محلِ ثبت برای ستونِ JSONِ سطرِ حضور.
   *
   * `null` یعنی پرسنل موقعیت نفرستاده — نه اینکه «بیرون» بوده. تفکیکِ این
   * دو مهم است: گزارشِ «۳ نفر بیرون از محل» نباید کسانی را بشمارد که
   * اصلاً موقعیت نداده‌اند.
   */
  async describe(
    organizationId: string,
    coords: PunchCoords | null | undefined,
    opts: { departmentId?: string | null } = {},
  ): Promise<PunchLocation | null> {
    if (!coords) return null;
    const verdict = await this.evaluate(organizationId, coords, opts);
    return {
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      at: new Date().toISOString(),
      locationId: verdict.nearest?.id ?? null,
      locationName: verdict.nearest?.name,
      distanceMeters: verdict.nearest?.distanceMeters,
      status: !verdict.enforced
        ? 'none'
        : verdict.inside
          ? 'inside'
          : 'outside',
    };
  }

  private async assert(organizationId: string, id: string) {
    const row = await this.places.findOne({ where: { organizationId, id } });
    if (!row) throw new NotFoundException('مکانِ مجاز پیدا نشد');
    return row;
  }

  private clean(input: LocationInput, requireName: boolean) {
    const out: Partial<AttendanceLocationEntity> = {};
    if (input.name !== undefined || requireName) {
      const name = (input.name ?? '').trim();
      if (!name) throw new BadRequestException('نامِ مکان لازم است');
      out.name = name;
    }
    if (input.lat !== undefined) {
      if (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90) {
        throw new BadRequestException('عرضِ جغرافیایی باید بین ۹۰- و ۹۰ باشد');
      }
      out.lat = input.lat;
    }
    if (input.lng !== undefined) {
      if (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180) {
        throw new BadRequestException('طولِ جغرافیایی باید بین ۱۸۰- و ۱۸۰ باشد');
      }
      out.lng = input.lng;
    }
    if (input.radiusMeters !== undefined) {
      const r = Math.round(input.radiusMeters);
      if (!Number.isFinite(r) || r < 20 || r > 5000) {
        throw new BadRequestException('شعاع باید بین ۲۰ و ۵۰۰۰ متر باشد');
      }
      out.radiusMeters = r;
    }
    if (input.departmentId !== undefined) out.departmentId = input.departmentId;
    if (input.isActive !== undefined) out.isActive = input.isActive;
    return out;
  }
}
