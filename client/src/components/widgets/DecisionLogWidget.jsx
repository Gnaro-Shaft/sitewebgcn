import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import WidgetError from './WidgetError';

const MOTIF_COLORS = {
  risk: 'text-red-500 bg-red-500/10 border-red-500/30',
  circuit_breaker: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  correlation: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
  exposure: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/30',
};

export default function DecisionLogWidget() {
  const { t } = useTranslation();
  const [decisions, setDecisions] = useState([]);
  const [summary, setSummary] = useState({ accepted: 0, refused: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [motifFilter, setMotifFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setError(false);

    const params = new URLSearchParams({ limit: '100' });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (motifFilter !== 'all') params.set('motif', motifFilter);

    api.get(`/trading/decisions?${params.toString()}`)
      .then((res) => {
        setDecisions(res.data.data || []);
        setSummary(res.data.summary || { accepted: 0, refused: 0 });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [statusFilter, motifFilter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <WidgetShell title={t('widgets.decisions')}><Skeleton /></WidgetShell>;
  if (error) return <WidgetShell title={t('widgets.decisions')}><WidgetError onRetry={fetchData} /></WidgetShell>;

  return (
    <WidgetShell title={t('widgets.decisions')}>
      {/* Summary header */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <span className="text-accent font-semibold">
          {summary.accepted} {t('decisions.accepted')}
        </span>
        <span className="text-red-500 font-semibold">
          {summary.refused} {t('decisions.refused')}
        </span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: t('decisions.statusAll') },
            { value: 'accepted', label: t('decisions.accepted') },
            { value: 'refused', label: t('decisions.refused') },
          ]}
        />
        <Select
          value={motifFilter}
          onChange={setMotifFilter}
          options={[
            { value: 'all', label: t('decisions.motifAll') },
            { value: 'risk', label: t('decisions.motifRisk') },
            { value: 'circuit_breaker', label: t('decisions.motifCircuitBreaker') },
            { value: 'correlation', label: t('decisions.motifCorrelation') },
            { value: 'exposure', label: t('decisions.motifExposure') },
          ]}
        />
      </div>

      {/* Table */}
      {decisions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-dark-muted">
          {t('decisions.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto max-h-96 -mx-2">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white dark:bg-dark-bg2">
              <tr className="text-left text-gray-400 dark:text-dark-muted uppercase tracking-wider">
                <th className="py-2 px-2 font-medium">{t('decisions.time')}</th>
                <th className="py-2 px-2 font-medium">{t('decisions.pair')}</th>
                <th className="py-2 px-2 font-medium">{t('decisions.side')}</th>
                <th className="py-2 px-2 font-medium text-right">{t('decisions.score')}</th>
                <th className="py-2 px-2 font-medium">{t('decisions.status')}</th>
                <th className="py-2 px-2 font-medium">{t('decisions.motif')}</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d, i) => (
                <DecisionRow key={d._id || i} decision={d} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WidgetShell>
  );
}

function DecisionRow({ decision, t }) {
  const accepted = decision.status === 'accepted';
  const motifStyle = decision.motif ? MOTIF_COLORS[decision.motif] : '';
  const ts = decision.created_at || decision.timestamp;
  const side = decision.side;

  return (
    <tr className="border-t border-gray-100 dark:border-dark-border">
      <td className="py-2 px-2 text-gray-500 dark:text-dark-muted whitespace-nowrap">
        {formatTime(ts)}
      </td>
      <td className="py-2 px-2 font-mono text-gray-700 dark:text-dark-text">
        {decision.pair || decision.coin || '—'}
      </td>
      <td className="py-2 px-2">
        {side && (
          <span className={`font-semibold ${side === 'long' ? 'text-accent' : 'text-red-500'}`}>
            {side}
          </span>
        )}
      </td>
      <td className="py-2 px-2 text-right font-mono text-gray-700 dark:text-dark-text">
        {decision.score != null ? (decision.score > 0 ? `+${decision.score}` : decision.score) : ''}
      </td>
      <td className="py-2 px-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
          accepted ? 'text-accent bg-accent/10' : 'text-red-500 bg-red-500/10'
        }`}>
          {accepted ? t('decisions.accepted') : t('decisions.refused')}
        </span>
      </td>
      <td className="py-2 px-2">
        {decision.motif && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${motifStyle}`}>
            {t(`decisions.motif${capitalize(decision.motif)}`)}
          </span>
        )}
      </td>
    </tr>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg3 text-gray-700 dark:text-dark-text focus:outline-none focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function capitalize(s) {
  if (!s) return '';
  return s
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
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
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-5 bg-gray-100 dark:bg-dark-bg3 rounded" />)}
    </div>
  );
}
