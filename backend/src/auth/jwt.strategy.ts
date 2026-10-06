import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import type { JwtUser } from '../common/current-user.decorator';
import { UserEntity } from '../database/entities/user.entity';
import { issuedAfterPasswordChange } from './session-validity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
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
    return payload;
  }
}
