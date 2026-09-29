import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import type { JwtUser } from './current-user.decorator';

/**
 * دسترسی فقط برای سوپرادمین سکو.
 *
 * وضعیت سوپرادمین عمدا از دیتابیس خوانده می‌شود نه از ادعای درون توکن:
 * توکن‌ها عمر دارند و اگر این نقش از کسی گرفته شود، نباید تا انقضای توکن
 * قبلی‌اش همچنان دسترسی داشته باشد.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const userId = request.user?.sub;
    if (!userId) throw new ForbiddenException('دسترسی مجاز نیست');

    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, isSuperAdmin: true },
    });

    if (!user?.isSuperAdmin) {
      throw new ForbiddenException(
        'این بخش فقط برای مدیر کل سامانه در دسترس است',
      );
    }
    return true;
  }
}
