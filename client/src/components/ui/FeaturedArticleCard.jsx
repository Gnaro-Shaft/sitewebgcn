import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { gradientForSlug, tagChipStyle } from '../../utils/articleVisuals';

// XL hero card for the most recent article. Same gradient + tag chip
// language as the grid below, but with a much larger visual footprint:
// big background gradient strip on the left, title at 3xl/4xl, excerpt
// shown in full, prominent CTA.
export default function FeaturedArticleCard({ article }) {
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

  return (
    <Link
      to={`/blog/${article.slug}`}
      className="group block mb-12 rounded-2xl overflow-hidden border border-gray-200 dark:border-dark-border hover:border-accent-border bg-gradient-to-br from-accent/10 to-transparent transition-all hover:shadow-[0_0_32px_rgba(0,255,136,0.15)]"
    >
      <div className="grid md:grid-cols-[auto_1fr]">
        {/* Left: tall procedural gradient strip — visual signature for the article */}
        <div
          className={`relative h-32 md:h-auto md:w-48 bg-gradient-to-br ${gradient}`}
          aria-hidden="true"
        />

        <div className="p-6 md:p-10">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-bold mb-3">
            <span>{t('blog.featured')}</span>
            <span className="text-gray-400 dark:text-dark-muted">·</span>
            {date && <span className="text-gray-500 dark:text-dark-muted normal-case font-normal tracking-normal">{date}</span>}
            {article.readingTime && (
              <>
                <span className="text-gray-400 dark:text-dark-muted">·</span>
                <span className="text-gray-500 dark:text-dark-muted normal-case font-normal tracking-normal">
                  {t('blog.readingTime', { count: article.readingTime })}
                </span>
              </>
            )}
          </div>

          {article.tags?.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {article.tags.map((tag) => {
                const style = tagChipStyle(tag);
                const hasColor = Object.keys(style).length > 0;
                return (
                  <span
                    key={tag}
                    style={style}
                    className={`text-xs px-2.5 py-1 rounded-md border font-medium ${
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

          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-dark-text leading-tight group-hover:text-accent transition-colors">
            {article.title}
          </h2>

          {article.excerpt && (
            <p className="mt-4 text-base md:text-lg text-gray-700 dark:text-dark-muted leading-relaxed">
              {article.excerpt}
            </p>
          )}

          <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent group-hover:gap-3 transition-all">
            {t('blog.read')}
            <span className="text-lg">&rarr;</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
