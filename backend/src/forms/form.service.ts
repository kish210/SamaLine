import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import {
  PublicationAuthMode,
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import { PlanService } from '../plans/plan.service';
import { PHASE1_QUESTION_TYPES } from '../types/form-types';
import {
  CreateFormDto,
  CreatePublicationDto,
  FormQuestionDto,
  UpdateFormDto,
} from './dto';

@Injectable()
export class FormService {
  constructor(
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    @InjectRepository(FormVersionEntity)
    private readonly versionRepo: Repository<FormVersionEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    private readonly planService: PlanService,
  ) {}

  async list(workspaceId: string) {
    return this.formRepo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateFormDto) {
    this.validateQuestions(dto.questions);
    const planCheck = await this.planService.canCreateForm(dto.workspaceId);
    if (!planCheck.allowed) {
      throw new BadRequestException(
        planCheck.reason ?? 'پلن اجازه ساخت فرم جدید نمی‌دهد',
      );
    }

    const form = await this.formRepo.save(
      this.formRepo.create({
        workspaceId: dto.workspaceId,
        title: dto.title,
        slug: dto.slug,
        status: FormStatus.DRAFT,
        settings: dto.settings ?? {
          theme: 'default',
          languages: ['fa'],
          displayMode: 'single',
          preventDuplicate: false,
          saveProgress: true,
        },
      }),
    );

    await this.versionRepo.save(
      this.versionRepo.create({
        formId: form.id,
        version: 1,
        structure: this.buildStructure(
          dto.questions,
          dto.logic,
          dto.scoreConfig,
        ),
      }),
    );

    return this.get(form.id);
  }

  async get(id: string) {
    const form = await this.formRepo.findOne({ where: { id } });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    const latestVersion = await this.versionRepo.findOne({
      where: { formId: id },
      order: { version: 'DESC' },
    });
    const publication = await this.publicationRepo.findOne({
      where: { formId: id, type: PublicationType.LINK },
    });
    return { ...form, latestVersion, publication };
  }

  async update(id: string, dto: UpdateFormDto) {
    const form = await this.formRepo.findOne({ where: { id } });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    form.title = dto.title ?? form.title;
    form.status = dto.status ?? form.status;
    form.settings = dto.settings ?? form.settings;
    await this.formRepo.save(form);

    if (dto.questions) {
      this.validateQuestions(dto.questions);
      const latest = await this.versionRepo.findOne({
        where: { formId: id },
        order: { version: 'DESC' },
      });
      await this.versionRepo.save(
        this.versionRepo.create({
          formId: id,
          version: (latest?.version ?? 0) + 1,
          structure: this.buildStructure(
            dto.questions,
            dto.logic,
            dto.scoreConfig,
          ),
        }),
      );
    }

    return this.get(id);
  }

  async publishLink(formId: string) {
    const form = await this.formRepo.findOne({ where: { id: formId } });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    if (form.status !== FormStatus.ACTIVE) {
      await this.formRepo.update(formId, { status: FormStatus.ACTIVE });
    }

    let publication = await this.publicationRepo.findOne({
      where: { formId, type: PublicationType.LINK },
    });
    if (!publication) {
      publication = await this.publicationRepo.save(
        this.publicationRepo.create({
          formId,
          type: PublicationType.LINK,
          token: randomBytes(16).toString('hex'),
        }),
      );
    }

    return publication;
  }

  async createPublication(formId: string, dto: CreatePublicationDto) {
    const form = await this.formRepo.findOne({ where: { id: formId } });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    const publication = await this.publicationRepo.save(
      this.publicationRepo.create({
        formId,
        type: dto.type,
        authMode: dto.authMode ?? PublicationAuthMode.NONE,
        token: randomBytes(16).toString('hex'),
        tags: dto.tags ?? [],
        config: dto.config ?? {},
        isActive: true,
      }),
    );
    return publication;
  }

  private validateQuestions(questions: FormQuestionDto[]) {
    const invalid = questions.find(
      (q) => !(PHASE1_QUESTION_TYPES as readonly string[]).includes(q.type),
    );
    if (invalid)
      throw new BadRequestException('نوع سوال خارج از محدوده فاز ۱ است');
  }

  private buildStructure(
    questions: FormQuestionDto[],
    logic?: Record<string, unknown>,
    scoreConfig?: Record<string, unknown>,
  ) {
    return {
      pages: [{ id: 'page_1', title: 'صفحه ۱', questions }],
      logic: logic ?? { display: [], skip: [], pipe: [] },
      scoreConfig: scoreConfig ?? { indices: [] },
    };
  }
}
