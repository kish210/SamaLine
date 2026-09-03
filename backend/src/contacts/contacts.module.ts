import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactEntity } from '../database/entities/contact.entity';
import { ContactSourceEntity } from '../database/entities/contact-source.entity';
import { ContactListEntity } from '../database/entities/contact-list.entity';
import { ContactsController } from './contacts.controller';
import { ContactSourceService } from './contact-source.service';
import { ContactsService } from './contacts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContactListEntity,
      ContactEntity,
      ContactSourceEntity,
    ]),
  ],
  providers: [ContactsService, ContactSourceService],
  controllers: [ContactsController],
  exports: [ContactsService, ContactSourceService],
})
export class ContactsModule {}
