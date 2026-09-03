import { AnswerFlatEntity } from './answer-flat.entity';
import { ApiKeyEntity } from './api-key.entity';
import { AuditLogEntity } from './audit-log.entity';
import { ContactEntity } from './contact.entity';
import { ContactListEntity } from './contact-list.entity';
import { DeliveryLogEntity } from './delivery-log.entity';
import { FormEntity } from './form.entity';
import { FormVersionEntity } from './form-version.entity';
import { IdentityProviderEntity } from './identity-provider.entity';
import { InterviewerQuotaEntity } from './interviewer-quota.entity';
import { InvoiceEntity } from './invoice.entity';
import { KioskSessionEntity } from './kiosk-session.entity';
import { OnPremLicenseEntity } from './onprem-license.entity';
import { OrganizationEntity } from './organization.entity';
import { OrganizationUserEntity } from './organization-user.entity';
import { PaymentEntity } from './payment.entity';
import { PlanPolicyEntity } from './plan-policy.entity';
import { PublicationEntity } from './publication.entity';
import { ResponseCommentEntity } from './response-comment.entity';
import { ResponseEntity } from './response.entity';
import { SavedFilterEntity } from './saved-filter.entity';
import { SubscriptionEntity } from './subscription.entity';
import { UsageCounterEntity } from './usage-counter.entity';
import { UserEntity } from './user.entity';
import { WebhookEntity } from './webhook.entity';
import { WorkspaceEntity } from './workspace.entity';

/** تنها منبع حقیقت برای فهرست موجودیت‌ها (app.module، seed و تست‌ها از همین استفاده می‌کنند). */
export const ALL_ENTITIES = [
  UserEntity,
  OrganizationEntity,
  OrganizationUserEntity,
  WorkspaceEntity,
  FormEntity,
  FormVersionEntity,
  PublicationEntity,
  ResponseEntity,
  AnswerFlatEntity,
  PlanPolicyEntity,
  SubscriptionEntity,
  UsageCounterEntity,
  WebhookEntity,
  AuditLogEntity,
  ResponseCommentEntity,
  SavedFilterEntity,
  DeliveryLogEntity,
  ApiKeyEntity,
  IdentityProviderEntity,
  KioskSessionEntity,
  InterviewerQuotaEntity,
  InvoiceEntity,
  PaymentEntity,
  OnPremLicenseEntity,
  ContactListEntity,
  ContactEntity,
];
