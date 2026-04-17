import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

export default function BlogStatsWidget() {
  const { t } = useTranslation();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/articles/admin/all')
      .then((res) => setArticles(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const published = articles.filter((a) => a.published);
  const drafts = articles.filter((a) => !a.published);
  const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);

  if (loading) return <WidgetShell title={t('widgets.blog')}><Skeleton /></WidgetShell>;

  return (
    <WidgetShell title={t('widgets.blog')}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatBox label="Published" value={published.length} accent />
        <StatBox label="Drafts" value={drafts.length} />
        <StatBox label="Views" value={totalViews} />
      </div>

      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-3">
        {t('widgets.recentArticles')}
      </h4>
      {articles.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-dark-muted">{t('blog.noArticles')}</p>
      ) : (
        <ul className="space-y-2">
          {articles.slice(0, 5).map((a) => (
            <li key={a._id} className="flex items-center justify-between gap-2">
              <span className="text-sm text-gray-700 dark:text-dark-text truncate">{a.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400 dark:text-dark-muted">{a.views || 0} views</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  a.published
                    ? 'bg-accent/10 text-accent'
                    : 'bg-gray-100 dark:bg-dark-bg3 text-gray-500 dark:text-dark-muted'
                }`}>
                  {a.published ? 'Live' : 'Draft'}
                </span>
              </div>
            </li>
          ))}
        </ul>
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
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-dark-bg3" />)}
      </div>
      <div className="h-4 w-24 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-6 bg-gray-100 dark:bg-dark-bg3 rounded" />)}
      </div>
    </div>
  );
}
