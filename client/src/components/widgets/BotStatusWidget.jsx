import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import WidgetError from './WidgetError';

// Reads /api/bot/status (singleton heartbeat written every 5 min by the
// bot's HealthMonitor). Refreshes every 60s in the foreground so the
// status pill stays current without polling too aggressively.
export default function BotStatusWidget() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(null);
  const [reason, setReason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    api.get('/bot/status')
      .then((res) => {
        setStatus(res.data.data);
        setReason(res.data.reason || null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <WidgetShell title={t('widgets.botStatus')}><Skeleton /></WidgetShell>;
  if (error) return <WidgetShell title={t('widgets.botStatus')}><WidgetError onRetry={fetchData} /></WidgetShell>;

  // No heartbeat written yet (fresh install / bot never ran)
  if (!status && reason === 'NO_HEARTBEAT_YET') {
    return (
      <WidgetShell title={t('widgets.botStatus')}>
        <p className="text-sm text-gray-500 dark:text-dark-muted">
          {t('botStatus.noHeartbeat')}
        </p>
      </WidgetShell>
    );
  }

  const running = !!status?.running;
  const fresh = !!status?._fresh;
  const killed = !!status?.kill_switch;
  const dailyPnl = Number(status?.daily_pnl ?? 0);
  const losses = Number(status?.consecutive_losses ?? 0);
  const openPositions = Number(status?.open_positions ?? 0);

  // Pill color logic: red if kill switch or stale, accent if running+fresh,
  // amber if running but stale (likely connectivity issue, not a crash).
  let pillColor = 'bg-red-500';
  let pillLabel = t('botStatus.down');
  if (killed) {
    pillColor = 'bg-red-500';
    pillLabel = t('botStatus.killed');
  } else if (running && fresh) {
    pillColor = 'bg-accent';
    pillLabel = t('botStatus.live');
  } else if (running && !fresh) {
    pillColor = 'bg-amber-500';
    pillLabel = t('botStatus.stale');
  }

  return (
    <WidgetShell title={t('widgets.botStatus')}>
      <div className="space-y-4">
        {/* Status pill — the headline */}
        <div className="flex items-center gap-2">
          <span className={`inline-block w-3 h-3 rounded-full ${pillColor} ${running && fresh ? 'animate-pulse' : ''}`} />
          <span className="font-semibold text-gray-900 dark:text-dark-text">
            {pillLabel}
          </span>
          {status?._ageMs != null && (
            <span className="text-xs text-gray-400 dark:text-dark-muted ml-auto">
              {formatAge(status._ageMs)}
            </span>
          )}
        </div>

        {/* Kill switch banner — only shown if active */}
        {killed && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-500 font-semibold">
            {t('botStatus.killSwitchActive')}
          </div>
        )}

        {/* Quick vitals grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Vital label={t('botStatus.dailyPnl')} value={formatPnl(dailyPnl)}
            color={dailyPnl > 0 ? 'text-accent' : dailyPnl < 0 ? 'text-red-500' : ''} />
          <Vital label={t('botStatus.openPositions')} value={openPositions} />
          <Vital label={t('botStatus.consecutiveLosses')} value={losses}
            color={losses >= 3 ? 'text-red-500' : ''} />
          <Vital label={t('botStatus.ws')}
            value={status?.ws_alive ? t('botStatus.up') : t('botStatus.down')}
            color={status?.ws_alive ? 'text-accent' : 'text-red-500'} />
        </div>
      </div>
    </WidgetShell>
  );
}

function Vital({ label, value, color = '' }) {
  return (
    <div>
      <div className="text-xs text-gray-400 dark:text-dark-muted uppercase tracking-wider">
        {label}
      </div>
      <div className={`font-semibold ${color || 'text-gray-900 dark:text-dark-text'}`}>
        {value}
      </div>
    </div>
  );
}

function formatPnl(v) {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)} $`;
}

function formatAge(ms) {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return `${h}h`;
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
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-gray-100 dark:bg-dark-bg3" />
        <div className="h-4 w-24 bg-gray-100 dark:bg-dark-bg3 rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 bg-gray-100 dark:bg-dark-bg3 rounded" />
            <div className="h-5 w-20 bg-gray-100 dark:bg-dark-bg3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
