import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  LetterEntity,
  LetterRecipientEntity,
} from '../database/entities/letter.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { LetterController } from './letter.controller';
import { LetterService } from './letter.service';
import { LetterIdentityService } from './letter-identity.service';

/**
 * نامهٔ داخلی.
 *
 * `LetterService` فقط `personnelId` می‌شناسد، نه حسابِ پنل؛ پس همین سرویس
 * بعداً به ربات هم وصل می‌شود بدونِ تعریفِ دوبارهٔ هویت.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      LetterEntity,
      LetterRecipientEntity,
      PersonnelEntity,
    ]),
  ],
  controllers: [LetterController],
  providers: [LetterService, LetterIdentityService],
  exports: [LetterService, LetterIdentityService],
})
export class LetterModule {}
