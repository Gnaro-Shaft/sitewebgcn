import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const TOP_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
  { id: 'tron', symbol: 'TRX', name: 'TRON' },
  { id: 'matic-network', symbol: 'MATIC', name: 'Polygon' },
  { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
  { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
];

export default function CryptoWidget() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(() => localStorage.getItem('crypto-selected') || 'bitcoin');
  const [price, setPrice] = useState(null);
  const [change24h, setChange24h] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const canvasRef = useRef(null);

  const coin = TOP_COINS.find((c) => c.id === selected) || TOP_COINS[0];

  const fetchData = useCallback((coinId) => {
    setLoading(true);
    Promise.all([
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`).then((r) => r.json()),
      fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=daily`).then((r) => r.json()),
    ])
      .then(([priceData, chart]) => {
        if (priceData?.[coinId]) {
          setPrice(priceData[coinId].usd);
          setChange24h(priceData[coinId].usd_24h_change);
        }
        if (chart?.prices) {
          setChartData(chart.prices.map(([, p]) => p));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch on mount and when coin changes
  useEffect(() => {
    fetchData(selected);
    localStorage.setItem('crypto-selected', selected);
  }, [selected, fetchData]);

  // Auto-refresh price every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${selected}&vs_currencies=usd&include_24hr_change=true`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.[selected]) {
            setPrice(data[selected].usd);
            setChange24h(data[selected].usd_24h_change);
          }
        })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [selected]);

  // Draw mini chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartData.length < 2) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...chartData);
    const max = Math.max(...chartData);
    const range = max - min || 1;

    const isUp = chartData[chartData.length - 1] >= chartData[0];
    const color = isUp ? '#00ff88' : '#ff4444';

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    chartData.forEach((val, i) => {
      const x = (i / (chartData.length - 1)) * w;
      const y = h - ((val - min) / range) * h * 0.8 - h * 0.1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill
    const last = chartData.length - 1;
    ctx.lineTo((last / (chartData.length - 1)) * w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, isUp ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();
  }, [chartData]);

  const isUp = change24h >= 0;

  // Format price based on value
  const formatPrice = (p) => {
    if (!p) return '$0';
    if (p >= 1) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return '$' + p.toFixed(6);
  };

  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 h-full">
      {/* Header with coin selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-dark-text">{t('widgets.crypto')}</h3>

        {/* Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-border transition-colors bg-gray-50 dark:bg-dark-bg3"
          >
            <span className="text-accent font-bold">{coin.symbol}</span>
            <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 w-48 max-h-64 overflow-y-auto bg-white dark:bg-dark-bg2 border border-gray-200 dark:border-dark-border rounded-xl shadow-xl">
                {TOP_COINS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelected(c.id); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-dark-bg3 transition-colors ${
                      c.id === selected ? 'text-accent font-medium' : 'text-gray-700 dark:text-dark-text'
                    }`}
                  >
                    <span className="font-bold w-12">{c.symbol}</span>
                    <span className="text-gray-400 dark:text-dark-muted">{c.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <Skeleton />
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-3xl font-bold text-gray-900 dark:text-dark-text">
              {formatPrice(price)}
            </span>
            {change24h != null && (
              <span className={`text-sm font-semibold ${isUp ? 'text-accent' : 'text-red-500'}`}>
                {isUp ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-dark-muted mb-4">{t('widgets.change24h')} — {t('widgets.autoRefresh')}</p>

          {/* Mini chart */}
          <div className="h-24 w-full">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>
          <p className="text-xs text-gray-400 dark:text-dark-muted text-center mt-2">{t('widgets.chart7d')}</p>
        </>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 w-40 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="h-4 w-24 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="h-24 bg-gray-100 dark:bg-dark-bg3 rounded" />
    </div>
  );
}
