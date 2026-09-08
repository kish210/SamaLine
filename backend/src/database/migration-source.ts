import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source';

/**
 * DataSource ویژه‌ی ابزار خط فرمان مهاجرت.
 *
 * جدا از `appDataSource` است چون تولید مهاجرت باید `synchronize` را خاموش
 * ببیند تا TypeORM تفاوت اسکیما را واقعا محاسبه کند، نه اینکه خودش جدول‌ها
 * را بسازد.
 */
export default new DataSource(
  buildDataSourceOptions({
    synchronize: false,
    migrations: ['src/database/migrations/*.ts'],
  } as never),
);
