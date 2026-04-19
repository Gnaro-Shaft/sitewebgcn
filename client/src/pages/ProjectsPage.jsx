import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import Projects from '../components/sections/Projects';

export default function ProjectsPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-6xl mx-auto px-4">
      <SEO
        title={t('projects.title')}
        url="https://gcn-data.fr/projects"
      />
      <Projects />
    </div>
  );
}
