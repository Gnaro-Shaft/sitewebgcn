import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import WidgetError from './WidgetError';

export default function BlogAIWidget() {
  const { t } = useTranslation();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchUsage = useCallback(() => {
    setLoading(true);
    setError(false);
    api.get('/ai/usage')
      .then((res) => setUsage(res.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  if (loading) return <WidgetShell title={t('widgets.blogAi')}><Skeleton /></WidgetShell>;
  if (error) return <WidgetShell title={t('widgets.blogAi')}><WidgetError onRetry={fetchUsage} /></WidgetShell>;

  const monthlyPct = (usage.monthlySpent / usage.monthlyBudget) * 100;
  const yearlyPct = (usage.yearlySpent / usage.yearlyBudget) * 100;

  return (
    <>
      <WidgetShell title={t('widgets.blogAi')}>
        {/* Model badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-mono text-gray-500 dark:text-dark-muted">{usage.model}</span>
        </div>

        {/* Budget bars */}
        <div className="space-y-3 mb-4">
          <BudgetBar
            label={t('widgets.monthBudget')}
            spent={usage.monthlySpent}
            budget={usage.monthlyBudget}
            pct={monthlyPct}
          />
          <BudgetBar
            label={t('widgets.yearBudget')}
            spent={usage.yearlySpent}
            budget={usage.yearlyBudget}
            pct={yearlyPct}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 dark:text-dark-muted mb-4">
          <div>
            <span className="block text-2xl font-bold text-gray-900 dark:text-dark-text">{usage.generationCount}</span>
            {t('widgets.generationsThisMonth')}
          </div>
          <div>
            <span className="block text-2xl font-bold text-accent">
              {usage.monthlyRemaining.toFixed(2)}$
            </span>
            {t('widgets.remainingMonth')}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            disabled={usage.monthlyRemaining <= 0 || usage.yearlyRemaining <= 0}
            className="flex-1 px-3 py-2 text-sm bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-dark-bg rounded-lg font-medium transition-all"
          >
            {t('widgets.generateArticle')}
          </button>
          <Link
            to="/admin/drafts"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-dark-border hover:border-accent rounded-lg font-medium text-gray-700 dark:text-dark-text hover:text-accent transition-all"
          >
            {t('widgets.drafts')}
          </Link>
        </div>
      </WidgetShell>

      {showModal && (
        <GenerateModal
          onClose={() => { setShowModal(false); fetchUsage(); }}
          onGenerated={fetchUsage}
        />
      )}
    </>
  );
}

function BudgetBar({ label, spent, budget, pct }) {
  const warning = pct > 75;
  const critical = pct > 90;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-dark-muted">{label}</span>
        <span className={`font-mono ${critical ? 'text-red-500' : warning ? 'text-orange-500' : 'text-gray-700 dark:text-dark-text'}`}>
          ${spent.toFixed(2)} / ${budget.toFixed(2)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-dark-bg3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            critical ? 'bg-red-500' : warning ? 'bg-orange-500' : 'bg-accent'
          }`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function GenerateModal({ onClose, onGenerated }) {
  const { t } = useTranslation();
  const [topic, setTopic] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSuggest = async () => {
    setLoading(true);
    setStatus('suggesting');
    setError(null);
    try {
      const res = await api.post('/ai/suggest-topics', { count: 3 });
      setSuggestions(res.data.data.topics);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
      setStatus(null);
    }
  };

  const handleGenerate = async (t) => {
    setLoading(true);
    setStatus('generating');
    setError(null);
    try {
      const res = await api.post('/ai/generate-article', { topic: t, autoSave: true });
      setResult(res.data.data);
      onGenerated?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
      setStatus(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-dark-bg2 rounded-2xl border border-gray-200 dark:border-dark-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-dark-text">{t('widgets.blogAi')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-accent">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">{t('widgets.articleGenerated')}</span>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-dark-bg3 space-y-2">
                <h3 className="font-bold text-gray-900 dark:text-dark-text">{result.article.title}</h3>
                <p className="text-sm text-gray-600 dark:text-dark-muted">{result.article.excerpt}</p>
                <div className="flex flex-wrap gap-1">
                  {result.article.tags?.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">{tag}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-400 dark:text-dark-muted mt-2 flex justify-between">
                  <span>{result.inputTokens + result.outputTokens} tokens</span>
                  <span>${result.costUsd.toFixed(4)}</span>
                </div>
              </div>
              <Link
                to="/admin/drafts"
                className="block w-full py-2.5 text-center text-sm bg-accent hover:bg-accent-hover text-dark-bg rounded-lg font-medium transition-all"
              >
                {t('widgets.reviewDraft')}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Custom topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  {t('widgets.customTopic')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={t('widgets.topicPlaceholder')}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
                    disabled={loading}
                  />
                  <button
                    onClick={() => handleGenerate(topic)}
                    disabled={loading || topic.trim().length < 3}
                    className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover disabled:opacity-40 text-dark-bg rounded-lg font-medium transition-all"
                  >
                    {status === 'generating' ? '...' : t('widgets.generate')}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-dark-border" />
                <span className="text-xs text-gray-400">{t('widgets.or')}</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-dark-border" />
              </div>

              {/* Suggestions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-dark-text">
                    {t('widgets.aiSuggestions')}
                  </label>
                  <button
                    onClick={handleSuggest}
                    disabled={loading}
                    className="text-xs text-accent hover:underline disabled:opacity-40"
                  >
                    {status === 'suggesting' ? '...' : t('widgets.suggest')}
                  </button>
                </div>

                {suggestions.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-dark-muted italic">
                    {t('widgets.clickSuggest')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleGenerate(s.title)}
                        disabled={loading}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-dark-border hover:border-accent-border hover:bg-accent/5 transition-all disabled:opacity-40"
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-dark-text">{s.title}</div>
                        <div className="text-xs text-gray-500 dark:text-dark-muted mt-1">{s.angle}</div>
                        <div className="flex gap-1 mt-2">
                          {s.tags?.map((tag) => (
                            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-dark-bg3 text-gray-600 dark:text-dark-muted">{tag}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {loading && (
                <div className="text-center py-3 text-sm text-gray-500 dark:text-dark-muted">
                  {status === 'generating' ? t('widgets.generating') : t('widgets.loading')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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
      <div className="h-3 w-24 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="h-2 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="h-2 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="h-14 rounded-lg bg-gray-100 dark:bg-dark-bg3" />
        <div className="h-14 rounded-lg bg-gray-100 dark:bg-dark-bg3" />
      </div>
      <div className="h-10 bg-gray-100 dark:bg-dark-bg3 rounded-lg" />
    </div>
  );
}
