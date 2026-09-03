import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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
