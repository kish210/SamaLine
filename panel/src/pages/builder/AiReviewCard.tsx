import { useMutation } from '@tanstack/react-query';
import { aiApi, describeError } from '../../api';
import type { FormPage } from '../../types';

interface Props {
  pages: FormPage[];
}

/** یک ایراد که بازنگر AI روی فرم گزارش کرده است. */
interface ReviewIssue {
  questionId?: string;
  kind?: string;
  message?: string;
  suggestion?: string;
}

/**
 * خروجی بازنگری را به فهرست یکدست تبدیل می‌کند.
 *
 * ارائه‌دهنده‌ی محلی `findings` (رشته‌ی ساده) و ارائه‌دهنده‌ی OpenAI
 * `issues` (شیء) برمی‌گرداند؛ رابط کاربری نباید به یکی از این دو گره بخورد.
 */
function normalizeIssues(result: Record<string, unknown>): ReviewIssue[] {
  if (Array.isArray(result.issues)) {
    return (result.issues as ReviewIssue[]).filter(
      (issue) => issue && typeof issue === 'object',
    );
  }
  if (Array.isArray(result.findings)) {
    return (result.findings as unknown[]).map((finding) => ({
      message: String(finding),
    }));
  }
  return [];
}

/** بازنگری فرم با هوش مصنوعی؛ اندپوینتش از قبل موجود بود ولی دکمه نداشت. */
export function AiReviewCard({ pages }: Props) {
  const review = useMutation({
    mutationFn: () => aiApi.review({ pages }),
  });

  const issues = review.data ? normalizeIssues(review.data) : [];

  return (
    <section className="card ai-review">
      <div className="section-head">
        <h3>بررسی فرم با هوش مصنوعی</h3>
        <button
          type="button"
          className="secondary"
          disabled={review.isPending || pages.length === 0}
          onClick={() => review.mutate()}
        >
          {review.isPending ? 'در حال بررسی…' : 'بررسی کن'}
        </button>
      </div>

      <p className="hint">
        سوال هدایت‌کننده، مبهم یا سوگیرانه را پیدا می‌کند. بررسی روی نسخه‌ی
        جاری ویرایشگر انجام می‌شود، نه نسخه‌ی ذخیره‌شده.
      </p>

      {review.isError && (
        <p className="error">{describeError(review.error)}</p>
      )}

      {review.isSuccess && issues.length === 0 && (
        <p className="hint">ایرادی گزارش نشد.</p>
      )}

      {issues.length > 0 && (
        <ul className="ai-issues">
          {issues.map((issue, index) => (
            <li key={index}>
              {issue.questionId && (
                <code className="issue-target">{issue.questionId}</code>
              )}
              <span>{issue.message}</span>
              {issue.suggestion && (
                <small className="issue-suggestion">{issue.suggestion}</small>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
