import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuizGradeDto {
  @IsObject()
  structure: Record<string, unknown>;

  @IsObject()
  answers: Record<string, unknown>;
}

class EvalRoleScoreDto {
  @IsString()
  role: string;

  @IsObject()
  scores: Record<string, number>;
}

export class Evaluate360Dto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvalRoleScoreDto)
  evaluations: EvalRoleScoreDto[];
}

export class ExperienceMetricDto {
  @IsIn(['nps', 'csat', 'ces', 'enps'])
  type: 'nps' | 'csat' | 'ces' | 'enps';

  @IsArray()
  scores: number[];
}

export class TemplateListQueryDto {
  @IsOptional()
  @IsIn(['mbti', 'herzberg', 'cx', 'hr'])
  category?: 'mbti' | 'herzberg' | 'cx' | 'hr';
}
