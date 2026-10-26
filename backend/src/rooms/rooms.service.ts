import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HotelRoomEntity,
  type RoomAsset,
} from '../database/entities/hotel-room.entity';

export interface RoomInput {
  number?: string;
  floor?: number;
  kind?: string;
  assets?: RoomAsset[];
  isActive?: boolean;
}

export interface BulkInput {
  floors: number;
  roomsPerFloor: number;
  /** شماره = طبقه × ضریب + ترتیب؛ طبقه ۳ اتاق ۵ با ضریب ۱۰۰ می‌شود ۳۰۵. */
  numberingBase?: number;
  /** از کدام طبقه شروع شود (پیش‌فرض ۱). */
  startFloor?: number;
  kind?: string;
}

/**
 * اتاق‌های هتل به‌عنوان داده‌ی پایه (فاز D).
 *
 * اتاق‌ها سطحِ سازمان‌اند (نه فضای کاری) چون داده‌ی مرجعِ کلِ هتل‌اند و همه‌ی
 * بخش‌ها از همان یک فهرست استفاده می‌کنند. `organizationId` همیشه از توکن.
 */
@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(HotelRoomEntity)
    private readonly rooms: Repository<HotelRoomEntity>,
  ) {}

  list(organizationId: string) {
    return this.rooms.find({
      where: { organizationId },
      order: { floor: 'ASC', number: 'ASC' },
    });
  }

  async create(organizationId: string, input: RoomInput) {
    const number = (input.number ?? '').trim();
    if (!number) throw new BadRequestException('شماره اتاق لازم است');
    await this.assertUnique(organizationId, number);
    return this.rooms.save(
      this.rooms.create({
        organizationId,
        number: number.slice(0, 20),
        floor: Number.isFinite(Number(input.floor)) ? Number(input.floor) : 0,
        kind: (input.kind ?? '').slice(0, 60),
        assets: input.assets ?? [],
        isActive: input.isActive ?? true,
      }),
    );
  }

  async update(organizationId: string, id: string, input: RoomInput) {
    const room = await this.assertRoom(organizationId, id);
    if (input.number !== undefined) {
      const number = input.number.trim();
      if (!number) throw new BadRequestException('شماره اتاق لازم است');
      if (number !== room.number) {
        await this.assertUnique(organizationId, number);
      }
      room.number = number.slice(0, 20);
    }
    if (input.floor !== undefined) room.floor = Number(input.floor) || 0;
    if (input.kind !== undefined) room.kind = input.kind.slice(0, 60);
    if (input.assets !== undefined) room.assets = input.assets;
    if (input.isActive !== undefined) room.isActive = input.isActive;
    return this.rooms.save(room);
  }

  async remove(organizationId: string, id: string) {
    await this.assertRoom(organizationId, id);
    await this.rooms.delete({ id });
    return { ok: true };
  }

  /**
   * ساختِ گروهیِ اتاق‌ها برای یک هتل.
   *
   * اتاق‌هایی که شماره‌شان از قبل هست رد می‌شوند (نه خطا)، تا بشود این را
   * چند بار و با تنظیمِ متفاوت اجرا کرد بدون شکستن روی تکرار.
   */
  async bulkCreate(organizationId: string, input: BulkInput) {
    const floors = Math.max(1, Math.min(100, Math.floor(input.floors)));
    const perFloor = Math.max(1, Math.min(200, Math.floor(input.roomsPerFloor)));
    const base = input.numberingBase ?? 100;
    const startFloor = input.startFloor ?? 1;

    const existing = new Set(
      (await this.rooms.find({ where: { organizationId }, select: { number: true } })).map(
        (r) => r.number,
      ),
    );

    const toCreate: HotelRoomEntity[] = [];
    for (let f = 0; f < floors; f += 1) {
      const floor = startFloor + f;
      for (let n = 1; n <= perFloor; n += 1) {
        const number = String(floor * base + n);
        if (existing.has(number)) continue;
        existing.add(number);
        toCreate.push(
          this.rooms.create({
            organizationId,
            number,
            floor,
            kind: (input.kind ?? '').slice(0, 60),
            assets: [],
            isActive: true,
          }),
        );
      }
    }

    if (toCreate.length) await this.rooms.save(toCreate);
    return { created: toCreate.length, skipped: floors * perFloor - toCreate.length };
  }

  private async assertUnique(organizationId: string, number: string) {
    const clash = await this.rooms.findOne({
      where: { organizationId, number },
    });
    if (clash) throw new BadRequestException(`اتاق «${number}» از قبل هست`);
  }

  private async assertRoom(organizationId: string, id: string) {
    const room = await this.rooms.findOne({ where: { id, organizationId } });
    if (!room) throw new NotFoundException('اتاق یافت نشد');
    return room;
  }
}
