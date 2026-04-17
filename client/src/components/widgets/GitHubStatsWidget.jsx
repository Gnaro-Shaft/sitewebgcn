import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const GITHUB_USER = 'gnaro-shaft';

export default function GitHubStatsWidget() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`https://api.github.com/users/${GITHUB_USER}`).then((r) => r.json()),
      fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`).then((r) => r.json()),
    ])
      .then(([user, repos]) => {
        // Count languages
        const langCount = {};
        (Array.isArray(repos) ? repos : []).forEach((r) => {
          if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
        });
        const topLangs = Object.entries(langCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6);

        setData({
          avatar: user.avatar_url,
          publicRepos: user.public_repos || 0,
          followers: user.followers || 0,
          repoCount: Array.isArray(repos) ? repos.length : 0,
          topLangs,
          recentRepos: (Array.isArray(repos) ? repos : []).slice(0, 4),
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <WidgetShell title="GitHub"><Skeleton /></WidgetShell>;
  if (!data) return <WidgetShell title="GitHub"><p className="text-sm text-gray-400">Failed to load</p></WidgetShell>;

  return (
    <WidgetShell title="GitHub">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatBox label="Repos" value={data.publicRepos} accent />
        <StatBox label="Followers" value={data.followers} />
        <StatBox label="Languages" value={data.topLangs.length} />
      </div>

      {/* Top languages */}
      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-3">
        {t('widgets.topLanguages')}
      </h4>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {data.topLangs.map(([lang, count]) => (
          <span key={lang} className="text-xs px-2 py-1 rounded-lg border border-accent-border text-accent bg-accent-bg">
            {lang} <span className="text-accent/60">({count})</span>
          </span>
        ))}
      </div>

      {/* Recent repos */}
      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-dark-muted mb-3">
        {t('widgets.recentActivity')}
      </h4>
      <ul className="space-y-2">
        {data.recentRepos.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2">
            <a
              href={r.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-700 dark:text-dark-text hover:text-accent truncate transition-colors"
            >
              {r.name}
            </a>
            {r.language && (
              <span className="shrink-0 text-xs text-gray-400 dark:text-dark-muted">{r.language}</span>
            )}
          </li>
        ))}
      </ul>
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
      <div className="flex gap-2">{[1, 2, 3].map((i) => <div key={i} className="h-6 w-16 bg-gray-100 dark:bg-dark-bg3 rounded" />)}</div>
    </div>
  );
}
