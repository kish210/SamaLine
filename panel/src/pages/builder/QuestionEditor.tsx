import { useRef, useState } from 'react';
import { QUESTION_CATEGORIES, typeLabel } from '../../question-catalog';
import type { Question, QuestionType } from '../../types';

interface Props {
  question: Question;
  index: number;
  total: number;
  scoreIndexKeys: Array<{ id: string; key: string }>;
  /** سوال‌های پیش از این سوال؛ فقط این‌ها را می‌توان در عنوان درج کرد. */
  earlierQuestions: Array<{ id: string; title: string }>;
  onChange: (patch: Partial<Question>) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
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
  earlierQuestions,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: Props) {
  const hasChoices = CHOICE_TYPES.includes(question.type);
  const meta = (question.meta ?? {}) as Record<string, unknown>;
  const hidden = meta.hidden === true;
  const imageUrl = typeof meta.imageUrl === 'string' ? meta.imageUrl : '';

  const titleRef = useRef<HTMLInputElement>(null);
  const [showVars, setShowVars] = useState(false);

  const patchMeta = (patch: Record<string, unknown>) =>
    onChange({ meta: { ...meta, ...patch } });

  /**
   * درج `{{شناسه}}` در محل مکان‌نما.
   *
   * Piping سمت سرور همین الگو را می‌شناسد؛ کاربر نباید شناسه‌ها را از بر
   * باشد یا آکولادها را دستی تایپ کند.
   */
  const insertVariable = (questionId: string) => {
    const input = titleRef.current;
    const token = `{{${questionId}}}`;
    if (!input) {
      onChange({ title: `${question.title}${token}` });
    } else {
      const start = input.selectionStart ?? question.title.length;
      const end = input.selectionEnd ?? start;
      onChange({
        title: question.title.slice(0, start) + token + question.title.slice(end),
      });
    }
    setShowVars(false);
  };

  return (
    <div className={hidden ? 'card question-editor is-hidden' : 'card question-editor'}>
      <div className="question-head">
        <span className="index">
          سوال {index + 1} · {typeLabel(question.type)}
          {hidden && <span className="badge-off">خاموش</span>}
        </span>
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
          <button
            type="button"
            title={hidden ? 'روشن کردن سوال' : 'خاموش کردن سوال'}
            onClick={() => patchMeta({ hidden: !hidden })}
          >
            {hidden ? 'روشن' : 'خاموش'}
          </button>
          <button type="button" title="کپی سوال" onClick={onDuplicate}>
            کپی
          </button>
          <button type="button" className="danger" onClick={onRemove}>
            حذف
          </button>
        </div>
      </div>

      <label>
        عنوان سوال
        <input
          ref={titleRef}
          value={question.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </label>

      {earlierQuestions.length > 0 && (
        <div className="var-helper">
          <button
            type="button"
            className="link-button"
            onClick={() => setShowVars((prev) => !prev)}
          >
            @ درج پاسخ سوال قبلی
          </button>
          {showVars && (
            <div className="var-list">
              {earlierQuestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => insertVariable(item.id)}
                >
                  {item.title || item.id}
                  <code>{`{{${item.id}}}`}</code>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid-2">
        <label>
          نوع سوال
          <select
            value={question.type}
            onChange={(e) => onChange({ type: e.target.value as QuestionType })}
          >
            {QUESTION_CATEGORIES.map((category) => (
              <optgroup key={category.key} label={category.label}>
                {category.types.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </optgroup>
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

      <label>
        تصویر سوال (نشانی)
        <input
          value={imageUrl}
          placeholder="https://example.com/question.jpg"
          onChange={(e) => patchMeta({ imageUrl: e.target.value })}
        />
      </label>

      {imageUrl && (
        <img className="question-image-preview" src={imageUrl} alt="" />
      )}

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

      {SCALE_TYPES.includes(question.type) && (
        <ScaleSettings
          type={question.type}
          meta={meta}
          onPatch={patchMeta}
        />
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

/** نوع‌هایی که تنظیمات مقیاس دارند. */
const SCALE_TYPES: QuestionType[] = ['rating', 'nps', 'slider'];

interface ScaleProps {
  type: QuestionType;
  meta: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
}

/**
 * تنظیمات ظاهر و بازه‌ی سوال‌های امتیازی.
 *
 * NPS بازه‌ی ثابت ۰ تا ۱۰ دارد (تعریف استانداردش همین است)، پس برای آن
 * فیلد کف و سقف نشان داده نمی‌شود؛ اجازه‌ی تغییرش فقط داده‌ی غیرقابل مقایسه
 * تولید می‌کند.
 */
function ScaleSettings({ type, meta, onPatch }: ScaleProps) {
  const isNps = type === 'nps';
  const style = (meta.style as string | undefined) ?? '';
  const min = Number(meta.min ?? (type === 'rating' ? 1 : 0));
  const max = Number(meta.max ?? (type === 'rating' ? 5 : 10));
  const labels = (meta.labels ?? {}) as { start?: string; end?: string };
  const showEmoji = meta.showEmoji !== false;

  const patchLabel = (side: 'start' | 'end', text: string) =>
    onPatch({ labels: { ...labels, [side]: text } });

  return (
    <fieldset className="scale-settings">
      <legend>ظاهر مقیاس</legend>

      <div className="grid-2">
        {type !== 'slider' && (
          <label>
            نمایش
            <select
              value={style}
              onChange={(e) =>
                onPatch({ style: e.target.value || undefined })
              }
            >
              <option value="">خودکار (بر اساس بازه)</option>
              <option value="meter">متر خطی</option>
              <option value="star">ستاره</option>
            </select>
          </label>
        )}

        {!isNps && (
          <label>
            بازه
            <span className="range-inputs">
              <input
                type="number"
                value={min}
                onChange={(e) => onPatch({ min: Number(e.target.value) })}
              />
              <span>تا</span>
              <input
                type="number"
                value={max}
                onChange={(e) => onPatch({ max: Number(e.target.value) })}
              />
            </span>
          </label>
        )}
      </div>

      <div className="grid-2">
        <label>
          برچسب کمینه
          <input
            placeholder="خیلی بد"
            value={labels.start ?? ''}
            onChange={(e) => patchLabel('start', e.target.value)}
          />
        </label>
        <label>
          برچسب بیشینه
          <input
            placeholder="عالی"
            value={labels.end ?? ''}
            onChange={(e) => patchLabel('end', e.target.value)}
          />
        </label>
      </div>

      {type !== 'slider' && style !== 'star' && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showEmoji}
            onChange={(e) => onPatch({ showEmoji: e.target.checked })}
          />
          نمایش چهرک واکنشی (با امتیاز عوض می‌شود)
        </label>
      )}

      {isNps && (
        <p className="hint">
          بازه‌ی NPS همیشه ۰ تا ۱۰ است؛ تغییرش داده را با استاندارد جهانی
          ناهم‌خوان می‌کند.
        </p>
      )}
    </fieldset>
  );
}
