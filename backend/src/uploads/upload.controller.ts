import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { MAX_LOGO_BYTES, UploadService } from './upload.service';

/** حداقلِ چیزی که از فایل آپلودی لازم داریم (بدون وابستگی به تایپ‌های multer). */
interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@ApiTags('uploads')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploads: UploadService) {}

  /**
   * آپلود لوگوی سازمان برای نمایش بالای فرم.
   *
   * سقف حجم در خود interceptor هم اعمال می‌شود تا فایل بزرگ اصلا کامل در
   * حافظه خوانده نشود.
   */
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_LOGO_BYTES } }),
  )
  upload(@UploadedFile() file: UploadedImage) {
    return this.uploads.saveImage(file);
  }
}
