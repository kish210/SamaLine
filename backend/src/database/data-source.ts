import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { IS_SQLITE } from './column-types';
import { ALL_ENTITIES } from './entities';
import { Baseline1788846783305 } from './migrations/1788846783305-Baseline';
import { AddPortal1788865235241 } from './migrations/1788865235241-AddPortal';
import { PgBaseline1788878200721 } from './migrations/1788878200721-PgBaseline';
import { AddTotp1790656139923 } from './migrations/1790656139923-AddTotp';
import { PgAddTotp1790656139924 } from './migrations/1790656139924-PgAddTotp';
import { AddPasswordReset1791318984285 } from './migrations/1791318984285-AddPasswordReset';
import { PgAddPasswordReset1791318984286 } from './migrations/1791318984286-PgAddPasswordReset';
import { AddInvitations1791319534731 } from './migrations/1791319534731-AddInvitations';
import { AddApiKeyRole1791319534733 } from './migrations/1791319534733-AddApiKeyRole';
import { AddMenus1792100000000 } from './migrations/1792100000000-AddMenus';
import { PgAddInvitations1791319534732 } from './migrations/1791319534732-PgAddInvitations';
import { PgAddApiKeyRole1791319534734 } from './migrations/1791319534734-PgAddApiKeyRole';
import { PgAddMenus1792100000001 } from './migrations/1792100000001-PgAddMenus';
import { AddPlatformAiAndRegistration1792000000000 } from './migrations/1792000000000-AddPlatformAiAndRegistration';
import { PgAddPlatformAiAndRegistration1792000000001 } from './migrations/1792000000001-PgAddPlatformAiAndRegistration';
import { AddChatPlatform1793000000000 } from './migrations/1793000000000-AddChatPlatform';
import { PgAddChatPlatform1793000000001 } from './migrations/1793000000001-PgAddChatPlatform';
import { AddEmailReports1793000000002 } from './migrations/1793000000002-AddEmailReports';
import { PgAddEmailReports1793000000003 } from './migrations/1793000000003-PgAddEmailReports';
import { AddMaintenance1794000000000 } from './migrations/1794000000000-AddMaintenance';
import { PgAddMaintenance1794000000001 } from './migrations/1794000000001-PgAddMaintenance';
import { AddColdRoomSensors1795000000000 } from './migrations/1795000000000-AddColdRoomSensors';
import { PgAddColdRoomSensors1795000000001 } from './migrations/1795000000001-PgAddColdRoomSensors';
import { DropHotelOpsModules1796000000000 } from './migrations/1796000000000-DropHotelOpsModules';
import { PgDropHotelOpsModules1796000000001 } from './migrations/1796000000001-PgDropHotelOpsModules';
import { AddDepartments1797000000000 } from './migrations/1797000000000-AddDepartments';
import { PgAddDepartments1797000000001 } from './migrations/1797000000001-PgAddDepartments';
import { AddStaffAuthMode1798000000000 } from './migrations/1798000000000-AddStaffAuthMode';
import { PgAddStaffAuthMode1798000000001 } from './migrations/1798000000001-PgAddStaffAuthMode';
import { AddDepartmentScope1799000000000 } from './migrations/1799000000000-AddDepartmentScope';
import { PgAddDepartmentScope1799000000001 } from './migrations/1799000000001-PgAddDepartmentScope';
import { AddHotelRooms1800000000000 } from './migrations/1800000000000-AddHotelRooms';
import { PgAddHotelRooms1800000000001 } from './migrations/1800000000001-PgAddHotelRooms';
import { AddPersonnel1800000000002 } from './migrations/1800000000002-AddPersonnel';
import { PgAddPersonnel1800000000003 } from './migrations/1800000000003-PgAddPersonnel';
import { AddPersonnelBotLink1800000000004 } from './migrations/1800000000004-AddPersonnelBotLink';
import { PgAddPersonnelBotLink1800000000005 } from './migrations/1800000000005-PgAddPersonnelBotLink';

