import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-gray-200 dark:border-dark-border mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500 dark:text-dark-muted">
          &copy; {new Date().getFullYear()} Genaro-Cedric. {t('footer.rights')}
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/gnaro-shaft"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 dark:text-dark-muted hover:text-accent transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 dark:text-dark-muted hover:text-accent transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
