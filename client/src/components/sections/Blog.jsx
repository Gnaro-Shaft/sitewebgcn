import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import ArticleCard from '../ui/ArticleCard';
import useInView from '../../hooks/useInView';

export default function Blog({ limit }) {
  const { t } = useTranslation();
  const [articles, setArticles] = useState([]);
  const [ref, inView] = useInView();

  useEffect(() => {
    api.get('/articles').then((res) => setArticles(res.data.data));
  }, []);

  const displayed = limit ? articles.slice(0, limit) : articles;

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

      {displayed.length === 0 ? (
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
