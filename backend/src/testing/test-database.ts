import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from '../database/entities';

/**
 * دیتابیس تست در حافظه.
 *
 * چون درایور پیش‌فرض پروژه SQLite است، تست‌ها می‌توانند روی یک دیتابیس
 * واقعی (نه ماک) اجرا شوند: رفتار کوئری، محدودیت‌ها و تراکنش‌ها همان
 * چیزی است که در اجرا رخ می‌دهد، بدون نیاز به هیچ سرویس بیرونی.
 */
export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: ALL_ENTITIES,
    synchronize: true,
    dropSchema: true,
  });

  await dataSource.initialize();
  return dataSource;
}
