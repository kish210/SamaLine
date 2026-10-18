import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { AcceptInvitationDto, ChangeRoleDto, InviteMemberDto } from './dto';
import { TeamService } from './team.service';

/** مدیریت تیم سازمان؛ فقط مالک و مدیر. */
@MinRole(OrganizationRole.ADMIN)
@Controller('team')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('members')
  members(@CurrentUser() user: JwtUser) {
    return this.team.listMembers(user.organizationId);
  }

  @Patch('members/:id')
  changeRole(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.team.changeRole(user, id, dto.role);
  }

  @Delete('members/:id')
  remove(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.team.removeMember(user, id);
  }

  @Get('invitations')
  invitations(@CurrentUser() user: JwtUser) {
    return this.team.listInvitations(user.organizationId);
  }

  @Post('invitations')
  invite(@CurrentUser() user: JwtUser, @Body() dto: InviteMemberDto) {
    // نشانی لینک فقط از PUBLIC_URL، نه سربرگ Host (مثل بازیابی رمز).
    const base = process.env.PUBLIC_URL || 'http://localhost:5174';
    return this.team.invite(user, dto, base);
  }

  @Delete('invitations/:id')
  revoke(@CurrentUser() user: JwtUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.team.revokeInvitation(user.organizationId, id);
  }
}

/** صفحه‌ی پذیرش دعوت؛ بدون ورود، با توکن لینک. */
@Controller('public/invitations')
export class InvitationPublicController {
  constructor(private readonly team: TeamService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.team.preview(token);
  }

  @Post('accept')
  accept(@Body() dto: AcceptInvitationDto) {
    return this.team.accept(dto);
  }
}