/**
 * مهاجرت‌ها به‌صورت کلاس وارد می‌شوند نه با الگوی مسیر.
 *
 * الگوی مسیر پس از build باید به `dist` اشاره کند و در توسعه به `src`؛
 * همین دوگانگی جایی از قلم می‌افتد و مهاجرت بی‌صدا اجرا نمی‌شود. وارد کردن
 * مستقیم، این خطا را غیرممکن می‌کند.
 *
 * هر گویش فهرست خودش را دارد: SQL تولیدشده برای SQLite روی Postgres خطای
 * نحوی می‌دهد و برعکس. یک فهرست مشترک یعنی یکی از دو گویش همیشه خراب است.
 */
export const SQLITE_MIGRATIONS = [
  Baseline1788846783305,
  AddPortal1788865235241,
  AddTotp1790656139923,
  AddPasswordReset1791318984285,
  AddInvitations1791319534731,
  AddApiKeyRole1791319534733,
  AddMenus1792100000000,
  AddPlatformAiAndRegistration1792000000000,
  AddChatPlatform1793000000000,
  AddEmailReports1793000000002,
  AddMaintenance1794000000000,
  AddColdRoomSensors1795000000000,
  DropHotelOpsModules1796000000000,
  AddDepartments1797000000000,
  AddStaffAuthMode1798000000000,
  AddDepartmentScope1799000000000,
  AddHotelRooms1800000000000,
  AddPersonnel1800000000002,
  AddPersonnelBotLink1800000000004,
];
export const POSTGRES_MIGRATIONS = [
  PgBaseline1788878200721,
  PgAddTotp1790656139924,
  PgAddPasswordReset1791318984286,
  PgAddInvitations1791319534732,
  PgAddApiKeyRole1791319534734,
  PgAddMenus1792100000001,
  PgAddPlatformAiAndRegistration1792000000001,
  PgAddChatPlatform1793000000001,
  PgAddEmailReports1793000000003,
  PgAddMaintenance1794000000001,
  PgAddColdRoomSensors1795000000001,
  PgDropHotelOpsModules1796000000001,
  PgAddDepartments1797000000001,
  PgAddStaffAuthMode1798000000001,
  PgAddDepartmentScope1799000000001,
  PgAddHotelRooms1800000000001,
  PgAddPersonnel1800000000003,
  PgAddPersonnelBotLink1800000000005,
];

/** مسیر فایل دیتابیس SQLite؛ نسبی‌ها از ریشه‌ی backend حساب می‌شوند. */
export function sqliteDatabasePath(): string {
  const raw = process.env.SQLITE_PATH ?? 'data/samaline.sqlite';
  const abs = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
  const dir = dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return abs;
}

export function buildDataSourceOptions(
  overrides: Partial<DataSourceOptions> = {},
): DataSourceOptions {
  const base: DataSourceOptions = IS_SQLITE
    ? {
        type: 'better-sqlite3',
        database: sqliteDatabasePath(),
        entities: ALL_ENTITIES,
        migrations: SQLITE_MIGRATIONS,
        /*
         * اسکیما با مهاجرت ساخته می‌شود، نه synchronize.
         *
         * synchronize روی SQLite برای تغییر ستون، جدول را بازمی‌سازد (کپی
         * به جدول موقت، حذف، تغییر نام) و این کار بی‌صدا انجام می‌شد؛ در
         * محیط واقعی یعنی هر تغییر ساختار یک ریسک از دست رفتن داده.
         * مهاجرت‌ها صریح‌اند، یک‌بار اجرا می‌شوند و ثبت می‌شوند.
         */
        synchronize: false,
        migrationsRun: false,
      }
    : {
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: ALL_ENTITIES,
        migrations: POSTGRES_MIGRATIONS,
        synchronize: false,
        migrationsRun: false,
      };

  return { ...base, ...overrides } as DataSourceOptions;
}

/** DataSource مستقل برای اسکریپت‌های CLI (seed، migration، ابزارهای نگهداری). */
export const appDataSource = new DataSource(buildDataSourceOptions());
