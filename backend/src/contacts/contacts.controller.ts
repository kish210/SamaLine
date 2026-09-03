import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrganizationId } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ContactsService } from './contacts.service';
import { AddContactsDto, CreateContactListDto, ImportCsvDto } from './dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Post('lists')
  createList(
    @Body() dto: CreateContactListDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.contacts.createList(organizationId, dto);
  }

  @Get('lists')
  listLists(@OrganizationId() organizationId: string) {
    return this.contacts.listLists(organizationId);
  }

  @Delete('lists/:listId')
  removeList(
    @Param('listId') listId: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.contacts.removeList(organizationId, listId);
  }

  @Post('lists/:listId/contacts')
  addContacts(
    @Param('listId') listId: string,
    @Body() dto: AddContactsDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.contacts.addContacts(organizationId, listId, dto);
  }

  /** بارگذاری گروهی از CSV — هر خط «نام,موبایل,ایمیل». */
  @Post('lists/:listId/import')
  importCsv(
    @Param('listId') listId: string,
    @Body() dto: ImportCsvDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.contacts.addContacts(organizationId, listId, {
      contacts: ContactsService.parseCsv(dto.csv),
    });
  }

  @Get('lists/:listId/contacts')
  listContacts(
    @Param('listId') listId: string,
    @OrganizationId() organizationId: string,
    @Query('includeUnsubscribed') includeUnsubscribed?: string,
  ) {
    return this.contacts.listContacts(
      organizationId,
      listId,
      includeUnsubscribed === 'true',
    );
  }

  /** گیرندگان آماده‌ی کمپین برای یک کانال. */
  @Get('lists/:listId/recipients')
  recipients(
    @Param('listId') listId: string,
    @OrganizationId() organizationId: string,
    @Query('channel') channel: 'sms' | 'email' = 'sms',
  ) {
    return this.contacts.campaignRecipients(organizationId, listId, channel);
  }

  @Patch('lists/:listId/contacts/:contactId/unsubscribe')
  unsubscribe(
    @Param('listId') listId: string,
    @Param('contactId') contactId: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.contacts.unsubscribe(organizationId, listId, contactId);
  }

  @Delete('lists/:listId/contacts/:contactId')
  removeContact(
    @Param('listId') listId: string,
    @Param('contactId') contactId: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.contacts.removeContact(organizationId, listId, contactId);
  }
}
