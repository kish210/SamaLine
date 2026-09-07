import { useState } from 'react';
import type { FlowEdge, FlowGraph, FormPage, SkipRule } from '../../types';
import { SkipRuleEditor } from './SkipRuleEditor';

interface Props {
  graph: FlowGraph;
  pages: FormPage[];
  /** قوانین پرش فعلی، به همان ترتیبی که `ruleIndex` به آن اشاره می‌کند. */
  rules: SkipRule[];
  /** تغییر ذخیره‌نشده‌ای هست؟ بوم وضعیت ذخیره‌شده را نشان می‌دهد. */
  dirty: boolean;
  onChange: (rules: SkipRule[]) => void;
}

const NODE_W = 190;
const NODE_H = 58;
const GAP_Y = 74;
const LANE = 110;
const END_ID = '__end__';

/**
 * بوم گرافیکی مسیر فرم.
 *
 * با SVG بومی رسم می‌شود نه یک کتابخانه‌ی گراف: مسیر فرم یک زنجیره‌ی عمودی
 * با چند یال پرش است، و افزودن چند صد کیلوبایت وابستگی برای این شکل توجیه
 * ندارد.
 *
 * چیدمان عمداً ثابت است (صفحه‌ها به ترتیب، یال‌های پرش در خطوط کناری) نه
 * جابه‌جاشدنی با موس: در فرمی که ترتیب صفحه‌ها خودش معنا دارد، جای دلخواه
 * گره‌ها اطلاعات تازه‌ای نمی‌دهد و فقط یک وضعیت اضافه برای ذخیره می‌سازد.
 */
