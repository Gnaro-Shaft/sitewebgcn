import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="max-w-6xl mx-auto px-4 py-32 text-center">
      <h1 className="text-6xl font-bold text-gray-900 dark:text-dark-text">404</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-dark-muted">{t('notFound.title')}</p>
      <Link
        to="/"
        className="mt-6 inline-block px-6 py-3 bg-accent hover:bg-accent-hover text-dark-bg rounded-lg font-medium transition-colors"
      >
        {t('notFound.goHome')}
      </Link>
    </div>
  );
}
