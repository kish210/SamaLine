import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AssetCriticality,
  AssetStatus,
} from '../database/entities/asset.entity';
import {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceRequestStatus,
} from '../database/entities/maintenance-request.entity';
import { WorkOrderStatus } from '../database/entities/work-order.entity';
import { PmInterval } from '../database/entities/pm-schedule.entity';
import { RoomReadiness } from '../database/entities/hotel-room.entity';
import { StockMovementType } from '../database/entities/spare-part.entity';

export class AssetDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  code: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(120) manufacturer?: string;
  @IsOptional() @IsString() @MaxLength(120) model?: string;
  @IsOptional() @IsString() @MaxLength(120) serialNumber?: string;
  @IsOptional() @IsString() @MaxLength(160) location?: string;
  @IsOptional() @IsString() @MaxLength(80) building?: string;
  @IsOptional() @IsString() @MaxLength(40) floor?: string;
  @IsOptional() @IsString() roomId?: string | null;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsString() parentId?: string | null;
  @IsOptional() @IsString() @MaxLength(10) installedAt?: string;
  @IsOptional() @IsString() @MaxLength(10) warrantyUntil?: string;

  @IsOptional()
  @IsIn(Object.values(AssetCriticality))
  criticality?: AssetCriticality;

  @IsOptional()
  @IsIn(Object.values(AssetStatus))
  status?: AssetStatus;

  @IsOptional() @IsArray() documents?: Array<Record<string, unknown>>;
  @IsOptional() @IsString() notes?: string;
}

export class MaintenanceRequestDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsString() roomId?: string | null;
  @IsOptional() @IsString() assetId?: string | null;
  @IsOptional() @IsString() @MaxLength(160) location?: string;

  @IsOptional()
  @IsIn(Object.values(MaintenanceCategory))
  category?: MaintenanceCategory;

  @IsOptional()
  @IsIn(Object.values(MaintenancePriority))
  priority?: MaintenancePriority;

  @IsOptional() @IsArray() attachments?: Array<Record<string, unknown>>;
  @IsOptional() @IsString() @MaxLength(200) operationalImpact?: string;
  @IsOptional() @IsBoolean() guestRelated?: boolean;
  @IsOptional() @IsString() @MaxLength(10) dueDate?: string;
}

export class RequestStatusDto {
  @IsIn(Object.values(MaintenanceRequestStatus))
  status: MaintenanceRequestStatus;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class WorkOrderDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional() @IsString() requestId?: string | null;
  @IsOptional() @IsString() assetId?: string | null;
  @IsOptional() @IsString() roomId?: string | null;
  @IsOptional() @IsString() departmentId?: string | null;

  @IsOptional()
  @IsIn(Object.values(MaintenanceCategory))
  category?: MaintenanceCategory;

  @IsOptional()
  @IsIn(Object.values(MaintenancePriority))
  priority?: MaintenancePriority;

  @IsOptional() @IsString() diagnosis?: string;
  @IsOptional() @IsString() rootCause?: string;
  @IsOptional() @IsString() workDescription?: string;
  @IsOptional() @IsString() workPerformed?: string;
  @IsOptional() @IsString() technicianNotes?: string;
  @IsOptional() @IsArray() parts?: Array<Record<string, unknown>>;

  @IsOptional() @IsInt() @Min(0) laborMinutes?: number;
  @IsOptional() @IsInt() @Min(0) internalCost?: number;
  @IsOptional() @IsInt() @Min(0) contractorCost?: number;

  @IsOptional() @IsArray() attachments?: Array<Record<string, unknown>>;
  @IsOptional() @IsArray() checklist?: Array<Record<string, unknown>>;
  @IsOptional() @IsString() @MaxLength(10) dueDate?: string;

  /** پرسنلِ منتسب؛ اولی نفرِ اصلی است. */
  @IsOptional() @IsArray() technicianIds?: string[];
}

export class WorkOrderStatusDto {
  @IsIn(Object.values(WorkOrderStatus))
  status: WorkOrderStatus;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

/** برنامهٔ نگهداریِ پیشگیرانه. */
export class PmScheduleDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional() @IsString() assetId?: string | null;
  @IsOptional() @IsString() roomId?: string | null;
  @IsOptional() @IsString() departmentId?: string | null;

  @IsOptional()
  @IsIn(Object.values(MaintenanceCategory))
  category?: MaintenanceCategory;

  @IsOptional() @IsIn(Object.values(PmInterval)) interval?: PmInterval;

  @IsOptional() @IsInt() @Min(0) intervalDays?: number;

  @IsOptional() @IsArray() checklist?: Array<Record<string, unknown>>;
  @IsOptional() @IsArray() technicianIds?: string[];
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @IsString() @MaxLength(10) nextDueAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** قطعهٔ انبار. */
export class SparePartDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  code: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @IsString() @MaxLength(24) unit?: string;
  @IsOptional() @IsString() @MaxLength(160) location?: string;
  @IsOptional() @IsString() @MaxLength(160) supplier?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional() @IsInt() @Min(0) reorderLevel?: number;
  @IsOptional() @IsInt() @Min(0) unitCost?: number;

  /**
   * موجودیِ ابتدای کار.
   *
   * به‌شکلِ یک «ورود» در دفترِ گردش ثبت می‌شود، نه نوشتنِ مستقیمِ موجودی؛
   * پس دفتر از روزِ اول کامل است.
   */
  @IsOptional() @IsInt() @Min(0) openingQuantity?: number;
}

/** یک گردشِ انبار: ورود، مصرف، برگشت، ضایعات یا اصلاح. */
export class StockMovementDto {
  @IsNotEmpty() @IsString() partId: string;

  @IsIn(Object.values(StockMovementType))
  type: StockMovementType;

  @IsInt() @Min(1) quantity: number;

  @IsOptional() @IsInt() @Min(0) unitCost?: number;
  @IsOptional() @IsString() workOrderId?: string | null;
  @IsOptional() @IsString() personnelId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/** انبارگردانی: شمارشِ واقعیِ قفسه. */
export class RecountDto {
  @IsInt() @Min(0) countedQuantity: number;

  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/** تغییرِ دستیِ وضعیتِ آمادگیِ اتاق. */
export class RoomReadinessDto {
  @IsIn(Object.values(RoomReadiness))
  readiness: RoomReadiness;

  @IsOptional() @IsString() @MaxLength(200) note?: string;
}
