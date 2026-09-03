import type { FlowGraph } from '../../types';

interface Props {
  graph: FlowGraph;
}

const NODE_W = 150;
const NODE_H = 56;
const GAP_Y = 40;
const END_ID = '__end__';

/**
 * نمای فلوچارت مسیر فرم (بند ۵ سند).
 *
 * با SVG بومی رسم می‌شود نه React Flow: گراف مسیر یک زنجیره‌ی عمودی با
 * چند یال پرش است، و افزودن یک کتابخانه‌ی سنگین برای این حجم توجیه ندارد.
 */
export function FlowChart({ graph }: Props) {
  const nodes = graph.nodes;
  if (!nodes.length) return <p className="empty">صفحه‌ای برای نمایش نیست.</p>;

  const hasEnd = graph.edges.some((edge) => edge.to === null);
  const rows = nodes.length + (hasEnd ? 1 : 0);
  const height = rows * (NODE_H + GAP_Y);
  const width = 460;
  const centerX = width / 2 - NODE_W / 2;

  const positionOf = (id: string) => {
    if (id === END_ID) return nodes.length * (NODE_H + GAP_Y);
    const index = nodes.findIndex((n) => n.id === id);
    return index < 0 ? 0 : index * (NODE_H + GAP_Y);
  };

  return (
    <div className="flowchart">
      <svg width={width} height={height} role="img" aria-label="نمودار مسیر فرم">
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
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
          </marker>
        </defs>

        {graph.edges.map((edge, i) => {
          const fromY = positionOf(edge.from) + NODE_H;
          const toY = positionOf(edge.to ?? END_ID);
          const isSkip = edge.kind === 'skip';
          // یال‌های پرش از کنار کمانی می‌روند تا با مسیر ترتیبی قاطی نشوند.
          const path = isSkip
            ? `M ${centerX + NODE_W} ${fromY - NODE_H / 2}
               C ${centerX + NODE_W + 90} ${fromY},
                 ${centerX + NODE_W + 90} ${toY},
                 ${centerX + NODE_W} ${toY + NODE_H / 2}`
            : `M ${centerX + NODE_W / 2} ${fromY} L ${centerX + NODE_W / 2} ${toY}`;

          return (
            <path
              key={`${edge.from}-${edge.to ?? 'end'}-${i}`}
              d={path}
              fill="none"
              stroke={isSkip ? '#f59e0b' : '#9ca3af'}
              strokeWidth={isSkip ? 2 : 1.5}
              strokeDasharray={edge.conditional ? '6 4' : undefined}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {nodes.map((node, index) => {
          const y = index * (NODE_H + GAP_Y);
          return (
            <g key={node.id}>
              <rect
                x={centerX}
                y={y}
                width={NODE_W}
                height={NODE_H}
                rx={10}
                fill="#ffffff"
                stroke="#111827"
              />
              <text
                x={centerX + NODE_W / 2}
                y={y + 24}
                textAnchor="middle"
                fontSize="13"
                fill="#111827"
              >
                {node.title}
              </text>
              <text
                x={centerX + NODE_W / 2}
                y={y + 42}
                textAnchor="middle"
                fontSize="11"
                fill="#6b7280"
              >
                {node.questionCount} سوال
              </text>
            </g>
          );
        })}

        {hasEnd && (
          <g>
            <rect
              x={centerX}
              y={nodes.length * (NODE_H + GAP_Y)}
              width={NODE_W}
              height={NODE_H}
              rx={28}
              fill="#111827"
            />
            <text
              x={centerX + NODE_W / 2}
              y={nodes.length * (NODE_H + GAP_Y) + 33}
              textAnchor="middle"
              fontSize="13"
              fill="#ffffff"
            >
              پایان فرم
            </text>
          </g>
        )}
      </svg>

      <ul className="legend">
        <li>
          <span className="line sequential" /> مسیر ترتیبی
        </li>
        <li>
          <span className="line skip" /> پرش
        </li>
        <li>
          <span className="line conditional" /> شرطی
        </li>
      </ul>

      {graph.conditionalQuestions.length > 0 && (
        <p className="hint">
          سوالات شرطی: {graph.conditionalQuestions.join('، ')}
        </p>
      )}
    </div>
  );
}
