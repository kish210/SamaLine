import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import type { JwtUser } from '../common/current-user.decorator';
import { OrganizationUserEntity } from '../database/entities/organization-user.entity';
import { UserEntity } from '../database/entities/user.entity';
import { issuedAfterPasswordChange } from './session-validity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(OrganizationUserEntity)
    private readonly members: Repository<OrganizationUserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'change-me'),
    });
  }

  /**
   * توکن امضای درست دارد؛ آیا کاربرش هنوز هست و رمزش از آن پس عوض نشده؟
   *
   * بدون این، توکن دزدیده‌شده تا انقضا (۷ روز) کار می‌کرد، حتی پس از
   * اینکه صاحب حساب رمزش را عوض کرده باشد.
   */
  async validate(payload: JwtUser & { iat?: number }): Promise<JwtUser> {
    const user = await this.users.findOne({
      where: { id: payload.sub },
      select: { id: true, passwordChangedAt: true },
    });
    if (!user) throw new UnauthorizedException('حساب کاربری یافت نشد');
    if (!issuedAfterPasswordChange(payload.iat, user.passwordChangedAt)) {
      throw new UnauthorizedException(
        'رمز عبور این حساب عوض شده است؛ دوباره وارد شوید',
      );
    }

    /*
     * عضویت در همین سازمان، هر بار از دیتابیس.
     *
     * کسی که از تیم حذف شده توکنش هنوز امضای درست دارد؛ بدون این بررسی تا
     * انقضای توکن به داده‌ی سازمان دسترسی می‌داشت.
     */
    const member = payload.organizationId
      ? await this.members.findOne({
          where: {
            userId: payload.sub,
            organizationId: payload.organizationId,
          },
          select: { id: true, role: true },
        })
      : null;
    if (!member) {
      throw new UnauthorizedException(
        'دسترسی شما به این سازمان برداشته شده است؛ دوباره وارد شوید',
      );
    }
    return { ...payload, role: member.role };
  }
}