export function FlowChart({ graph, pages, rules, dirty, onChange }: Props) {
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  const nodes = graph.nodes;
  if (!nodes.length) return <p className="empty">صفحه‌ای برای نمایش نیست.</p>;

  const skipEdges = graph.edges.filter((e) => e.kind === 'skip');
  const rows = nodes.length + 1;
  const height = rows * (NODE_H + GAP_Y);
  // برای هر یال پرش یک خط کناری، تا برچسب‌ها روی هم نیفتند.
  const lanes = Math.max(1, skipEdges.length);
  const width = NODE_W + 60 + lanes * LANE;
  const nodeX = 30;

  const yOf = (id: string) =>
    id === END_ID
      ? nodes.length * (NODE_H + GAP_Y)
      : Math.max(
          0,
          nodes.findIndex((n) => n.id === id) * (NODE_H + GAP_Y),
        );

  const save = (rule: SkipRule, index: number | 'new') => {
    onChange(
      index === 'new'
        ? [...rules, rule]
        : rules.map((r, i) => (i === index ? rule : r)),
    );
    setEditing(null);
  };

  const remove = (index: number) =>
    onChange(rules.filter((_, i) => i !== index));

  return (
    <div className="flowchart">
      <div className="section-head">
        <h3>مسیر فرم</h3>
        <button
          type="button"
          className="secondary"
          onClick={() => setEditing('new')}
        >
          افزودن قانون پرش
        </button>
      </div>

      <p className="hint">
        خط پیوسته مسیر عادی است، خط نقطه‌چین پرش شرطی، و خط خاکستریِ
        «در غیر این صورت» جایی است که فرم می‌رود وقتی هیچ شرطی برقرار نشود.
      </p>

      {dirty && (
        <p className="preview-note">
          بوم آخرین نسخه‌ی <strong>ذخیره‌شده</strong> را می‌کشد؛ برای دیدن
          تغییرات جاری روی بوم، فرم را ذخیره کنید. فهرست زیر تغییرات جاری
          را نشان می‌دهد.
        </p>
      )}

      <div className="flow-scroll">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="نمودار مسیر فرم"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="arrow-head" />
            </marker>
          </defs>

          {graph.edges.map((edge, i) => (
            <Edge
              key={`${edge.from}-${edge.to ?? 'end'}-${i}`}
              edge={edge}
              lane={
                edge.kind === 'skip'
                  ? skipEdges.findIndex((e) => e === edge)
                  : -1
              }
              fromY={yOf(edge.from)}
              toY={yOf(edge.to ?? END_ID)}
              nodeX={nodeX}
              onEdit={
                edge.ruleIndex === undefined
                  ? undefined
                  : () => setEditing(edge.ruleIndex as number)
              }
              onRemove={
                edge.ruleIndex === undefined
                  ? undefined
                  : () => remove(edge.ruleIndex as number)
              }
            />
          ))}

          {nodes.map((node, index) => {
            const y = index * (NODE_H + GAP_Y);
            return (
              <g key={node.id} className="flow-node">
                <rect
                  x={nodeX}
                  y={y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                />
                <text x={nodeX + NODE_W / 2} y={y + 24} textAnchor="middle">
                  {node.title}
                </text>
                <text
                  x={nodeX + NODE_W / 2}
                  y={y + 43}
                  textAnchor="middle"
                  className="node-sub"
                >
                  {node.questionCount} سوال
                </text>
              </g>
            );
          })}

          <g className="flow-node end">
            <rect
              x={nodeX}
              y={nodes.length * (NODE_H + GAP_Y)}
              width={NODE_W}
              height={NODE_H}
              rx={28}
            />
            <text
              x={nodeX + NODE_W / 2}
              y={nodes.length * (NODE_H + GAP_Y) + 35}
              textAnchor="middle"
            >
              پایان فرم
            </text>
          </g>
        </svg>
      </div>

      {editing !== null && (
        <SkipRuleEditor
          pages={pages}
          rule={editing === 'new' ? undefined : rules[editing]}
          onSave={(rule) => save(rule, editing)}
          onCancel={() => setEditing(null)}
        />
      )}

      {rules.length === 0 ? (
        <p className="empty">
          قانون پرشی تعریف نشده؛ فرم صفحه‌به‌صفحه به ترتیب پیش می‌رود.
        </p>
      ) : (
        <ul className="rule-list">
          {rules.map((rule, index) => (
            <li key={index}>
              <span>{describeRule(rule, pages)}</span>
              <span className="edge-actions">
                <button type="button" onClick={() => setEditing(index)}>
                  ویرایش
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => remove(index)}
                >
                  حذف
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface EdgeProps {
  edge: FlowEdge;
  lane: number;
  fromY: number;
  toY: number;
  nodeX: number;
  onEdit?: () => void;
  onRemove?: () => void;
}

function Edge({
  edge,
  lane,
  fromY,
  toY,
  nodeX,
  onEdit,
  onRemove,
}: EdgeProps) {
  const isSkip = edge.kind === 'skip';

  if (!isSkip) {
    // مسیر عادی: خط عمودی از پایین گره به بالای گره بعدی.
    const x = nodeX + NODE_W / 2;
    return (
      <g className={`flow-edge ${edge.kind}`}>
        <path
          d={`M ${x} ${fromY + NODE_H} L ${x} ${toY}`}
          markerEnd="url(#arrow)"
        />
        {edge.label && (
          <text x={x + 8} y={fromY + NODE_H + (toY - fromY - NODE_H) / 2}>
            {edge.label}
          </text>
        )}
      </g>
    );
  }

  // پرش: کمانی از خط کناری، تا با مسیر عادی قاطی نشود.
  const laneX = nodeX + NODE_W + 40 + lane * LANE;
  const startY = fromY + NODE_H / 2;
  const endY = toY + NODE_H / 2;

  return (
    <g className={`flow-edge skip ${edge.conditional ? 'conditional' : ''}`}>
      <path
        d={`M ${nodeX + NODE_W} ${startY}
            C ${laneX} ${startY}, ${laneX} ${endY}, ${nodeX + NODE_W} ${endY}`}
        markerEnd="url(#arrow)"
      />
      <foreignObject
        x={nodeX + NODE_W + 10}
        y={(startY + endY) / 2 - 22}
        width={LANE + 30}
        height={54}
      >
        <div className="edge-label">
          <span title={edge.label}>{edge.label}</span>
          <span className="edge-actions">
            <button type="button" onClick={onEdit}>
              ویرایش
            </button>
            <button type="button" className="danger" onClick={onRemove}>
              حذف
            </button>
          </span>
        </div>
      </foreignObject>
    </g>
  );
}

const OPERATOR_TEXT: Record<string, string> = {
  equals: 'برابر',
  not_equals: 'نابرابر با',
  contains: 'شامل',
  starts_with: 'شروع‌شونده با',
  gt: 'بیشتر از',
  lt: 'کمتر از',
  between: 'بین',
  is_empty: 'خالی باشد',
  is_not_empty: 'خالی نباشد',
};

/**
 * توصیف یک قانون پرش برای فهرست زیر بوم.
 *
 * برچسب یال‌ها را سرور می‌سازد (تا یک تعریف بیشتر نباشد)، ولی فهرست باید
 * قوانین ذخیره‌نشده را هم نشان بدهد و آن‌ها هنوز به سرور نرفته‌اند.
 */
function describeRule(rule: SkipRule, pages: FormPage[]): string {
  const pageTitle = (id?: string) =>
    pages.find((p) => p.id === id)?.title || id || '؟';

  const questionTitle = (id: string) => {
    if (id.startsWith('param.')) return `پارامتر ${id.slice(6)}`;
    if (id.startsWith('score.')) return `شاخص ${id.slice(6)}`;
    for (const page of pages) {
      const found = (page.questions ?? []).find((q) => q.id === id);
      if (found) return found.title || id;
    }
    return id;
  };

  const from = pageTitle(rule.fromPageId);
  const to = rule.toEnd ? 'پایان فرم' : pageTitle(rule.toPageId);
  const condition = rule.when?.conditions?.[0];

  if (!condition) return `پس از «${from}» همیشه برو به «${to}»`;

  const operator = OPERATOR_TEXT[condition.operator] ?? condition.operator;
  const value =
    condition.operator === 'is_empty' || condition.operator === 'is_not_empty'
      ? ''
      : ` ${String(condition.value)}`;

  return `پس از «${from}» اگر ${questionTitle(
    condition.source,
  )} ${operator}${value} برو به «${to}»`;
}
