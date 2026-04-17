import { useTranslation } from 'react-i18next';

export default function ProjectCard({ project }) {
  const { t } = useTranslation();

  return (
    <div className="group h-full flex flex-col border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden hover:border-accent-border dark:hover:border-accent-border bg-white dark:bg-dark-bg2 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.06)]">
      {project.imageUrl ? (
        <img
          src={project.imageUrl}
          alt={project.title}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-dark-bg3 dark:to-dark-bg flex items-center justify-center border-b border-gray-100 dark:border-dark-border shrink-0">
          <span className="text-3xl font-bold text-gray-200 dark:text-dark-border select-none">
            {project.title?.charAt(0) || '?'}
          </span>
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text group-hover:text-accent transition-colors">
          {project.title}
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-dark-muted line-clamp-3 flex-1">
          {project.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {project.stack?.map((tech) => (
            <span
              key={tech}
              className="px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-700 dark:bg-accent-bg dark:text-accent dark:border dark:border-accent-border"
            >
              {tech}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          {project.githubUrl && (
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-accent transition-colors"
            >
              {t('projects.code')} &rarr;
            </a>
          )}
          {project.liveUrl && (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-accent transition-colors"
            >
              {t('projects.live')} &rarr;
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
