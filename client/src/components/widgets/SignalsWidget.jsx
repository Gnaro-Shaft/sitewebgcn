import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import WidgetError from './WidgetError';

const LEVEL_LABELS = {
  '-2': { label: 'Strong Sell', color: 'bg-red-500' },
  '-1': { label: 'Sell', color: 'bg-red-400' },
  '0': { label: 'Neutral', color: 'bg-gray-400' },
  '1': { label: 'Buy', color: 'bg-accent/70' },
  '2': { label: 'Strong Buy', color: 'bg-accent' },
};

export default function SignalsWidget() {
  const { t } = useTranslation();
  const [signals, setSignals] = useState([]);
  const [distribution, setDistribution] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    api.get('/trading/signals?limit=50')
      .then((res) => {
        setSignals(res.data.data || []);
        setDistribution(res.data.distribution || {});
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <WidgetShell title={t('widgets.signals')}><Skeleton /></WidgetShell>;
  if (error) return <WidgetShell title={t('widgets.signals')}><WidgetError onRetry={fetchData} /></WidgetShell>;

  const total = Object.values(distribution).reduce((s, v) => s + v, 0);

  return (
    <WidgetShell title={t('widgets.signals')}>
      {/* Distribution bars */}
      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-3">
        {t('widgets.signalDistribution')} ({total})
      </h4>
      <div className="space-y-2 mb-4">
        {Object.entries(LEVEL_LABELS).map(([level, { label, color }]) => {
          const count = distribution[level] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={level} className="flex items-center gap-2">
              <span className="text-xs w-20 text-right text-gray-500 dark:text-dark-muted shrink-0">{label}</span>
              <div className="flex-1 h-4 rounded-full bg-gray-100 dark:bg-dark-bg3 overflow-hidden">
                <div
                  className={`h-full rounded-full ${color} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs w-8 text-gray-400 dark:text-dark-muted">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Recent signals */}
      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-3">
        {t('widgets.lastSignals')}
      </h4>
      {signals.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-dark-muted">{t('widgets.noSignals')}</p>
      ) : (
        <div className="space-y-1.5">
          {signals.slice(0, 8).map((s, i) => {
            const score = s.signal_score || 0;
            const info = LEVEL_LABELS[String(score)] || LEVEL_LABELS['0'];
            return (
              <div key={i} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${info.color}`} />
                  <span className="text-sm text-gray-700 dark:text-dark-text">{s.coin || 'BTC'}</span>
                  <span className="text-xs text-gray-400 dark:text-dark-muted">
                    {formatTime(s.timestamp)}
                  </span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  score >= 1 ? 'text-accent bg-accent/10' :
                  score <= -1 ? 'text-red-500 bg-red-500/10' :
                  'text-gray-500 bg-gray-100 dark:bg-dark-bg3'
                }`}>
                  {score > 0 ? '+' : ''}{score}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts).slice(0, 16);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function WidgetShell({ title, children }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 h-full">
      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-32 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-4 bg-gray-100 dark:bg-dark-bg3 rounded" />)}
      </div>
      <div className="h-4 w-24 bg-gray-100 dark:bg-dark-bg3 rounded" />
      {[1, 2, 3].map((i) => <div key={i} className="h-6 bg-gray-100 dark:bg-dark-bg3 rounded" />)}
    </div>
  );
}
