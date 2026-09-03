import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { FormModule } from './forms/form.module';
import { PublicModule } from './public/public.module';
import { ResponseModule } from './responses/response.module';
import { WorkspaceModule } from './workspaces/workspace.module';
import { AnswerFlatEntity } from './database/entities/answer-flat.entity';
import { FormEntity } from './database/entities/form.entity';
import { FormVersionEntity } from './database/entities/form-version.entity';
import { OrganizationEntity } from './database/entities/organization.entity';
import { OrganizationUserEntity } from './database/entities/organization-user.entity';
import { PublicationEntity } from './database/entities/publication.entity';
import { ResponseEntity } from './database/entities/response.entity';
import { UserEntity } from './database/entities/user.entity';
import { WorkspaceEntity } from './database/entities/workspace.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          UserEntity,
          OrganizationEntity,
          OrganizationUserEntity,
          WorkspaceEntity,
          FormEntity,
          FormVersionEntity,
          PublicationEntity,
          ResponseEntity,
          AnswerFlatEntity,
        ],
        synchronize: false,
      }),
    }),
    AuthModule,
    WorkspaceModule,
    FormModule,
    PublicModule,
    ResponseModule,
  ],
})
export class AppModule {}
