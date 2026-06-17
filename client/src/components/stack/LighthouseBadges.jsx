import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

// Mimics the official Lighthouse color scale:
//   0–49   red (poor)
//   50–89  orange (needs improvement)
//   90–100 green (good)
function colorFor(score) {
  if (score == null) return { stroke: '#6b7280', text: 'text-gray-500' };
  if (score >= 90) return { stroke: '#00ff88', text: 'text-accent' };
  if (score >= 50) return { stroke: '#f59e0b', text: 'text-orange-500' };
  return { stroke: '#ef4444', text: 'text-red-500' };
}

const STROKE_WIDTH = 6;
const RADIUS = 36;
const CIRC = 2 * Math.PI * RADIUS;

function CircularBadge({ label, score }) {
  const { stroke, text } = colorFor(score);
  const offset = score == null ? CIRC : CIRC - (score / 100) * CIRC;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className="text-gray-200 dark:text-dark-bg3"
          />
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            stroke={stroke}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div
          className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${text}`}
        >
          {score ?? '—'}
        </div>
      </div>
      <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-dark-muted text-center">
        {label}
      </div>
    </div>
  );
}

function StrategyTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
        active
          ? 'bg-white dark:bg-dark-bg2 text-accent shadow-sm'
          : 'text-gray-600 dark:text-dark-muted hover:text-accent'
      }`}
    >
      {children}
    </button>
  );
}

export default function LighthouseBadges() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [strategy, setStrategy] = useState('mobile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get('/lighthouse/latest')
      .then((res) => setData(res.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (error) return null;

  const scores = data?.[strategy];
  // If we have NEITHER mobile nor desktop yet, don't render. First scores
  // will land after the first cron run.
  if (!data?.mobile && !data?.desktop) return null;

  const items = [
    { key: 'performance', label: t('stack.lighthouse.performance') },
    { key: 'accessibility', label: t('stack.lighthouse.accessibility') },
    { key: 'bestPractices', label: t('stack.lighthouse.bestPractices') },
    { key: 'seo', label: t('stack.lighthouse.seo') },
  ];

  const fetchedAt = scores?.fetchedAt ? new Date(scores.fetchedAt) : null;

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
          {t('stack.lighthouse.title')}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-dark-bg3 rounded-lg p-1">
            <StrategyTab active={strategy === 'mobile'} onClick={() => setStrategy('mobile')}>
              {t('stack.lighthouse.mobile')}
            </StrategyTab>
            <StrategyTab active={strategy === 'desktop'} onClick={() => setStrategy('desktop')}>
              {t('stack.lighthouse.desktop')}
            </StrategyTab>
          </div>
        </div>
      </div>

      <p className="text-gray-600 dark:text-dark-muted mb-6 text-sm">
        {t('stack.lighthouse.hint')}
      </p>

      <div className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg2 p-6 md:p-8">
        {scores ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {items.map((it) => (
                <CircularBadge key={it.key} label={it.label} score={scores[it.key]} />
              ))}
            </div>
            {fetchedAt && (
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-dark-border text-xs text-gray-400 dark:text-dark-muted text-center">
                {t('stack.lighthouse.measuredAt')}{' '}
                {fetchedAt.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {' · '}
                <a
                  href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(
                    data.url
                  )}&form_factor=${strategy}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  {t('stack.lighthouse.verifyOnGoogle')}
                </a>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-gray-500 dark:text-dark-muted py-12">
            {t('stack.lighthouse.notYetAvailable')}
          </p>
        )}
      </div>
    </section>
  );
}
