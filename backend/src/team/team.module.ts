import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { InvitationEntity } from '../database/entities/invitation.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { OrganizationUserEntity } from '../database/entities/organization-user.entity';
import { UserEntity } from '../database/entities/user.entity';
import { MessagingModule } from '../messaging/messaging.module';
import { PlanModule } from '../plans/plan.module';
import { InvitationPublicController, TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationUserEntity,
      InvitationEntity,
      UserEntity,
      OrganizationEntity,
    ]),
    AuthModule,
    MessagingModule,
    PlanModule,
  ],
  controllers: [TeamController, InvitationPublicController],
  providers: [TeamService],
})
export class TeamModule {}
