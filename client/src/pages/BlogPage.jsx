import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import Blog from '../components/sections/Blog';

export default function BlogPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-6xl mx-auto px-4">
      <SEO
        title={t('blog.title')}
        url="https://gcn-data.fr/blog"
      />
      <Blog />
    </div>
  );
}
