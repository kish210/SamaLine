import { Logger } from '@nestjs/common';
import { decryptSecret } from '../common/secret-box';
import {
  ColdRoomSensorEntity,
  SensorConnectorKind,
} from '../database/entities/cold-room-sensor.entity';

export interface SensorReadResult {
  value: number;
  unit: 'C' | 'F';
  observedAt: Date;
  /** داده‌ی آزمایشی (شبیه‌ساز)؟ هرگز با داده‌ی واقعی اشتباه نشود. */
  isSimulated: boolean;
}

/**
 * قرارداد اتصال سنسور — ماژولار تا بعداً بتوان connector واقعی (برای پروتکلِ
 * اثبات‌شده‌ی سخت‌افزار) اضافه کرد بدون تغییر منطق هشدار/تاریخچه.
 *
 * عمداً فقط سه پیاده‌سازی: HTTP (عمومی و واقعی)، manual (ثبت دستی اپراتور، بدون
 * خواندن خودکار)، و simulated (داده‌ی آزمایشیِ توسعه). MQTT/Modbus/وندور تا
 * رسیدن مشخصات واقعی سخت‌افزار اضافه نمی‌شود.
 */
export interface SensorConnector {
  read(sensor: ColdRoomSensorEntity): Promise<SensorReadResult | null>;
}

/** داده‌ی آزمایشی؛ هر قرائت صریحاً isSimulated=true است. */
export class SimulatedConnector implements SensorConnector {
  async read(sensor: ColdRoomSensorEntity): Promise<SensorReadResult> {
    const cfg = sensor.connectorConfig ?? {};
    const center = typeof cfg.center === 'number' ? cfg.center : -18;
    const noise = (Math.random() - 0.5) * 2; // ±۱ درجه
    return {
      value: Math.round((center + noise) * 10) / 10,
      unit: sensor.unit,
      observedAt: new Date(),
      isSimulated: true,
    };
  }
}

/**
 * خواندن از یک نقطه‌ی HTTP سازگار که JSON می‌دهد.
 *
 * `connectorConfig`: { url, valuePath?, header?, token? }. token در صورت وجود
 * رمزشده است و فقط اینجا باز می‌شود.
 */
export class HttpConnector implements SensorConnector {
  private readonly logger = new Logger(HttpConnector.name);

  async read(sensor: ColdRoomSensorEntity): Promise<SensorReadResult | null> {
    const cfg = sensor.connectorConfig ?? {};
    const url = typeof cfg.url === 'string' ? cfg.url : '';
    if (!url) return null;

    const headers: Record<string, string> = {};
    if (typeof cfg.header === 'string' && typeof cfg.token === 'string' && cfg.token) {
      headers[cfg.header] = decryptSecret(cfg.token);
    }

    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        this.logger.warn(`سنسور ${sensor.id}: پاسخ ${res.status}`);
        return null;
      }
      const payload = (await res.json()) as Record<string, unknown>;
      const path = typeof cfg.valuePath === 'string' ? cfg.valuePath : 'value';
      const raw = readPath(payload, path);
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        this.logger.warn(`سنسور ${sensor.id}: مقدار نامعتبر در مسیر «${path}»`);
        return null;
      }
      return { value, unit: sensor.unit, observedAt: new Date(), isSimulated: false };
    } catch (error) {
      this.logger.warn(`سنسور ${sensor.id}: خطای اتصال — ${(error as Error).message}`);
      return null;
    }
  }
}

/** اتصال دستی: خواندن خودکار ندارد؛ قرائت از اندپوینت ثبت دستی می‌آید. */
export class ManualConnector implements SensorConnector {
  async read(): Promise<null> {
    return null;
  }
}

export function connectorFor(kind: SensorConnectorKind): SensorConnector {
  switch (kind) {
    case SensorConnectorKind.HTTP:
      return new HttpConnector();
    case SensorConnectorKind.MANUAL:
      return new ManualConnector();
    case SensorConnectorKind.SIMULATED:
    default:
      return new SimulatedConnector();
  }
}

/** خواندن مقدار از مسیر نقطه‌ای مثل "data.temp". */
function readPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}
