import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import WidgetError from './WidgetError';

export default function TradesWidget() {
  const { t } = useTranslation();
  const [openPositions, setOpenPositions] = useState([]);
  const [recentTrades, setRecentTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      api.get('/trading/trades/open'),
      api.get('/trading/trades?limit=10'),
    ])
      .then(([openRes, recentRes]) => {
        setOpenPositions(openRes.data.data || []);
        setRecentTrades(recentRes.data.data || []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <WidgetShell title={t('widgets.trades')}><Skeleton /></WidgetShell>;
  if (error) return <WidgetShell title={t('widgets.trades')}><WidgetError onRetry={fetchData} /></WidgetShell>;

  return (
    <WidgetShell title={t('widgets.trades')}>
      {/* Open positions */}
      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-3">
        {t('widgets.openPositions')}
      </h4>
      {openPositions.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-dark-muted mb-4">{t('widgets.noOpenPositions')}</p>
      ) : (
        <div className="space-y-2 mb-4">
          {openPositions.map((t, i) => {
            const pnl = parseFloat(t.unrealized_pnl || 0);
            const isProfit = pnl >= 0;
            return (
              <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-dark-bg3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      t.side === 'long'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-red-500/15 text-red-500'
                    }`}>
                      {(t.side || '').toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-dark-text">
                      {t.coin || t.pair}
                    </span>
                    {t.leverage && (
                      <span className="text-xs text-gray-400 dark:text-dark-muted">{t.leverage}x</span>
                    )}
                  </div>
                  <span className={`text-sm font-bold ${isProfit ? 'text-accent' : 'text-red-500'}`}>
                    {isProfit ? '+' : ''}{pnl.toFixed(2)} USDC
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-muted">
                  <span>Entry: ${parseFloat(t.entry_price || 0).toLocaleString()}</span>
                  <span>Size: {t.size}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent closed trades */}
      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-3">
        {t('widgets.recentTrades')}
      </h4>
      {recentTrades.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-dark-muted">{t('widgets.noTrades')}</p>
      ) : (
        <div className="space-y-1.5">
          {recentTrades.filter((t) => t.action === 'close').slice(0, 5).map((t, i) => {
            const pnl = parseFloat(t.pnl || 0);
            const isWin = pnl > 0;
            return (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-dark-text">{t.pair}</span>
                  <span className="text-xs text-gray-400 dark:text-dark-muted">{t.reason}</span>
                </div>
                <span className={`text-sm font-semibold ${isWin ? 'text-accent' : 'text-red-500'}`}>
                  {isWin ? '+' : ''}{pnl.toFixed(2)} USDC
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
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
      <div className="h-4 w-24 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="h-12 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="h-4 w-24 bg-gray-100 dark:bg-dark-bg3 rounded" />
      {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-100 dark:bg-dark-bg3 rounded" />)}
    </div>
  );
}
