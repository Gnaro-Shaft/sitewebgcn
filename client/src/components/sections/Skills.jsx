import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

const CATEGORY_KEYS = [
  { key: 'frontend', titleKey: 'skills.groups.frontend' },
  { key: 'ai', titleKey: 'skills.groups.ai' },
  { key: 'backend', titleKey: 'skills.groups.backend' },
];

// Fallback if API fails
const FALLBACK = {
  frontend: [
    { name: 'JavaScript', featured: true },
    { name: 'React', featured: true },
    { name: 'HTML / CSS', featured: false },
    { name: 'Tailwind CSS', featured: true },
  ],
  ai: [
    { name: 'Python', featured: true },
    { name: 'Pandas', featured: true },
    { name: 'LLM Integration', featured: true },
  ],
  backend: [
    { name: 'Node.js', featured: true },
    { name: 'Express', featured: true },
    { name: 'MongoDB', featured: true },
    { name: 'Git / GitHub', featured: false },
  ],
};

export default function Skills() {
  const { t } = useTranslation();
  const [skills, setSkills] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/github/skills')
      .then((res) => {
        if (res.data.success && res.data.data) {
          setSkills(res.data.data);
        }
      })
      .catch(() => {
        // Silent fallback to hardcoded skills — not critical for UX
        console.warn('GitHub skills API unavailable, using fallback');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-dark-text mb-8 text-center animate-fade-in-up">
        {t('skills.title')}
      </h2>
      <div className="grid gap-px md:grid-cols-3 bg-gray-200 dark:bg-dark-border rounded-xl overflow-hidden">
        {CATEGORY_KEYS.map((cat, i) => {
          const items = skills[cat.key] || [];
          return (
            <div
              key={cat.key}
              className={`bg-white dark:bg-dark-bg2 p-6 animate-fade-in-up stagger-${i + 1}`}
            >
              <h3 className="text-xs font-semibold uppercase tracking-widest text-accent mb-4 pb-3 border-b border-gray-200 dark:border-dark-border">
                {t(cat.titleKey)}
              </h3>
              <div className="flex flex-wrap gap-2">
                {loading ? (
                  // Skeleton
                  [...Array(5)].map((_, j) => (
                    <div key={j} className="h-8 w-20 rounded-lg bg-gray-100 dark:bg-dark-bg3 animate-pulse" />
                  ))
                ) : (
                  items.map((skill) => (
                    <span
                      key={skill.name}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-all cursor-default ${
                        skill.featured
                          ? 'text-accent border-accent-border bg-accent-bg hover:bg-accent/10 hover:shadow-[0_0_12px_rgba(0,255,136,0.15)]'
                          : 'text-gray-600 dark:text-dark-muted border-gray-200 dark:border-dark-border hover:border-accent-border hover:text-accent'
                      }`}
                      title={skill.repoCount ? `${skill.repoCount} repo${skill.repoCount > 1 ? 's' : ''}` : undefined}
                    >
                      {skill.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
