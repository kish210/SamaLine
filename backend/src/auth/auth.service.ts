import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import { OrganizationEntity } from '../database/entities/organization.entity';
import {
  OrganizationRole,
  OrganizationUserEntity,
} from '../database/entities/organization-user.entity';
import { PlanCode } from '../database/entities/plan-policy.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UserEntity } from '../database/entities/user.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @InjectRepository(OrganizationUserEntity)
    private readonly orgUserRepo: Repository<OrganizationUserEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    private readonly jwt: JwtService,
    private readonly platform: PlatformSettingsService,
  ) {}

  async register(dto: RegisterDto) {
    // ثبت‌نام را سوپرادمین می‌تواند ببندد؛ فقط اولین حساب (bootstrap) مستثناست.
    if (!(await this.platform.isRegistrationOpen())) {
      throw new ForbiddenException('ثبت‌نام در این سامانه غیرفعال است');
    }

    const existing = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new BadRequestException('ایمیل قبلا ثبت شده است');

    const user = await this.userRepo.save(
      this.userRepo.create({
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        passwordHash: await bcrypt.hash(dto.password, 10),
      }),
    );

    const organization = await this.orgRepo.save(
      this.orgRepo.create({ name: dto.organizationName }),
    );
    await this.orgUserRepo.save(
      this.orgUserRepo.create({
        organizationId: organization.id,
        userId: user.id,
        role: OrganizationRole.OWNER,
      }),
    );
    const workspace = await this.workspaceRepo.save(
      this.workspaceRepo.create({
        name: dto.workspaceName,
        organizationId: organization.id,
      }),
    );
    await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        organizationId: organization.id,
        planCode: PlanCode.FREE,
        isActive: true,
      }),
    );

    return this.issueToken(user, organization.id, workspace.id);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException('اطلاعات ورود نامعتبر است');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('اطلاعات ورود نامعتبر است');

    const member = await this.orgUserRepo.findOne({
      where: { userId: user.id },
    });
    const workspace = member
      ? await this.workspaceRepo.findOne({
          where: { organizationId: member.organizationId },
        })
      : null;

    return this.issueToken(user, member?.organizationId, workspace?.id);
  }

  private issueToken(
    user: UserEntity,
    organizationId?: string,
    workspaceId?: string,
  ) {
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      organizationId,
      workspaceId,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        organizationId,
        workspaceId,
      },
    };
  }
}
