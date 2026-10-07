import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { MIN_PASSWORD_LENGTH } from '../auth/password.service';
import { TwoFactorService } from '../auth/two-factor.service';
import { AttemptLimiter } from '../common/attempt-limiter';
import type { JwtUser } from '../common/current-user.decorator';
import { ROLE_LABELS } from '../common/roles';
import { InvitationEntity } from '../database/entities/invitation.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import {
  OrganizationRole,
  OrganizationUserEntity,
} from '../database/entities/organization-user.entity';
import { UserEntity } from '../database/entities/user.entity';
import { MessagingService } from '../messaging/messaging.service';
import { PlanService } from '../plans/plan.service';
import type { AcceptInvitationDto, InviteMemberDto } from './dto';
import { checkRemoval, checkRoleChange, checkSeatLimit } from './team-rules';

/** مدت اعتبار لینک دعوت. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const INVALID_INVITATION = 'لینک دعوت نامعتبر، منقضی یا قبلا استفاده شده است';

/**
 * تیم سازمان: اعضا، نقش‌ها و دعوت‌نامه‌ها.
 *
 * دعوت با لینک یک‌بارمصرف هفت‌روزه انجام می‌شود که هم به ایمیل دعوت‌شده
 * می‌رود و هم به دعوت‌کننده نشان داده می‌شود؛ پس بدون SMTP هم می‌شود لینک
 * را در پیام‌رسان فرستاد. کسی که از قبل حساب دارد با رمز خودش (و کد ورود
 * دومرحله‌ای، اگر روشن است) می‌پذیرد؛ بقیه همان‌جا حساب می‌سازند.
 */
