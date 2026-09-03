import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
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
import { PHASE1_QUESTION_TYPES } from '../types/form-types';

export class FormQuestionDto {
  @IsString()
  id: string;

  @IsIn(PHASE1_QUESTION_TYPES)
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

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class CreateFormDto {
  @IsNotEmpty()
  workspaceId: string;

  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  logic?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  scoreConfig?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormQuestionDto)
  questions: FormQuestionDto[];
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
