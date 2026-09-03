import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ResponseEntity, ResponseStatus } from '../database/entities/response.entity';
import { SubmitResponseDto } from './dto';

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(PublicationEntity) private readonly publicationRepo: Repository<PublicationEntity>,
    @InjectRepository(FormVersionEntity) private readonly versionRepo: Repository<FormVersionEntity>,
    @InjectRepository(ResponseEntity) private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(AnswerFlatEntity) private readonly answerFlatRepo: Repository<AnswerFlatEntity>,
  ) {}

  async getByToken(token: string) {
    const publication = await this.publicationRepo.findOne({ where: { token }, relations: { form: true } });
    if (!publication || !publication.isActive) throw new NotFoundException('لینک معتبر نیست');

    const latestVersion = await this.versionRepo.findOne({
      where: { formId: publication.formId },
      order: { version: 'DESC' },
    });
    if (!latestVersion) throw new NotFoundException('نسخه فرم یافت نشد');

    return {
      publicationId: publication.id,
      formId: publication.formId,
      formTitle: publication.form.title,
      formVersionId: latestVersion.id,
      structure: latestVersion.structure,
      settings: publication.form.settings,
    };
  }

  async submitByToken(token: string, dto: SubmitResponseDto) {
    const formData = await this.getByToken(token);
    const startedAt = new Date();
    const submittedAt = new Date();

    const response = await this.responseRepo.save(
      this.responseRepo.create({
        formVersionId: formData.formVersionId,
        publicationId: formData.publicationId,
        status: ResponseStatus.COMPLETED,
        startedAt,
        submittedAt,
        durationSeconds: 0,
        meta: dto.meta ?? {},
        answers: dto.answers,
        scores: {},
      }),
    );

    const rows = Object.entries(dto.answers).flatMap(([questionId, value]) => {
      if (Array.isArray(value)) {
        return value.map((item) =>
          this.answerFlatRepo.create({
            responseId: response.id,
            questionId,
            valueText: typeof item === 'string' ? item : JSON.stringify(item),
            valueNumber: typeof item === 'number' ? item : null,
            choiceId: typeof item === 'string' ? item : null,
          }),
        );
      }
      return [
        this.answerFlatRepo.create({
          responseId: response.id,
          questionId,
          valueText: typeof value === 'string' ? value : JSON.stringify(value),
          valueNumber: typeof value === 'number' ? value : null,
          choiceId: typeof value === 'string' ? value : null,
        }),
      ];
    });

    if (rows.length) {
      await this.answerFlatRepo.save(rows);
    }

    return { id: response.id, status: 'completed' };
  }
}
