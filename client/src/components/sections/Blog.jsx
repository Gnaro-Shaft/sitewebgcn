import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import ArticleCard from '../ui/ArticleCard';
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

  return (
    <section ref={ref} className={`py-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-dark-text">
          {t('blog.title')}
        </h2>
        {limit && articles.length > limit && (
          <Link to="/blog" className="text-sm text-accent hover:underline">
            {t('projects.viewAll')}
          </Link>
        )}
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayed.map((a, i) => (
            <div key={a._id} className={`transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${(i + 1) * 100}ms` }}>
              <ArticleCard article={a} />
            </div>
          ))}
        </div>
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
