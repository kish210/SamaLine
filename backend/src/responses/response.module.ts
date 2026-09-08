import { Module } from '@nestjs/common';
import { TenantAccessModule } from '../common/tenant-access.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { ResponseCommentEntity } from '../database/entities/response-comment.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { ResponseController } from './response.controller';
import { ResponseService } from './response.service';

@Module({
  imports: [
    TenantAccessModule,
    TypeOrmModule.forFeature([
      ResponseEntity,
      FormEntity,
      ResponseCommentEntity,
    ]),
  ],
  controllers: [ResponseController],
  providers: [ResponseService],
})
export class ResponseModule {}
