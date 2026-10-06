import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { OrganizationEntity } from '../database/entities/organization.entity';
import {
  OrganizationRole,
  OrganizationUserEntity,
} from '../database/entities/organization-user.entity';
import { PlanCode } from '../database/entities/plan-policy.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UserEntity } from '../database/entities/user.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { AttemptLimiter } from '../common/attempt-limiter';
import { LoginDto, RegisterDto } from './dto';
import { TwoFactorService } from './two-factor.service';

@Injectable()
export class AuthService {
  /*
   * جلوگیری از حدس زدن رمز: ۱۰ رمز اشتباه برای یک حساب در ۱۵ دقیقه،
   * آن حساب را ۱۵ دقیقه قفل می‌کند. پیش از این ورود هیچ سقفی نداشت.
   */
  private readonly loginLimiter = new AttemptLimiter(
    10,
    15 * 60_000,
    15 * 60_000,
  );

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
    private readonly twoFactor: TwoFactorService,
  ) {}

  async register(dto: RegisterDto) {
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
    const email = dto.email.toLowerCase();
    if (this.loginLimiter.isLocked(email)) {
      throw new HttpException(
        'تلاش ناموفق زیاد بود؛ ۱۵ دقیقه‌ی دیگر دوباره امتحان کنید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      this.loginLimiter.fail(email);
      throw new UnauthorizedException('اطلاعات ورود نامعتبر است');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      this.loginLimiter.fail(email);
      throw new UnauthorizedException('اطلاعات ورود نامعتبر است');
    }
    this.loginLimiter.succeed(email);

    /*
     * ورود دومرحله‌ای: رمز درست است ولی بدون کد برنامه‌ی احراز هویت توکنی
     * صادر نمی‌شود. پاسخ بدون کد فقط می‌گوید «کد لازم است» تا پنل فیلد کد
     * را نشان دهد؛ چیزی درباره‌ی حساب لو نمی‌دهد که رمز درست آن را نداده باشد.
     */
    if (user.totpEnabled) {
      if (!dto.totpCode) return { twoFactorRequired: true as const };
      await this.twoFactor.verifyLogin(user.id, dto.totpCode);
    }

    return this.sessionFor(user);
  }

  /**
   * نشست تازه برای کاربر (توکن + اطلاعات حساب).
   *
   * پس از تغییر رمز هم صدا زده می‌شود تا همان دستگاهی که رمز را عوض کرده
   * وارد بماند، در حالی که توکن‌های قبلی همه باطل شده‌اند.
   */
  async sessionFor(user: UserEntity) {
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
