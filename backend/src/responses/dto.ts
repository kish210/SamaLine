import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResponseFilterDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  respondentKey?: string;

  @IsOptional()
  @IsString()
  questionId?: string;

  @IsOptional()
  @IsString()
  valueText?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  /** جست‌وجوی آزاد در متنِ پاسخ‌ها و کلیدِ پاسخ‌دهنده. */
  @IsOptional()
  @IsString()
  search?: string;

  /** صفحه‌بندیِ سمت سرور؛ اندازهٔ صفحه سقفِ ۲۰۰ دارد. */
  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}

export class CreateResponseCommentDto {
  @IsNotEmpty()
  authorName: string;

  @IsNotEmpty()
  body: string;
}

/** تصمیمِ بررسیِ یک درخواست (گردش‌کارِ تأیید؛ فاز E). */
export class ReviewResponseDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  note?: string;
}
