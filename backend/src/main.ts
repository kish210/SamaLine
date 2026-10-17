// باید پیش از هر import دیگری اجرا شود تا DB_DRIVER هنگام ساخت موجودیت‌ها موجود باشد.
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import type { RequestListener } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { join, resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { uploadDirectory } from './uploads/upload.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { runMigrations } from './database/migrate-on-boot';
import { DB_DRIVER } from './database/column-types';

const RENDERER_DIR = resolve(process.cwd(), '../form-renderer/dist');
const PANEL_DIR = resolve(process.cwd(), '../panel/dist');

/** آیا این اپ build شده است؟ */
function isBuilt(dir: string): boolean {
  return existsSync(join(dir, 'index.html'));
}

/** سرو کردن فایل‌های استاتیک یک اپ ساخته‌شده. */
function serveStaticIfBuilt(
  app: NestExpressApplication,
  dir: string,
  prefix: string,
): void {
  if (isBuilt(dir)) app.useStaticAssets(dir, { prefix });
}

/**
 * مسیر پوششی SPA.
 *
 * هر دو اپ React‌اند و مسیرهای داخلی‌شان فایل واقعی نیستند، پس مسیر ناشناخته
 * باید index.html بگیرد.
 *
 * عمدا میان‌افزار است نه route: Nest در پایان init یک هندلر ۴۰۴ ثبت می‌کند و
 * هر route‌ای که بعد از آن اضافه شود هرگز اجرا نمی‌شود. میان‌افزار پیش از
 * مسیرها می‌نشیند، پس خودش باید مسیرهای API را کنار بگذارد.
 */
function useSpaFallback(
  app: NestExpressApplication,
  dir: string,
  prefix: string,
): void {
  if (!isBuilt(dir)) return;

  app.use((req: SpaRequest, res: SpaResponse, next: () => void) => {
    const path = req.path ?? '';

    // فقط ناوبری مرورگر؛ API، آپلود و درخواست‌های غیر GET رد می‌شوند.
    const isApiPath =
      path.startsWith('/api') || path.startsWith('/uploads');
    const inScope = prefix === '/' ? true : path.startsWith(prefix);
    const wantsHtml = (req.headers?.accept ?? '').includes('text/html');

    if (req.method !== 'GET' || isApiPath || !inScope || !wantsHtml) {
      next();
      return;
    }

    // درخواست فایل واقعی (js/css/تصویر) را به میان‌افزار استاتیک می‌سپاریم.
    if (/\.[a-zA-Z0-9]{2,5}$/.test(path)) {
      next();
      return;
    }

    res.sendFile(join(dir, 'index.html'));
  });
}

interface SpaRequest {
  method: string;
  path?: string;
  headers?: { accept?: string };
}

interface SpaResponse {
  sendFile: (path: string) => void;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /*
   * پشت پراکسیِ محلی (nginx) هستیم.
   *
   * بدون این، req.ip همیشه 127.0.0.1 می‌شود و IPِ ذخیره‌شده در گزارش بی‌معنی
   * است. «loopback» یعنی فقط به پراکسیِ روی همین ماشین اعتماد کن و اولین IPِ
   * X-Forwarded-For را بردار — نه اینکه به هر هدرِ جعلی از بیرون اعتماد کنی.
   */
  app.set('trust proxy', 'loopback');

  /*
   * مهاجرت‌ها پیش از پذیرش درخواست اجرا می‌شوند.
   *
   * اگر اسکیما عقب باشد و برنامه درخواست بگیرد، خطاهای «ستون وجود ندارد»
   * به کاربر می‌رسد؛ شکست اینجا صریح‌تر و بی‌ضررتر است.
   */
  await runMigrations(app.get(DataSource));

  /*
   * فایل‌های آپلودی (لوگوی سازمان‌ها) از همین سرور سرو می‌شوند.
   *
   * عمدا بیرون از پیشوند api/v1 است تا نشانی لوگو در تم فرم ساده بماند و
   * نیازی به توکن برای دیدنش نباشد — لوگو روی فرم عمومی نمایش داده می‌شود.
   */
  app.useStaticAssets(uploadDirectory(), { prefix: '/uploads/' });

  /*
   * در استقرار تک‌پورتی، خودِ بک‌اند فایل‌های ساخته‌شده‌ی پنل و فرم را هم
   * سرو می‌کند: یک پورت و یک پروسه، بدون nginx یا سرویس جانبی.
   */
  serveStaticIfBuilt(app, RENDERER_DIR, '/');
  serveStaticIfBuilt(app, PANEL_DIR, '/panel');
  // ترتیب مهم است: پنل پیش از ریشه، وگرنه ریشه مسیرهای پنل را هم می‌گیرد.
  useSpaFallback(app, PANEL_DIR, '/panel');
  useSpaFallback(app, RENDERER_DIR, '/');

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

  const port = Number(process.env.PORT ?? 3000);

  /*
   * اگر گواهی TLS تنظیم شده باشد، همان نمونه‌ی express هم‌زمان روی HTTP و HTTPS
   * سرو می‌شود: یک پروسه، دو پورت (۸۰ و ۴۴۳ در استقرار). بدون گواهی، رفتار
   * قدیمیِ تک‌پورتی دست‌نخورده می‌ماند تا توسعه و نصب‌های قبلی نشکنند.
   */
  const certPath = process.env.TLS_CERT;
  const keyPath = process.env.TLS_KEY;
  const tlsReady =
    !!certPath && !!keyPath && existsSync(certPath) && existsSync(keyPath);

  if (tlsReady) {
    const httpsPort = Number(process.env.HTTPS_PORT ?? 443);
    // routeها و میان‌افزارها باید پیش از ساختن سرورها سوار شوند؛ listen را
    // خودمان می‌زنیم نه app.listen، تا یک express روی دو پورت بنشیند.
    await app.init();
    const instance = app
      .getHttpAdapter()
      .getInstance() as unknown as RequestListener;
    const credentials = {
      cert: readFileSync(certPath as string),
      key: readFileSync(keyPath as string),
    };
    createHttpServer(instance).listen(port);
    createHttpsServer(credentials, instance).listen(httpsPort);
    console.log(
      `SamaLine backend روی HTTP ${port} و HTTPS ${httpsPort} (دیتابیس: ${DB_DRIVER})`,
    );
    console.log(`مستندات: https://localhost:${httpsPort}/api/docs`);
  } else {
    await app.listen(port);
    console.log(`SamaLine backend روی پورت ${port} (دیتابیس: ${DB_DRIVER})`);
    console.log(`مستندات: http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
