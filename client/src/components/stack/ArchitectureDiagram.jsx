import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Architecture diagram — interactive boxes with hover tooltips
// Shows: Visitor → Fly.io app → Frontend/Backend → DB + External APIs
export default function ArchitectureDiagram() {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(null);

  const nodes = [
    { id: 'visitor', label: t('stack.diagram.visitor'), x: 400, y: 30, w: 160, h: 50, kind: 'actor', tooltip: t('stack.diagram.visitorTip') },
    { id: 'fly', label: 'Fly.io · Paris', x: 360, y: 130, w: 240, h: 60, kind: 'infra', tooltip: t('stack.diagram.flyTip') },
    { id: 'frontend', label: 'React 19 + Vite', x: 180, y: 240, w: 200, h: 60, kind: 'frontend', tooltip: t('stack.diagram.frontendTip') },
    { id: 'backend', label: 'Node + Express MVC', x: 580, y: 240, w: 220, h: 60, kind: 'backend', tooltip: t('stack.diagram.backendTip') },
    { id: 'mongo', label: 'MongoDB Atlas', x: 60, y: 360, w: 180, h: 50, kind: 'db', tooltip: t('stack.diagram.mongoTip') },
    { id: 'claude', label: 'Anthropic Claude', x: 270, y: 360, w: 180, h: 50, kind: 'external', tooltip: t('stack.diagram.claudeTip') },
    { id: 'github', label: 'GitHub API', x: 480, y: 360, w: 160, h: 50, kind: 'external', tooltip: t('stack.diagram.githubTip') },
    { id: 'hyper', label: 'Hyperliquid API', x: 670, y: 360, w: 180, h: 50, kind: 'external', tooltip: t('stack.diagram.hyperTip') },
    { id: 'make', label: 'Make.com webhook', x: 880, y: 360, w: 180, h: 50, kind: 'external', tooltip: t('stack.diagram.makeTip') },
    { id: 'linkedin', label: 'LinkedIn', x: 880, y: 460, w: 180, h: 50, kind: 'social', tooltip: t('stack.diagram.linkedinTip') },
  ];

  // Edges: [from, to, optional label, optional dashed]
  const edges = [
    ['visitor', 'fly', 'HTTPS', false],
    ['fly', 'frontend', '', false],
    ['fly', 'backend', '/api/*', false],
    ['backend', 'mongo', '', false],
    ['backend', 'claude', '', false],
    ['backend', 'github', '', false],
    ['backend', 'hyper', '', false],
    ['backend', 'make', 'webhook', false],
    ['make', 'linkedin', '', true],
  ];

  const colors = {
    actor: { fill: '#0a0a0a', stroke: '#00ff88', text: '#00ff88' },
    infra: { fill: 'rgba(0,255,136,0.08)', stroke: '#00ff88', text: '#00ff88' },
    frontend: { fill: 'rgba(99,102,241,0.08)', stroke: '#6366f1', text: '#6366f1' },
    backend: { fill: 'rgba(245,158,11,0.08)', stroke: '#f59e0b', text: '#f59e0b' },
    db: { fill: 'rgba(34,197,94,0.08)', stroke: '#22c55e', text: '#22c55e' },
    external: { fill: 'rgba(168,85,247,0.08)', stroke: '#a855f7', text: '#a855f7' },
    social: { fill: 'rgba(14,165,233,0.08)', stroke: '#0ea5e9', text: '#0ea5e9' },
  };

  const findNode = (id) => nodes.find((n) => n.id === id);

  return (
    <div className="relative">
      <svg
        viewBox="0 0 1100 540"
        className="w-full h-auto"
        style={{ minWidth: '700px' }}
        role="img"
        aria-label="Architecture diagram"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-gray-400 dark:text-dark-muted" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map(([fromId, toId, label, dashed], i) => {
          const from = findNode(fromId);
          const to = findNode(toId);
          if (!from || !to) return null;
          const x1 = from.x + from.w / 2;
          const y1 = from.y + from.h;
          const x2 = to.x + to.w / 2;
          const y2 = to.y;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray={dashed ? '4 4' : '0'}
                markerEnd="url(#arrow)"
                className="text-gray-400 dark:text-dark-muted"
              />
              {label && (
                <text
                  x={midX}
                  y={midY - 5}
                  textAnchor="middle"
                  fontSize="11"
                  fill="currentColor"
                  className="text-gray-500 dark:text-dark-muted"
                  fontFamily="ui-monospace, monospace"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => {
          const c = colors[n.kind];
          const isHover = hovered === n.id;
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={10}
                ry={10}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth={isHover ? '2.5' : '1.5'}
                style={{
                  filter: isHover ? `drop-shadow(0 0 8px ${c.stroke}80)` : 'none',
                  transition: 'all 0.2s',
                }}
              />
              <text
                x={n.x + n.w / 2}
                y={n.y + n.h / 2 + 5}
                textAnchor="middle"
                fontSize="14"
                fontWeight="600"
                fill={c.text}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-dark-bg3 border border-gray-200 dark:border-dark-border">
          <div className="font-semibold text-accent mb-1">{findNode(hovered)?.label}</div>
          <div className="text-sm text-gray-700 dark:text-dark-text">{findNode(hovered)?.tooltip}</div>
        </div>
      )}
      {!hovered && (
        <div className="mt-4 text-center text-xs text-gray-400 dark:text-dark-muted">
          {t('stack.diagram.hoverHint')}
        </div>
      )}
    </div>
  );
}
