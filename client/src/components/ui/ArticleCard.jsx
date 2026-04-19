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
      className="group h-full flex flex-col border border-gray-200 dark:border-dark-border rounded-xl p-6 hover:border-accent-border dark:hover:border-accent-border bg-white dark:bg-dark-bg2 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.06)]"
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-muted flex-wrap">
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
      <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-dark-text group-hover:text-accent transition-colors line-clamp-2">
        {article.title}
      </h3>
      {article.excerpt && (
        <p className="mt-2 text-sm text-gray-600 dark:text-dark-muted line-clamp-3 flex-1">
          {article.excerpt}
        </p>
      )}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
        Lire l'article &rarr;
      </div>
    </Link>
  );
}
