import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import api from '../../api/axios';
import WidgetError from './WidgetError';

export default function AnalyticsWidget() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    api
      .get('/analytics/summary?period=7d')
      .then((res) => setData(res.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Shell title={t('widgets.analytics')}><Skeleton /></Shell>;
  if (error) return <Shell title={t('widgets.analytics')}><WidgetError onRetry={fetchData} /></Shell>;

  const mobile = data.deviceSplit.find((d) => d.device === 'mobile')?.views || 0;
  const mobilePct = data.totalViews ? Math.round((mobile / data.totalViews) * 100) : 0;
  const max = Math.max(...data.daily.map((d) => d.views), 1);

  return (
    <Shell title={t('widgets.analytics')}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label={t('widgets.views7d')} value={data.totalViews} accent />
        <Stat label={t('widgets.uniqueVisitors')} value={data.uniqueVisitors} />
        <Stat label={t('widgets.mobile')} value={`${mobilePct}%`} />
      </div>

      {data.daily.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-2">
            {t('widgets.dailyTrend')}
          </h4>
          <div className="flex items-end gap-1 h-16">
            {data.daily.map((d) => (
              <div
                key={d.date}
                className="flex-1 bg-accent/30 hover:bg-accent rounded-sm transition-colors"
                style={{ height: `${(d.views / max) * 100}%`, minHeight: '2px' }}
                title={`${d.date}: ${d.views} views`}
              />
            ))}
          </div>
        </div>
      )}

      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-2">
        {t('widgets.topPages')}
      </h4>
      {data.topPages.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-dark-muted">{t('widgets.noData')}</p>
      ) : (
        <ul className="space-y-1.5">
          {data.topPages.slice(0, 5).map((p) => (
            <li key={p.path} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-700 dark:text-dark-text truncate font-mono text-xs">
                {p.path}
              </span>
              <span className="text-xs text-accent font-medium shrink-0">{p.views}</span>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/admin/analytics"
        className="mt-4 inline-flex items-center gap-1 text-xs text-accent hover:underline"
      >
        {t('widgets.viewDetails')} →
      </Link>
    </Shell>
  );
}

function Shell({ title, children }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 h-full flex flex-col">
      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-dark-bg3">
      <div className={`text-2xl font-bold ${accent ? 'text-accent' : 'text-gray-900 dark:text-dark-text'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-dark-muted mt-1">{label}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-dark-bg3" />
        ))}
      </div>
      <div className="h-16 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-5 bg-gray-100 dark:bg-dark-bg3 rounded" />
        ))}
      </div>
    </div>
  );
}
