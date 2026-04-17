import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

export default function ArticleCard({ article }) {
  const { i18n } = useTranslation();
  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';

  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <Link
      to={`/blog/${article.slug}`}
      className="block border border-gray-200 dark:border-dark-border rounded-xl p-6 hover:border-accent-border dark:hover:border-accent-border bg-white dark:bg-dark-bg2 transition-colors"
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-muted">
        {date && <span>{date}</span>}
        {article.tags?.length > 0 && (
          <>
            <span>&middot;</span>
            {article.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-dark-bg3">
                {tag}
              </span>
            ))}
          </>
        )}
      </div>
      <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-dark-text">
        {article.title}
      </h3>
      {article.excerpt && (
        <p className="mt-2 text-sm text-gray-600 dark:text-dark-muted line-clamp-2">
          {article.excerpt}
        </p>
      )}
    </Link>
  );
}
