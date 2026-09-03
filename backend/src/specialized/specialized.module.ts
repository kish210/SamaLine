import { Module } from '@nestjs/common';
import { SpecializedController } from './specialized.controller';
import { SpecializedService } from './specialized.service';

@Module({
  controllers: [SpecializedController],
  providers: [SpecializedService],
})
export class SpecializedModule {}
