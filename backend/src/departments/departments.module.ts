import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentEntity } from '../database/entities/department.entity';
import { DepartmentMemberEntity } from '../database/entities/department-member.entity';
import { OrganizationUserEntity } from '../database/entities/organization-user.entity';
import { UserEntity } from '../database/entities/user.entity';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DepartmentEntity,
      DepartmentMemberEntity,
      OrganizationUserEntity,
      UserEntity,
    ]),
  ],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
