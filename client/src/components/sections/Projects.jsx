import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import ProjectCard from '../ui/ProjectCard';
import useInView from '../../hooks/useInView';

export default function Projects({ limit }) {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState(null);
  const [allTechs, setAllTechs] = useState([]);
  const [ref, inView] = useInView();

  useEffect(() => {
    api.get('/projects').then((res) => {
      setProjects(res.data.data);
      const techs = [...new Set(res.data.data.flatMap((p) => p.stack))];
      setAllTechs(techs);
    });
  }, []);

  const filtered = filter
    ? projects.filter((p) => p.stack?.includes(filter))
    : projects;

  const displayed = limit ? filtered.slice(0, limit) : filtered;

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

      {displayed.length === 0 ? (
        <p className="text-gray-500 dark:text-dark-muted">{t('projects.noProjects')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayed.map((p, i) => (
            <div key={p._id} className={`transition-all duration-500 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: `${(i + 1) * 100}ms` }}>
              <ProjectCard project={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
