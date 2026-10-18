import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [PlatformModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
