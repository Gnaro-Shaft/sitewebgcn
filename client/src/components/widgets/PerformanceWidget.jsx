import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

export default function PerformanceWidget() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.get('/trading/performance?days=30')
      .then((res) => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Draw cumulative PnL chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data?.cumulativePnl?.length) return;

    const ctx = canvas.getContext('2d');
    const points = data.cumulativePnl;
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.clearRect(0, 0, w, h);

    const values = points.map((p) => p.cumulative);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const range = max - min || 1;

    // Zero line
    const zeroY = h - ((0 - min) / range) * h * 0.8 - h * 0.1;
    ctx.strokeStyle = 'rgba(150,150,150,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(w, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // PnL line
    const isUp = values[values.length - 1] >= 0;
    const color = isUp ? '#00ff88' : '#ff4444';

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    points.forEach((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.cumulative - min) / range) * h * 0.8 - h * 0.1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill to zero
    const lastX = ((points.length - 1) / (points.length - 1)) * w;
    ctx.lineTo(lastX, zeroY);
    ctx.lineTo(0, zeroY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isUp ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }, [data]);

  if (loading) return <WidgetShell title={t('widgets.performance')}><Skeleton /></WidgetShell>;
  if (!data) return <WidgetShell title={t('widgets.performance')}><p className="text-sm text-gray-400">No data</p></WidgetShell>;

  const pnlColor = data.totalPnl >= 0 ? 'text-accent' : 'text-red-500';

  return (
    <WidgetShell title={t('widgets.performance')}>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatBox label={t('widgets.winrate')} value={`${data.winrate}%`} accent={data.winrate >= 50} />
        <StatBox label={t('widgets.profitFactor')} value={data.profitFactor} accent={parseFloat(data.profitFactor) > 1} />
        <StatBox label="Total PnL" value={`${data.totalPnl >= 0 ? '+' : ''}${data.totalPnl}`} accent={data.totalPnl >= 0} />
        <StatBox label={t('widgets.totalTrades')} value={`${data.wins}W / ${data.losses}L`} />
      </div>

      {/* Avg win/loss */}
      <div className="flex justify-between text-xs mb-4 px-1">
        <span className="text-gray-400 dark:text-dark-muted">
          {t('widgets.avgWin')}: <span className="text-accent font-medium">+{data.avgWin}</span>
        </span>
        <span className="text-gray-400 dark:text-dark-muted">
          {t('widgets.avgLoss')}: <span className="text-red-500 font-medium">-{data.avgLoss}</span>
        </span>
      </div>

      {/* Cumulative PnL chart */}
      {data.cumulativePnl?.length > 0 && (
        <>
          <div className="h-20 w-full">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>
          <p className="text-xs text-gray-400 dark:text-dark-muted text-center mt-1">
            {t('widgets.cumulativePnl')} — {data.days} {t('widgets.days')}
          </p>
        </>
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

function StatBox({ label, value, accent }) {
  return (
    <div className="text-center p-2.5 rounded-lg bg-gray-50 dark:bg-dark-bg3">
      <div className={`text-lg font-bold ${accent ? 'text-accent' : 'text-gray-900 dark:text-dark-text'}`}>
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-dark-muted mt-0.5">{label}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-lg bg-gray-100 dark:bg-dark-bg3" />)}
      </div>
      <div className="h-20 bg-gray-100 dark:bg-dark-bg3 rounded" />
    </div>
  );
}
