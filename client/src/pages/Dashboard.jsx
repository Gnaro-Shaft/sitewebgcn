import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import BlogStatsWidget from '../components/widgets/BlogStatsWidget';
import GitHubStatsWidget from '../components/widgets/GitHubStatsWidget';
import CryptoWidget from '../components/widgets/BitcoinWidget';
import TradesWidget from '../components/widgets/TradesWidget';
import PerformanceWidget from '../components/widgets/PerformanceWidget';
import SignalsWidget from '../components/widgets/SignalsWidget';
import BlogAIWidget from '../components/widgets/BlogAIWidget';
import WidgetConfig from '../components/widgets/WidgetConfig';
import SessionTimer from '../components/SessionTimer';

const DEFAULT_WIDGETS = [
  { id: 'crypto', label: 'Crypto Live', enabled: true },
  { id: 'github', label: 'GitHub Stats', enabled: true },
  { id: 'blog', label: 'Blog Stats', enabled: true },
  { id: 'blogAi', label: 'Blog AI', enabled: true },
  { id: 'trades', label: 'Trades', enabled: true },
  { id: 'performance', label: 'Algo Performance', enabled: true },
  { id: 'signals', label: 'Signals', enabled: true },
];

const WIDGET_COMPONENTS = {
  crypto: CryptoWidget,
  github: GitHubStatsWidget,
  blog: BlogStatsWidget,
  blogAi: BlogAIWidget,
  trades: TradesWidget,
  performance: PerformanceWidget,
  signals: SignalsWidget,
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [showConfig, setShowConfig] = useState(false);

  // Load widget config
  useEffect(() => {
    api.get('/dashboard/widgets')
      .then((res) => {
        if (Array.isArray(res.data.data) && res.data.data.length > 0) {
          setWidgets(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveConfig = async (newConfig) => {
    try {
      await api.patch('/dashboard/widgets', { widgets: newConfig });
      setWidgets(newConfig);
    } catch {}
    setShowConfig(false);
  };

  const handleLogout = () => {
    navigate('/');
    setTimeout(() => logout(), 10);
  };

  const activeWidgets = widgets.filter((w) => w.enabled);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      {/* Dashboard header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-dark-bg2/80 backdrop-blur-md border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xl font-bold tracking-tight text-gray-900 dark:text-dark-text">
              G<span className="text-accent">.</span>
            </a>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <span className="text-sm font-medium text-gray-900 dark:text-dark-text">Dashboard</span>
          </div>

          <div className="flex items-center gap-4">
            <SessionTimer />
            <button
              onClick={() => setShowConfig(true)}
              className="p-2 text-gray-500 dark:text-dark-muted hover:text-accent transition-colors"
              title={t('dashboard.configWidgets')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <span className="text-sm text-gray-500 dark:text-dark-muted hidden md:block">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-muted hover:text-red-500 transition-colors"
            >
              {t('dashboard.logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Dashboard content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">
            {t('dashboard.welcomeBack')} <span className="text-accent">{user?.email?.split('@')[0]}</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-muted">
            {t('dashboard.subtitle')}
          </p>
        </div>

        {/* Widget grid — only enabled widgets, in order */}
        {activeWidgets.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 dark:text-dark-muted mb-4">{t('dashboard.noWidgets')}</p>
            <button
              onClick={() => setShowConfig(true)}
              className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-dark-bg rounded-lg font-medium transition-all"
            >
              {t('dashboard.configure')}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeWidgets.map((w) => {
              const Component = WIDGET_COMPONENTS[w.id];
              return Component ? <Component key={w.id} /> : null;
            })}
          </div>
        )}
      </main>

      {/* Config modal */}
      {showConfig && (
        <WidgetConfig
          widgets={widgets}
          onSave={handleSaveConfig}
          onClose={() => setShowConfig(false)}
        />
      )}
    </div>
  );
}

function WidgetPlaceholder({ title, description }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 h-full">
      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-dark-muted mb-4">{description}</p>
      <div className="h-24 rounded-lg bg-gray-100 dark:bg-dark-bg3 border border-dashed border-gray-300 dark:border-dark-border flex items-center justify-center">
        <span className="text-xs text-gray-400 dark:text-dark-muted">Coming soon</span>
      </div>
    </div>
  );
}
