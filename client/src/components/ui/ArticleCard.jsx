import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { gradientForSlug, tagChipStyle } from '../../utils/articleVisuals';

export default function ArticleCard({ article }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';

  const date = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const gradient = gradientForSlug(article.slug);
  const primaryTag = article.tags?.[0];

  return (
    <Link
      to={`/blog/${article.slug}`}
      className="group h-full flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-dark-border hover:border-accent-border dark:hover:border-accent-border bg-white dark:bg-dark-bg2 transition-all hover:shadow-[0_0_24px_rgba(0,255,136,0.1)]"
    >
      {/* Procedural cover band — deterministic gradient based on slug hash */}
      <div
        className={`relative h-24 bg-gradient-to-br ${gradient} flex items-end p-3`}
      >
        {primaryTag && (
          <span className="text-white/90 text-xs font-semibold uppercase tracking-widest drop-shadow-sm">
            {primaryTag}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-muted flex-wrap">
          {date && <span>{date}</span>}
          {article.readingTime && (
            <>
              <span>&middot;</span>
              <span>{t('blog.readingTime', { count: article.readingTime })}</span>
            </>
          )}
        </div>

        {article.tags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {article.tags.map((tag) => {
              const style = tagChipStyle(tag);
              const hasColor = Object.keys(style).length > 0;
              return (
                <span
                  key={tag}
                  style={style}
                  className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${
                    hasColor
                      ? ''
                      : 'bg-gray-100 dark:bg-dark-bg3 text-gray-600 dark:text-dark-muted border-gray-200 dark:border-dark-border'
                  }`}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-dark-text group-hover:text-accent transition-colors line-clamp-2">
          {article.title}
        </h3>

        {article.excerpt && (
          <p className="mt-2 text-sm text-gray-600 dark:text-dark-muted line-clamp-3 flex-1">
            {article.excerpt}
          </p>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-dark-border text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
          {t('blog.read')} &rarr;
        </div>
      </div>
    </Link>
  );
}
