import { useTranslation } from 'react-i18next';

export default function FeaturedProject({ project }) {
  const { t } = useTranslation();

  if (!project) return null;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-accent-border bg-gradient-to-br from-white to-gray-50 dark:from-dark-bg2 dark:to-dark-bg3 transition-all hover:shadow-[0_0_40px_rgba(0,255,136,0.15)]">
      {/* Accent glow ring */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: 'radial-gradient(circle at top left, rgba(0,255,136,0.08), transparent 50%)',
        }}
      />

      {/* Featured badge */}
      <div className="absolute top-4 right-4 z-10">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent-border text-accent text-xs font-semibold">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z" />
          </svg>
          {t('projects.featured')}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6 p-8 relative">
        {/* Image / placeholder */}
        {project.imageUrl ? (
          <div className="rounded-xl overflow-hidden aspect-video bg-gray-100 dark:bg-dark-bg">
            <img
              src={project.imageUrl}
              alt={project.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        ) : (
          <div className="rounded-xl aspect-video bg-gradient-to-br from-accent/10 to-accent/5 border border-accent-border flex items-center justify-center">
            <span className="text-6xl font-black text-accent/30 select-none font-mono">
              {project.title?.charAt(0) || '?'}
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col">
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-dark-text group-hover:text-accent transition-colors">
            {project.title}
          </h3>

          <p className="mt-3 text-gray-600 dark:text-dark-muted leading-relaxed">
            {project.longDescription || project.description}
          </p>

          {/* Highlights */}
          {project.highlights?.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {project.highlights.slice(0, 4).map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-dark-text">
                  <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Stack */}
          <div className="mt-4 flex flex-wrap gap-2">
            {project.stack?.map((tech) => (
              <span
                key={tech}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-accent/10 border border-accent-border text-accent"
              >
                {tech}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-dark-bg rounded-lg text-sm font-medium transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
              >
                {t('projects.live')} &rarr;
              </a>
            )}
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text hover:border-accent hover:text-accent rounded-lg text-sm font-medium transition-all"
              >
                {t('projects.code')} &rarr;
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
