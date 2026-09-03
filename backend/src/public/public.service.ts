import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { LogicEngineService } from '../forms/logic-engine.service';
import { ScoreEngineService } from '../forms/score-engine.service';
import { PlanService } from '../plans/plan.service';
import { SaveProgressDto, SubmitResponseDto } from './dto';

type PublicFormPayload = {
  publicationId: string;
  formId: string;
  organizationId: string;
  formTitle: string;
  formVersionId: string;
  structure: Record<string, unknown>;
  settings: Record<string, unknown>;
};

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    @InjectRepository(FormVersionEntity)
    private readonly versionRepo: Repository<FormVersionEntity>,
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(AnswerFlatEntity)
    private readonly answerFlatRepo: Repository<AnswerFlatEntity>,
    private readonly planService: PlanService,
    private readonly scoreEngine: ScoreEngineService,
    private readonly logicEngine: LogicEngineService,
  ) {}

  async getByToken(token: string): Promise<PublicFormPayload> {
    const publication = await this.publicationRepo.findOne({
      where: { token },
      relations: { form: { workspace: true } },
    });

    if (!publication || !publication.isActive)
      throw new NotFoundException('لینک معتبر نیست');

    if (publication.expiresAt && publication.expiresAt < new Date()) {
      throw new BadRequestException('مهلت پاسخگویی این لینک تمام شده است');
    }

    const latestVersion = await this.versionRepo.findOne({
      where: { formId: publication.formId },
      order: { version: 'DESC' },
    });

    if (!latestVersion) throw new NotFoundException('نسخه فرم یافت نشد');

    return {
      publicationId: publication.id,
      formId: publication.formId,
      organizationId: publication.form.workspace.organizationId,
      formTitle: publication.form.title,
      formVersionId: latestVersion.id,
      structure: latestVersion.structure,
      settings: publication.form.settings,
    };
  }

  async getProgressByToken(token: string, respondentKey: string) {
    const formData = await this.getByToken(token);
    const response = await this.responseRepo.findOne({
      where: {
        publicationId: formData.publicationId,
        respondentKey,
        status: ResponseStatus.PARTIAL,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      respondentKey,
      answers: response?.answers ?? {},
      meta: response?.meta ?? {},
      exists: Boolean(response),
    };
  }

  async saveProgressByToken(token: string, dto: SaveProgressDto) {
    const formData = await this.getByToken(token);
    const respondentKey = this.resolveRespondentKey(
      dto.respondentKey,
      dto.meta,
    );

    if (!respondentKey) {
      throw new BadRequestException(
        'برای ذخیره پیشرفت، respondentKey لازم است',
      );
    }

    const existing = await this.responseRepo.findOne({
      where: {
        publicationId: formData.publicationId,
        respondentKey,
        status: ResponseStatus.PARTIAL,
      },
      order: { createdAt: 'DESC' },
    });

    const progress = existing
      ? Object.assign(existing, {
          answers: dto.answers,
          meta: dto.meta ?? existing.meta,
        })
      : this.responseRepo.create({
          formVersionId: formData.formVersionId,
          publicationId: formData.publicationId,
          respondentKey,
          status: ResponseStatus.PARTIAL,
          startedAt: new Date(),
          submittedAt: null,
          durationSeconds: null,
          meta: dto.meta ?? {},
          answers: dto.answers,
          scores: {},
        });

    const saved = await this.responseRepo.save(progress);
    return { id: saved.id, status: saved.status };
  }

  async submitByToken(token: string, dto: SubmitResponseDto) {
    const formData = await this.getByToken(token);
    const respondentKey = this.resolveRespondentKey(
      dto.respondentKey,
      dto.meta,
    );

    await this.ensureNotDuplicate(
      formData.publicationId,
      formData.settings,
      respondentKey,
    );

    const startedAt = new Date();
    const submittedAt = new Date();
    const structure = formData.structure as Record<string, unknown>;
    const scores = this.scoreEngine.calculate(
      structure,
      dto.answers as Record<string, unknown>,
    );

    let response: ResponseEntity | null = null;
    if (respondentKey) {
      response = await this.responseRepo.findOne({
        where: {
          publicationId: formData.publicationId,
          respondentKey,
          status: ResponseStatus.PARTIAL,
        },
        order: { createdAt: 'DESC' },
      });
    }

    if (response) {
      response.status = ResponseStatus.COMPLETED;
      response.submittedAt = submittedAt;
      response.durationSeconds = Math.max(
        0,
        Math.floor(
          (submittedAt.getTime() - response.startedAt.getTime()) / 1000,
        ),
      );
      response.answers = dto.answers;
      response.meta = dto.meta ?? response.meta;
      response.respondentKey = respondentKey ?? response.respondentKey;
      response.scores = scores;
      response = await this.responseRepo.save(response);
    } else {
      response = await this.responseRepo.save(
        this.responseRepo.create({
          formVersionId: formData.formVersionId,
          publicationId: formData.publicationId,
          respondentKey: respondentKey ?? null,
          status: ResponseStatus.COMPLETED,
          startedAt,
          submittedAt,
          durationSeconds: 0,
          meta: dto.meta ?? {},
          answers: dto.answers,
          scores,
        }),
      );
    }

    await this.answerFlatRepo.delete({ responseId: response.id });
    const rows = this.mapAnswersToFlatRows(response.id, dto.answers);
    if (rows.length) {
      await this.answerFlatRepo.save(rows);
    }

    await this.planService.trackUsage(
      formData.organizationId,
      'response_submitted',
      1,
    );

    return { id: response.id, status: 'completed', scores };
  }

  private mapAnswersToFlatRows(
    responseId: string,
    answers: Record<string, unknown>,
  ) {
    return Object.entries(answers).flatMap(([questionId, value]) => {
      if (Array.isArray(value)) {
        return value.map((item) =>
          this.answerFlatRepo.create({
            responseId,
            questionId,
            valueText: typeof item === 'string' ? item : JSON.stringify(item),
            valueNumber: typeof item === 'number' ? item : null,
            choiceId: typeof item === 'string' ? item : null,
          }),
        );
      }

      if (typeof value === 'object' && value !== null) {
        return [
          this.answerFlatRepo.create({
            responseId,
            questionId,
            valueText: JSON.stringify(value),
            valueNumber: null,
            choiceId: null,
          }),
        ];
      }

      return [
        this.answerFlatRepo.create({
          responseId,
          questionId,
          valueText: typeof value === 'string' ? value : JSON.stringify(value),
          valueNumber: typeof value === 'number' ? value : null,
          choiceId: typeof value === 'string' ? value : null,
        }),
      ];
    });
  }

  private resolveRespondentKey(
    respondentKey?: string,
    meta?: Record<string, unknown>,
  ): string | null {
    const metaKey = meta?.respondentKey;
    if (typeof respondentKey === 'string' && respondentKey.trim()) {
      return respondentKey.trim();
    }
    if (typeof metaKey === 'string' && metaKey.trim()) {
      return metaKey.trim();
    }
    return null;
  }

  private async ensureNotDuplicate(
    publicationId: string,
    settings: Record<string, unknown>,
    respondentKey: string | null,
  ) {
    const preventDuplicate = Boolean(settings.preventDuplicate);
    if (!preventDuplicate || !respondentKey) return;

    const existing = await this.responseRepo.findOne({
      where: {
        publicationId,
        respondentKey,
        status: ResponseStatus.COMPLETED,
      },
    });

    if (existing) {
      throw new BadRequestException('پاسخ تکراری مجاز نیست');
    }
  }

  applyPipingText(
    text: string,
    answers: Record<string, unknown>,
    params: Record<string, unknown>,
  ) {
    return this.logicEngine.applyPiping(text, answers, params);
  }
}
