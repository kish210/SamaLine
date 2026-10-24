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
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import {
  ColdRoomSensorEntity,
  SensorConnectorKind,
} from '../database/entities/cold-room-sensor.entity';
import { SensorsService } from './sensors.service';

class SensorDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsIn(['C', 'F']) unit?: 'C' | 'F';
  @IsOptional() @IsNumber() minThreshold?: number | null;
  @IsOptional() @IsNumber() maxThreshold?: number | null;
  @IsOptional() @IsInt() @Min(60) @Max(86400) staleAfterSeconds?: number;
  @IsOptional() @IsEnum(SensorConnectorKind) connector?: SensorConnectorKind;
  @IsOptional() @IsObject() connectorConfig?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class ManualReadingDto {
  @IsNumber() value: number;
}

/**
 * سنسورهای دمای سردخانه. گارد پیش‌فرض امن: خواندن برای همه‌ی اعضا، تغییر
 * دست‌کم «ویرایشگر». token اتصال هرگز در خروجی برنمی‌گردد.
 */
@Controller('sensors')
@UseGuards(JwtAuthGuard)
export class SensorsController {
  constructor(private readonly service: SensorsService) {}

  @Get()
  async list(@Query('workspaceId') workspaceId: string, @CurrentUser() user: JwtUser) {
    await this.service.assertAccess(workspaceId, user);
    return (await this.service.list(workspaceId)).map(safeSensor);
  }

  @Post()
  async create(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: SensorDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return safeSensor(await this.service.create(workspaceId, dto));
  }

  @Patch(':id')
  async update(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: SensorDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return safeSensor(await this.service.update(workspaceId, id, dto));
  }

  @Delete(':id')
  async remove(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.remove(workspaceId, id);
  }

  @Get(':id/readings')
  async readings(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Query('limit') limit?: string,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.readingsFor(workspaceId, id, limit ? Number(limit) : 200);
  }

  @Post(':id/readings')
  async submitReading(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: ManualReadingDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return safeSensor(await this.service.submitManualReading(workspaceId, id, dto.value));
  }

  @Get('alerts/list')
  async alerts(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
    @Query('includeAcknowledged') includeAcknowledged?: string,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.listAlerts(workspaceId, {
      includeAcknowledged: includeAcknowledged === 'true',
    });
  }

  @Post('alerts/:alertId/ack')
  async ack(
    @Query('workspaceId') workspaceId: string,
    @Param('alertId') alertId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.service.assertAccess(workspaceId, user);
    return this.service.acknowledgeAlert(workspaceId, alertId, user);
  }
}

/** token اتصال هرگز (حتی رمزشده) از API بیرون نمی‌رود؛ فقط «تنظیم‌شده/نه». */
function safeSensor(sensor: ColdRoomSensorEntity | null) {
  if (!sensor) return sensor;
  const cfg = (sensor.connectorConfig ?? {}) as Record<string, unknown>;
  const { token, ...rest } = cfg;
  return {
    ...sensor,
    connectorConfig: { ...rest, tokenSet: typeof token === 'string' && token.length > 0 },
  };
}
