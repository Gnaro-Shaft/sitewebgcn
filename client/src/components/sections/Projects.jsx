import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import ProjectCard from '../ui/ProjectCard';
import FeaturedProject from '../ui/FeaturedProject';
import useInView from '../../hooks/useInView';

export default function Projects({ limit }) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState(null);
  const [allTechs, setAllTechs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ref, inView] = useInView();

  const fetchProjects = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/projects')
      .then((res) => {
        setProjects(res.data.data);
        const techs = [...new Set(res.data.data.flatMap((p) => p.stack))];
        setAllTechs(techs);
      })
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Separate featured project from regular grid
  const featured = projects.find((p) => p.featured);
  const rest = projects.filter((p) => !p.featured);

  const filtered = filter
    ? rest.filter((p) => p.stack?.includes(filter))
    : rest;

  // When filtering, don't show featured separately
  const showFeatured = !filter && featured;
  const displayed = limit
    ? filtered.slice(0, showFeatured ? limit - 1 : limit)
    : filtered;
  const skeletonCount = limit || 6;

  return (
    <div ref={ref} className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-dark-text">
          {t('projects.title')}
        </h2>
        {limit && projects.length > limit && (
          <Link to="/projects" className="text-sm text-accent hover:underline">
            {t('projects.viewAll')}
          </Link>
        )}
      </div>

      {!limit && allTechs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter(null)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              !filter
                ? 'bg-accent text-dark-bg'
                : 'bg-gray-100 dark:bg-dark-bg3 text-gray-600 dark:text-dark-muted hover:bg-gray-200 dark:hover:bg-dark-border'
            }`}
          >
            {t('projects.all')}
          </button>
          {allTechs.map((tech) => (
            <button
              key={tech}
              onClick={() => setFilter(tech)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === tech
                  ? 'bg-accent text-dark-bg'
                  : 'bg-gray-100 dark:bg-dark-bg3 text-gray-600 dark:text-dark-muted hover:bg-gray-200 dark:hover:bg-dark-border'
              }`}
            >
              {tech}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchProjects}
            className="px-4 py-2 text-sm bg-accent hover:bg-accent-hover text-dark-bg rounded-lg font-medium transition-all"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(skeletonCount)].map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : displayed.length === 0 && !showFeatured ? (
        <p className="text-gray-500 dark:text-dark-muted">{t('projects.noProjects')}</p>
      ) : (
        <div className="space-y-6">
          {/* Featured project */}
          {showFeatured && (
            <div className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <FeaturedProject project={featured} />
            </div>
          )}

          {/* Regular grid */}
          {displayed.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayed.map((p, i) => (
                <div key={p._id} className={`transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${(i + 1) * 100}ms` }}>
                  <ProjectCard project={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden bg-white dark:bg-dark-bg2 animate-pulse">
      <div className="w-full h-32 bg-gray-100 dark:bg-dark-bg3" />
      <div className="p-6 space-y-3">
        <div className="h-5 w-3/4 bg-gray-100 dark:bg-dark-bg3 rounded" />
        <div className="h-4 w-full bg-gray-100 dark:bg-dark-bg3 rounded" />
        <div className="h-4 w-2/3 bg-gray-100 dark:bg-dark-bg3 rounded" />
        <div className="flex gap-2 pt-2">
          <div className="h-6 w-14 bg-gray-100 dark:bg-dark-bg3 rounded-md" />
          <div className="h-6 w-14 bg-gray-100 dark:bg-dark-bg3 rounded-md" />
        </div>
      </div>
    </div>
  );
}
