import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { isAdminBrowser, setAdminBrowser } from '../utils/analytics';

const PERIODS = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
  { id: 'custom', label: 'Custom' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('7d');
  const [customStart, setCustomStart] = useState(daysAgoIso(7));
  const [customEnd, setCustomEnd] = useState(todayIso());
  const [appliedRange, setAppliedRange] = useState(null);
  const [data, setData] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [excluded, setExcluded] = useState(isAdminBrowser());

  const toggleExcluded = () => {
    const next = !excluded;
    setAdminBrowser(next);
    setExcluded(next);
  };

  const queryString = useMemo(() => {
    if (period === 'custom' && appliedRange) {
      const start = new Date(appliedRange.start).toISOString();
      const end = new Date(appliedRange.end + 'T23:59:59').toISOString();
      return `start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    }
    return `period=${period}`;
  }, [period, appliedRange]);

  const fetchData = useCallback(() => {
    if (period === 'custom' && !appliedRange) return;
    setLoading(true);
    setError(false);
    Promise.all([
      api.get(`/analytics/summary?${queryString}`),
      api.get(`/analytics/articles?${queryString}`),
    ])
      .then(([sum, art]) => {
        setData(sum.data.data);
        setArticles(art.data.data || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [queryString, period, appliedRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    setAppliedRange({ start: customStart, end: customEnd });
  };

  const downloadCsv = (rows, suffix) => {
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAggregated = () => {
    if (!data) return;
    setExportMenu(false);
    const rows = [
      ['type', 'key', 'views'],
      ...data.topPages.map((p) => ['page', p.path, p.views]),
      ...data.topReferrers.map((r) => ['referrer', r.source || 'direct', r.views]),
      ...data.countries.map((c) => ['country', c.country, c.views]),
      ...data.deviceSplit.map((d) => ['device', d.device, d.views]),
      ...articles.map((a) => ['article', a.slug, a.views]),
    ];
    downloadCsv(rows, `aggregated-${period}`);
  };

  const exportDetailed = async () => {
    setExportMenu(false);
    try {
      const res = await api.get(`/analytics/timeseries?${queryString}`);
      const { rows: tsRows, granularity } = res.data.data;
      const rows = [
        ['bucket', 'granularity', 'views', 'unique', 'mobile', 'tablet', 'desktop'],
        ...tsRows.map((r) => [
          r.bucket,
          granularity,
          r.views,
          r.unique,
          r.mobile,
          r.tablet,
          r.desktop,
        ]),
      ];
      downloadCsv(rows, `detailed-${period}-${granularity}`);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-dark-bg2/80 backdrop-blur-md border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-xl font-bold tracking-tight text-gray-900 dark:text-dark-text">
              G<span className="text-accent">.</span>
            </Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <Link to="/dashboard" className="text-sm text-gray-500 hover:text-accent dark:text-dark-muted">
              Dashboard
            </Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <span className="text-sm font-medium text-gray-900 dark:text-dark-text">{t('widgets.analytics')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-dark-bg3 rounded-lg p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    period === p.id
                      ? 'bg-white dark:bg-dark-bg2 text-accent shadow-sm'
                      : 'text-gray-600 dark:text-dark-muted hover:text-accent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <button
                onClick={() => setExportMenu((v) => !v)}
                disabled={!data}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-dark-muted hover:text-accent border border-gray-200 dark:border-dark-border hover:border-accent rounded-lg transition-colors disabled:opacity-50"
              >
                {t('analytics.exportCsv')} ▾
              </button>
              {exportMenu && (
                <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-dark-bg2 border border-gray-200 dark:border-dark-border rounded-lg shadow-lg z-50 overflow-hidden">
                  <button
                    onClick={exportAggregated}
                    className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-dark-bg3"
                  >
                    <div className="font-medium text-gray-900 dark:text-dark-text">
                      {t('analytics.exportAggregated')}
                    </div>
                    <div className="text-gray-500 dark:text-dark-muted">{t('analytics.exportAggregatedHint')}</div>
                  </button>
                  <button
                    onClick={exportDetailed}
                    className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-dark-bg3 border-t border-gray-100 dark:border-dark-border"
                  >
                    <div className="font-medium text-gray-900 dark:text-dark-text">
                      {t('analytics.exportDetailed')}
                    </div>
                    <div className="text-gray-500 dark:text-dark-muted">{t('analytics.exportDetailedHint')}</div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
            {t('analytics.title')}
          </h1>
          <button
            onClick={toggleExcluded}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              excluded
                ? 'bg-accent/10 border-accent text-accent'
                : 'border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-muted hover:border-accent hover:text-accent'
            }`}
            title={t('analytics.excludeHint')}
          >
            <span className={`w-2 h-2 rounded-full ${excluded ? 'bg-accent' : 'bg-gray-300 dark:bg-dark-muted'}`} />
            {excluded ? t('analytics.excluded') : t('analytics.excludeMe')}
          </button>
        </div>

        {period === 'custom' && (
          <div className="mb-6 p-4 bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">{t('analytics.startDate')}</label>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg3 border border-gray-200 dark:border-dark-border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-dark-muted mb-1">{t('analytics.endDate')}</label>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={todayIso()}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 text-sm bg-gray-50 dark:bg-dark-bg3 border border-gray-200 dark:border-dark-border rounded-lg"
              />
            </div>
            <button
              onClick={applyCustom}
              className="px-4 py-1.5 text-sm font-medium bg-accent hover:bg-accent-hover text-dark-bg rounded-lg transition-colors"
            >
              {t('analytics.apply')}
            </button>
            {appliedRange && (
              <span className="text-xs text-gray-500 dark:text-dark-muted">
                {appliedRange.start} → {appliedRange.end}
              </span>
            )}
          </div>
        )}

        {loading && <div className="text-gray-400 dark:text-dark-muted">Loading…</div>}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg">
            {t('analytics.loadError')}
          </div>
        )}
        {period === 'custom' && !appliedRange && !loading && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-lg text-sm">
            {t('analytics.pickDates')}
          </div>
        )}

        {data && !loading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <KPI label={t('analytics.totalViews')} value={data.totalViews} accent />
              <KPI label={t('widgets.uniqueVisitors')} value={data.uniqueVisitors} />
              <KPI
                label={t('widgets.mobile')}
                value={`${pct(data.deviceSplit.find((d) => d.device === 'mobile')?.views || 0, data.totalViews)}%`}
              />
              <KPI label={t('analytics.pages')} value={data.topPages.length} />
            </div>

            <Card title={data.granularity === 'hour' ? t('analytics.hourlyTrend') : t('widgets.dailyTrend')}>
              <BucketChart daily={data.daily} granularity={data.granularity} />
            </Card>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Card title={t('widgets.topPages')}>
                <List items={data.topPages.map((p) => ({ key: p.path, value: p.views, mono: true }))} />
              </Card>
              <Card title={t('widgets.topReferrers')}>
                <List
                  items={data.topReferrers.map((r) => ({ key: r.source || 'direct', value: r.views }))}
                  empty={t('analytics.noReferrers')}
                />
              </Card>
              <Card title={t('analytics.devices')}>
                <List items={data.deviceSplit.map((d) => ({ key: d.device, value: d.views }))} />
              </Card>
              <Card title={t('analytics.countries')}>
                <List
                  items={data.countries.map((c) => ({ key: c.country, value: c.views }))}
                  empty={t('analytics.noCountries')}
                />
              </Card>
            </div>

            {articles.length > 0 && (
              <div className="mt-4">
                <Card title={t('analytics.topArticles')}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 dark:text-dark-muted uppercase tracking-wider">
                        <th className="py-2">{t('analytics.slug')}</th>
                        <th className="py-2 text-right">{t('analytics.views')}</th>
                        <th className="py-2 text-right">{t('analytics.unique')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {articles.map((a) => (
                        <tr key={a.slug} className="border-t border-gray-100 dark:border-dark-border">
                          <td className="py-2 font-mono text-xs text-gray-700 dark:text-dark-text">{a.slug}</td>
                          <td className="py-2 text-right text-accent font-medium">{a.views}</td>
                          <td className="py-2 text-right text-gray-500 dark:text-dark-muted">{a.unique}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function pct(part, total) {
  return total ? Math.round((part / total) * 100) : 0;
}

function KPI({ label, value, accent }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-5">
      <div className={`text-3xl font-bold ${accent ? 'text-accent' : 'text-gray-900 dark:text-dark-text'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-dark-muted mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-5">
      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-3">{title}</h3>
      {children}
    </div>
  );
}

function List({ items, empty, mono }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-dark-muted">{empty || 'No data'}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2">
      {items.slice(0, 10).map((item) => (
        <li key={item.key} className="relative">
          <div className="flex items-center justify-between gap-2 text-sm relative z-10 px-2 py-1">
            <span className={`text-gray-700 dark:text-dark-text truncate ${item.mono || mono ? 'font-mono text-xs' : ''}`}>
              {item.key}
            </span>
            <span className="text-xs text-accent font-medium shrink-0">{item.value}</span>
          </div>
          <div
            className="absolute inset-0 bg-accent/10 rounded"
            style={{ width: `${(item.value / max) * 100}%` }}
          />
        </li>
      ))}
    </ul>
  );
}

function formatBucket(b, granularity) {
  if (granularity === 'hour') {
    const [date, hour] = b.split('T');
    return `${date} ${hour}`;
  }
  return b;
}

function BucketChart({ daily, granularity }) {
  if (!daily.length) return <p className="text-sm text-gray-400 dark:text-dark-muted">No data</p>;
  const max = Math.max(...daily.map((d) => d.views), 1);
  return (
    <div>
      <div className="flex items-end gap-1 h-32">
        {daily.map((d) => (
          <div key={d.bucket} className="flex-1 flex flex-col items-center justify-end group relative">
            <div
              className="w-full bg-accent/40 hover:bg-accent rounded-t transition-colors"
              style={{ height: `${(d.views / max) * 100}%`, minHeight: '2px' }}
            />
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
              {formatBucket(d.bucket, granularity)}: {d.views} ({d.unique} unique)
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-dark-muted">
        <span>{formatBucket(daily[0]?.bucket, granularity)}</span>
        <span>{formatBucket(daily[daily.length - 1]?.bucket, granularity)}</span>
      </div>
    </div>
  );
}
