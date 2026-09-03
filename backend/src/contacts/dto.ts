import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsIn,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateContactListDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class ContactInputDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  tags?: string[];
}

export class AddContactsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ContactInputDto)
  contacts: ContactInputDto[];
}

export class ImportCsvDto {
  /** محتوای CSV: هر خط «نام,موبایل,ایمیل». */
  @IsNotEmpty()
  @IsString()
  csv: string;
}

export class ListContactsQueryDto {
  @IsOptional()
  @IsBoolean()
  includeUnsubscribed?: boolean;
}

export class CreateContactSourceDto {
  /** فهرستی که رکوردهای واردشده در آن می‌نشینند. */
  @IsNotEmpty()
  @IsString()
  listId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  /** نشانی API سرویس بیرونی (CRM، سامانه منابع انسانی و …). */
  @IsNotEmpty()
  @IsString()
  url: string;

  @IsOptional()
  @IsIn(['GET', 'POST', 'get', 'post'])
  method?: string;

  /** هدرهای احراز هویت، مثل { "authorization": "Bearer ..." } */
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;

  /** مسیر آرایه‌ی افراد در پاسخ، مثل `data.items`. */
  @IsOptional()
  @IsString()
  itemsPath?: string;

  /** نگاشت فیلدها: { "fullName": "name", "mobile": "phone" } */
  @IsObject()
  mapping: Record<string, string>;
}
