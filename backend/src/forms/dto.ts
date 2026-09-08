import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { FormStatus } from '../database/entities/form.entity';
import {
  PublicationAuthMode,
  PublicationType,
} from '../database/entities/publication.entity';
import { ALL_QUESTION_TYPES } from '../types/form-types';

export class FormQuestionDto {
  @IsString()
  id: string;

  @IsIn(ALL_QUESTION_TYPES)
  type: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  options?: string[];

  /** گزینه‌ها با وزن، برای امتیازدهی (بند ۶ سند). */
  @IsOptional()
  @IsArray()
  choices?: Array<{
    id: string;
    label?: string;
    weight?: number;
    hidden?: boolean;
  }>;

  /** وزن پیش‌فرض سوال در محاسبه‌ی شاخص. */
  @IsOptional()
  @IsNumber()
  weight?: number;

  /** اتصال سوال به یک شاخص امتیازدهی. */
  @IsOptional()
  @IsObject()
  scoring?: { indexId?: string; weight?: number };

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class FormPageDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormQuestionDto)
  questions: FormQuestionDto[];
}

export class CreateFormDto {
  @IsNotEmpty()
  workspaceId: string;

  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  slug: string;

  /**
   * ساخت از روی یک قالب آماده.
   *
   * محتوای قالب سمت سرور باز می‌شود نه سمت پنل، تا کسی نتواند با دستکاری
   * درخواست، ساختاری بفرستد که از اعتبارسنجی قالب‌ها رد نشده است.
   */
  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  logic?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  scoreConfig?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormPageDto)
  pages?: FormPageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormQuestionDto)
  questions?: FormQuestionDto[];
}

export class UpdateFormDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn([
    FormStatus.DRAFT,
    FormStatus.ACTIVE,
    FormStatus.CLOSED,
    FormStatus.ARCHIVED,
  ])
  status?: FormStatus;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormQuestionDto)
  questions?: FormQuestionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormPageDto)
  pages?: FormPageDto[];

  @IsOptional()
  @IsObject()
  logic?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  scoreConfig?: Record<string, unknown>;
}

export class CreatePublicationDto {
  @IsIn(Object.values(PublicationType))
  type: PublicationType;

  @IsOptional()
  @IsIn(Object.values(PublicationAuthMode))
  authMode?: PublicationAuthMode;

  @IsOptional()
  @IsArray()
  tags?: string[];

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class SetSlugDto {
  /** نشانی اختصاصی فرم؛ فقط حروف کوچک انگلیسی، رقم و خط تیره. */
  @IsNotEmpty()
  @IsString()
  slug: string;
}

export class SetAuthModeDto {
  @IsIn(Object.values(PublicationAuthMode))
  authMode: PublicationAuthMode;

  /** فقط برای حالت رمز عبور؛ هش‌شده ذخیره می‌شود. */
  @IsOptional()
  @IsString()
  password?: string;
}

/** بایگانی یا بازگرداندن فرم. */
export class SetArchivedDto {
  @IsBoolean()
  archived: boolean;
}
