import { useTranslation } from 'react-i18next';
import GlitchLogo from '../ui/GlitchLogo';

export default function Hero() {
  const { t } = useTranslation();

  return (
    <div className="relative text-center">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 rounded-full bg-accent/6 dark:bg-accent/10 blur-3xl animate-glow-pulse" />
      </div>

      <div className="relative">
        <div className="animate-fade-in-up flex justify-center mb-4">
          <GlitchLogo size={200} />
        </div>
        <p className="mt-4 text-xl md:text-2xl text-accent font-medium animate-fade-in-up stagger-1">
          {t('hero.subtitle')}
        </p>
        <p className="mt-4 max-w-2xl mx-auto text-gray-600 dark:text-dark-muted text-lg animate-fade-in-up stagger-2">
          {t('hero.description')}
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 flex-wrap animate-fade-in-up stagger-3">
          <a
            href="/api/cv/download"
            className="px-6 py-3 bg-accent hover:bg-accent-hover text-dark-bg rounded-lg font-medium transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
          >
            {t('hero.downloadCv')}
          </a>
          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-6 py-3 border border-accent text-accent rounded-lg font-medium hover:bg-accent hover:text-dark-bg transition-all"
          >
            {t('hero.contactMe')}
          </a>
          <a
            href="https://github.com/gnaro-shaft"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-gray-300 dark:border-dark-border rounded-lg font-medium text-gray-700 dark:text-dark-muted hover:border-accent hover:text-accent transition-all"
          >
            GitHub
          </a>
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-gray-300 dark:border-dark-border rounded-lg font-medium text-gray-700 dark:text-dark-muted hover:border-accent hover:text-accent transition-all"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
}
