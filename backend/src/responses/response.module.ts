import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { ResponseController } from './response.controller';
import { ResponseService } from './response.service';

@Module({
  imports: [TypeOrmModule.forFeature([ResponseEntity, FormEntity])],
  controllers: [ResponseController],
  providers: [ResponseService],
})
export class ResponseModule {}
