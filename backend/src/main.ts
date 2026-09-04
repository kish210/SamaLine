// باید پیش از هر import دیگری اجرا شود تا DB_DRIVER هنگام ساخت موجودیت‌ها موجود باشد.
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { uploadDirectory } from './uploads/upload.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DB_DRIVER } from './database/column-types';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /*
   * فایل‌های آپلودی (لوگوی سازمان‌ها) از همین سرور سرو می‌شوند.
   *
   * عمدا بیرون از پیشوند api/v1 است تا نشانی لوگو در تم فرم ساده بماند و
   * نیازی به توکن برای دیدنش نباشد — لوگو روی فرم عمومی نمایش داده می‌شود.
   */
  app.useStaticAssets(uploadDirectory(), { prefix: '/uploads/' });
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SamaLine API')
    .setDescription('سامانه نظرسنجی و فرم‌ساز آنلاین')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`SamaLine backend روی پورت ${port} (دیتابیس: ${DB_DRIVER})`);
  console.log(`مستندات: http://localhost:${port}/api/docs`);
}

void bootstrap();
