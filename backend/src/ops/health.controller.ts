import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

/**
 * بررسی سلامت — بدون احراز هویت.
 *
 * برای اسکریپت استقرار، پایشگر بیرونی (Uptime Kuma و مانند آن) و
 * reverse-proxy. فقط «زنده‌ام و دیتابیس جواب می‌دهد» را می‌گوید و هیچ
 * داده‌ای از سازمان‌ها بیرون نمی‌دهد.
 */
@ApiTags('ops')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
    return {
      status: 'ok',
      database: 'up',
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
