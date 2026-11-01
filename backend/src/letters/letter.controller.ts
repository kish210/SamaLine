import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import {
  LetterAttachment,
  LetterPriority,
} from '../database/entities/letter.entity';
import { LetterService, type LetterListQuery } from './letter.service';
import { LetterIdentityService } from './letter-identity.service';

class SendLetterDto {
  @IsNotEmpty() @IsString() @MaxLength(200) subject: string;
  @IsOptional() @IsString() @MaxLength(20000) body?: string;

  /** شناسهٔ پرسنلیِ گیرنده‌های اصلی. */
  @IsArray() to: string[];

  @IsOptional() @IsArray() cc?: string[];

  @IsOptional()
  @IsIn(Object.values(LetterPriority))
  priority?: LetterPriority;

  @IsOptional() @IsArray() attachments?: LetterAttachment[];
}

class ReplyLetterDto {
  @IsNotEmpty() @IsString() @MaxLength(20000) body: string;
  @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsArray() attachments?: LetterAttachment[];
}

/**
 * نامهٔ داخلی، از دیدِ «خودم».
 *
 * زیرِ `/me` می‌نشیند و هیچ `@MinRole` ندارد: نامه کارِ همهٔ کارمندهاست،
 * از بیننده تا مالک. «من کی هستم» از توکن و پروندهٔ پرسنلیِ متصل حساب
 * می‌شود، هرگز از بدنهٔ درخواست؛ پس کسی نمی‌تواند به نامِ دیگری نامه
 * بفرستد یا صندوقِ او را ببیند.
 */
@Controller('me/letters')
@UseGuards(JwtAuthGuard)
export class LetterController {
  constructor(
    private readonly letters: LetterService,
    private readonly identity: LetterIdentityService,
  ) {}

  @Get()
  async inbox(@CurrentUser() user: JwtUser, @Query() query: LetterListQuery) {
    const me = await this.identity.requirePersonnelId(user);
    return this.letters.inbox(user.organizationId, me, query);
  }

  @Get('sent')
  async outbox(@CurrentUser() user: JwtUser, @Query() query: LetterListQuery) {
    const me = await this.identity.requirePersonnelId(user);
    return this.letters.outbox(user.organizationId, me, query);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: JwtUser) {
    const me = await this.identity.personnelId(user);
    // بی‌پروندهٔ پرسنلی، صندوقی هم نیست؛ صفر درست‌تر از خطاست چون این
    // مسیر فقط نشانِ منو را پر می‌کند.
    if (!me) return { count: 0 };
    return { count: await this.letters.unreadCount(user.organizationId, me) };
  }

  /** فهرستِ کسانی که می‌شود به آن‌ها نامه فرستاد. */
  @Get('recipients')
  async recipients(@CurrentUser() user: JwtUser) {
    const me = await this.identity.requirePersonnelId(user);
    return this.identity.addressBook(user.organizationId, me);
  }

  @Get(':id')
  async one(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const me = await this.identity.requirePersonnelId(user);
    return this.letters.get(user.organizationId, id, me);
  }

  @Get(':id/thread')
  async thread(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const me = await this.identity.requirePersonnelId(user);
    return this.letters.thread(user.organizationId, id, me);
  }

  @Post()
  async send(@CurrentUser() user: JwtUser, @Body() dto: SendLetterDto) {
    const me = await this.identity.requirePersonnelId(user);
    return this.letters.send(user.organizationId, me, dto, user.sub);
  }

  @Post(':id/reply')
  async reply(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ReplyLetterDto,
  ) {
    const me = await this.identity.requirePersonnelId(user);
    return this.letters.reply(user.organizationId, me, id, dto, user.sub);
  }

  @Post(':id/read')
  async read(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const me = await this.identity.requirePersonnelId(user);
    return this.letters.markRead(user.organizationId, id, me);
  }
}