@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);
  /** حدس زدن رمز حساب موجود از راه صفحه‌ی پذیرش هم سقف دارد. */
  private readonly acceptLimiter = new AttemptLimiter(
    10,
    15 * 60_000,
    15 * 60_000,
  );

  constructor(
    @InjectRepository(OrganizationUserEntity)
    private readonly members: Repository<OrganizationUserEntity>,
    @InjectRepository(InvitationEntity)
    private readonly invitations: Repository<InvitationEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
    private readonly plans: PlanService,
    private readonly messaging: MessagingService,
    private readonly auth: AuthService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async listMembers(organizationId: string) {
    const rows = await this.members.find({
      where: { organizationId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((member) => ({
      id: member.id,
      userId: member.userId,
      fullName: member.user?.fullName ?? '',
      email: member.user?.email ?? '',
      role: member.role,
      totpEnabled: Boolean(member.user?.totpEnabled),
      joinedAt: member.createdAt,
    }));
  }

  /** دعوت‌های پذیرفته‌نشده و منقضی‌نشده. */
  listInvitations(organizationId: string) {
    return this.invitations.find({
      where: {
        organizationId,
        acceptedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async changeRole(actor: JwtUser, memberId: string, next: OrganizationRole) {
    const member = await this.findMember(actor.organizationId, memberId);
    const problem = checkRoleChange({
      actor: actor.role ?? OrganizationRole.VIEWER,
      current: member.role,
      next,
      ownerCount: await this.ownerCount(actor.organizationId),
    });
    if (problem) throw new ForbiddenException(problem);
    member.role = next;
    await this.members.save(member);
    return { id: member.id, role: member.role };
  }

  async removeMember(actor: JwtUser, memberId: string) {
    const member = await this.findMember(actor.organizationId, memberId);
    const problem = checkRemoval({
      actor: actor.role ?? OrganizationRole.VIEWER,
      target: member.role,
      self: member.userId === actor.sub,
      ownerCount: await this.ownerCount(actor.organizationId),
    });
    if (problem) throw new ForbiddenException(problem);
    // حذف عضویت کافی است: نشست‌های فعالش در درخواست بعدی رد می‌شوند.
    await this.members.delete({ id: member.id });
    return { ok: true };
  }

  async invite(actor: JwtUser, dto: InviteMemberDto, publicUrl: string) {
    const organizationId = actor.organizationId;
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.users.findOne({ where: { email } });
    if (existingUser) {
      const already = await this.members.findOne({
        where: { organizationId, userId: existingUser.id },
      });
      if (already) throw new BadRequestException('این شخص از قبل عضو تیم است');
    }

    // دعوت تازه برای همان ایمیل جای دعوت قبلی را می‌گیرد (لینک قبلی باطل).
    await this.invitations.delete({
      organizationId,
      email,
      acceptedAt: IsNull(),
    });

    const problem = checkSeatLimit({
      limit: await this.seatLimit(organizationId),
      members: await this.members.count({ where: { organizationId } }),
      pending: (await this.listInvitations(organizationId)).length,
    });
    if (problem) throw new ForbiddenException(problem);

    const token = randomBytes(32).toString('hex');
    const invitation = await this.invitations.save(
      this.invitations.create({
        organizationId,
        email,
        role: dto.role,
        tokenHash: hashInvitationToken(token),
        invitedBy: actor.sub,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        acceptedAt: null,
      }),
    );

    const link = `${publicUrl.replace(/\/+$/, '')}/panel/accept-invite?token=${token}`;
    const [organization, inviter] = await Promise.all([
      this.organizations.findOne({ where: { id: organizationId } }),
      this.users.findOne({ where: { id: actor.sub } }),
    ]);
    const delivery = await this.messaging.send({
      channel: 'email',
      recipient: email,
      subject: `دعوت به تیم ${organization?.name ?? ''}`.trim(),
      body: [
        'سلام،',
        '',
        `${inviter?.fullName ?? 'یکی از همکارانتان'} شما را با نقش «${ROLE_LABELS[dto.role]}» به تیم «${organization?.name ?? ''}» در سامانه‌ی نظرسنجی دعوت کرده است.`,
        'برای پذیرش روی لینک زیر بزنید. این لینک ۷ روز و فقط یک بار معتبر است:',
        link,
        '',
        'اگر انتظار این دعوت را نداشتید، این ایمیل را نادیده بگیرید.',
      ].join('\n'),
    });
    if (delivery.status === 'failed') {
      this.logger.warn(
        `ایمیل دعوت فرستاده نشد: ${delivery.providerMessage ?? ''}`,
      );
    }

    return {
      id: invitation.id,
      email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      // لینک فقط همین یک بار برمی‌گردد؛ در دیتابیس فقط هشش هست.
      link,
      emailStatus: delivery.status,
    };
  }

  async revokeInvitation(organizationId: string, invitationId: string) {
    const result = await this.invitations.delete({
      id: invitationId,
      organizationId,
      acceptedAt: IsNull(),
    });
    if (!result.affected) throw new NotFoundException('دعوت یافت نشد');
    return { ok: true };
  }

  /** اطلاعات صفحه‌ی پذیرش دعوت. */
  async preview(token: string) {
    const invitation = await this.findValidInvitation(token);
    const [organization, account] = await Promise.all([
      this.organizations.findOne({ where: { id: invitation.organizationId } }),
      this.users.findOne({
        where: { email: invitation.email },
        select: { id: true, totpEnabled: true },
      }),
    ]);
    return {
      organizationName: organization?.name ?? '',
      email: invitation.email,
      role: invitation.role,
      roleLabel: ROLE_LABELS[invitation.role],
      expiresAt: invitation.expiresAt,
      accountExists: Boolean(account),
      twoFactorRequired: Boolean(account?.totpEnabled),
    };
  }

  /** پذیرش دعوت و ورود به سازمان تازه. */
  async accept(dto: AcceptInvitationDto) {
    const invitation = await this.findValidInvitation(dto.token);
    const key = invitation.id;
    if (this.acceptLimiter.isLocked(key)) {
      throw new HttpException(
        'تلاش ناموفق زیاد بود؛ ۱۵ دقیقه‌ی دیگر دوباره امتحان کنید',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let user = await this.users.findOne({ where: { email: invitation.email } });
    if (user) {
      if (!(await bcrypt.compare(dto.password ?? '', user.passwordHash))) {
        this.acceptLimiter.fail(key);
        throw new UnauthorizedException(
          'رمز عبور حساب موجود با این ایمیل درست نیست',
        );
      }
      if (user.totpEnabled) {
        if (!dto.totpCode) return { twoFactorRequired: true as const };
        await this.twoFactor.verifyLogin(user.id, dto.totpCode);
      }
    } else {
      const fullName = dto.fullName?.trim();
      if (!fullName)
        throw new BadRequestException('نام و نام خانوادگی لازم است');
      if ((dto.password ?? '').length < MIN_PASSWORD_LENGTH) {
        throw new BadRequestException(
          `رمز عبور باید دست‌کم ${MIN_PASSWORD_LENGTH.toLocaleString('fa-IR')} نویسه باشد`,
        );
      }
      user = await this.users.save(
        this.users.create({
          fullName,
          email: invitation.email,
          passwordHash: await bcrypt.hash(dto.password, 10),
        }),
      );
    }
    this.acceptLimiter.succeed(key);

    const already = await this.members.findOne({
      where: { organizationId: invitation.organizationId, userId: user.id },
    });
    if (!already) {
      /*
       * سقف دوباره بررسی می‌شود: اگر پلن پس از دعوت پایین آمده باشد، دعوت
       * قدیمی نباید راه دور زدن سقف باشد.
       */
      const problem = checkSeatLimit({
        limit: await this.seatLimit(invitation.organizationId),
        members: await this.members.count({
          where: { organizationId: invitation.organizationId },
        }),
        pending: 0,
      });
      if (problem) throw new ForbiddenException(problem);
      await this.members.save(
        this.members.create({
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
        }),
      );
    }

    invitation.acceptedAt = new Date();
    await this.invitations.save(invitation);
    return this.auth.sessionFor(user, invitation.organizationId);
  }

  private async findValidInvitation(token: string) {
    const invitation = await this.invitations.findOne({
      where: { tokenHash: hashInvitationToken(token ?? '') },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(INVALID_INVITATION);
    }
    return invitation;
  }

  private async findMember(organizationId: string, memberId: string) {
    const member = await this.members.findOne({
      where: { id: memberId, organizationId },
    });
    if (!member) throw new NotFoundException('عضو یافت نشد');
    return member;
  }

  private ownerCount(organizationId: string) {
    return this.members.count({
      where: { organizationId, role: OrganizationRole.OWNER },
    });
  }

  private async seatLimit(organizationId: string) {
    const limits = await this.plans.getPolicyByOrganization(organizationId);
    return Number(limits.workspaceUsers ?? -1);
  }
}
