import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import ArticleCard from '../ui/ArticleCard';
import FeaturedArticleCard from '../ui/FeaturedArticleCard';
import useInView from '../../hooks/useInView';

export default function Blog({ limit }) {
  const { t } = useTranslation();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ref, inView] = useInView();

  const fetchArticles = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/articles')
      .then((res) => setArticles(res.data.data))
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const displayed = limit ? articles.slice(0, limit) : articles;
  const skeletonCount = limit || 6;

  // On the full /blog page only (no `limit`), promote the most recent
  // article to a featured hero above the grid. Homepage usages keep
  // their existing flat grid.
  const showFeatured = !limit && displayed.length > 0;
  const featured = showFeatured ? displayed[0] : null;
  const rest = showFeatured ? displayed.slice(1) : displayed;

  return (
    <section ref={ref} className={`py-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="flex items-start justify-between mb-8 gap-6 flex-wrap">
        <div className="max-w-2xl">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-dark-text">
            {t('blog.title')}
          </h2>
          {!limit && (
            <p className="mt-3 text-base text-gray-600 dark:text-dark-muted leading-relaxed">
              {t('blog.intro')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!limit && (
            <a
              href="/rss.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-dark-muted hover:text-accent transition-colors"
              title="RSS feed"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1Z" />
              </svg>
              RSS
            </a>
          )}
          {limit && articles.length > limit && (
            <Link to="/blog" className="text-sm text-accent hover:underline">
              {t('projects.viewAll')}
            </Link>
          )}
        </div>
      </div>

      {error ? (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchArticles}
            className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-dark-bg rounded-lg font-medium transition-all"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(skeletonCount)].map((_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <p className="text-gray-500 dark:text-dark-muted">{t('blog.noArticles')}</p>
      ) : (
        <>
          {featured && <FeaturedArticleCard article={featured} />}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((a, i) => (
              <div key={a._id} className={`transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${(i + 1) * 100}ms` }}>
                <ArticleCard article={a} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ArticleCardSkeleton() {
  return (
    <div className="border border-gray-200 dark:border-dark-border rounded-xl p-6 bg-white dark:bg-dark-bg2 animate-pulse space-y-3">
      <div className="h-3 w-32 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="h-5 w-3/4 bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="h-4 w-full bg-gray-100 dark:bg-dark-bg3 rounded" />
      <div className="h-4 w-5/6 bg-gray-100 dark:bg-dark-bg3 rounded" />
    </div>
  );
}
