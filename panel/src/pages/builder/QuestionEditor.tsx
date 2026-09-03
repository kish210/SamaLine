import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from '../../types';
import type { Question, QuestionType } from '../../types';

interface Props {
  question: Question;
  index: number;
  total: number;
  scoreIndexKeys: Array<{ id: string; key: string }>;
  onChange: (patch: Partial<Question>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

/** نوع‌هایی که فهرست گزینه دارند. */
const CHOICE_TYPES: QuestionType[] = [
  'multiple_choice',
  'dropdown',
  'image_choice',
  'emoji',
  'matrix',
];

export function QuestionEditor({
  question,
  index,
  total,
  scoreIndexKeys,
  onChange,
  onMove,
  onRemove,
}: Props) {
  const hasChoices = CHOICE_TYPES.includes(question.type);

  return (
    <div className="card question-editor">
      <div className="question-head">
        <span className="index">سوال {index + 1}</span>
        <div className="question-actions">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </button>
          <button type="button" className="danger" onClick={onRemove}>
            حذف
          </button>
        </div>
      </div>

      <label>
        عنوان سوال
        <input
          value={question.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </label>

      <div className="grid-2">
        <label>
          نوع سوال
          <select
            value={question.type}
            onChange={(e) => onChange({ type: e.target.value as QuestionType })}
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {QUESTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label>
          شناسه (برای منطق و Piping)
          <input
            value={question.id}
            onChange={(e) => onChange({ id: e.target.value })}
          />
        </label>
      </div>

      <label>
        توضیح تکمیلی
        <input
          value={question.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </label>

      {hasChoices && (
        <label>
          گزینه‌ها (با ویرگول جدا کنید)
          <input
            value={(question.options ?? []).join('، ')}
            onChange={(e) =>
              onChange({
                options: e.target.value
                  .split(/[،,]/)
                  .map((o) => o.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      )}

      <div className="grid-2">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(question.required)}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          پاسخ اجباری
        </label>

        {scoreIndexKeys.length > 0 && (
          <label>
            شاخص امتیازدهی
            <select
              value={question.scoring?.indexId ?? ''}
              onChange={(e) =>
                onChange({
                  scoring: e.target.value
                    ? { ...question.scoring, indexId: e.target.value }
                    : undefined,
                })
              }
            >
              <option value="">بدون شاخص</option>
              {scoreIndexKeys.map((idx) => (
                <option key={idx.id} value={idx.id}>
                  {idx.key}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
