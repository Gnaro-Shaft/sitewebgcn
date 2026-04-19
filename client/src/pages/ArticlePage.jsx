import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import api from '../api/axios';
import SEO from '../components/SEO';

export default function ArticlePage() {
  const { t, i18n } = useTranslation();
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get(`/articles/${slug}`)
      .then((res) => setArticle(res.data.data))
      .catch(() => setError(true));
  }, [slug]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{t('blog.notFound')}</h1>
        <Link to="/blog" className="mt-4 inline-block text-accent hover:underline">
          {t('blog.backToBlog')}
        </Link>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-dark-muted">
        {t('blog.loading')}
      </div>
    );
  }

  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <article className="max-w-3xl mx-auto px-4 py-12">
      <SEO
        title={article.title}
        description={article.excerpt || article.content?.slice(0, 160)}
        url={`https://gcn-data.fr/blog/${article.slug}`}
        type="article"
      />
      <Link to="/blog" className="text-sm text-accent hover:underline">
        &larr; {t('blog.backToBlog')}
      </Link>

      <h1 className="mt-6 text-3xl md:text-4xl font-bold text-gray-900 dark:text-dark-text">
        {article.title}
      </h1>

      <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-dark-muted">
        {date && <span>{date}</span>}
        {article.tags?.map((tag) => (
          <span key={tag} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-bg3 text-xs">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-8 prose-custom max-w-none">
        <Markdown>{article.content}</Markdown>
      </div>
    </article>
  );
}
