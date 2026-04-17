import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const toggle = () => {
    i18n.changeLanguage(current === 'fr' ? 'en' : 'fr');
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-200 dark:bg-dark-bg3 hover:bg-gray-300 dark:hover:bg-dark-border transition-colors"
      aria-label={current === 'fr' ? 'Switch to English' : 'Passer en francais'}
      title={current === 'fr' ? 'Switch to English' : 'Passer en francais'}
    >
      <span className="text-sm leading-none">{current === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
      <span className="text-xs font-bold">{current === 'fr' ? 'FR' : 'EN'}</span>
    </button>
  );
}
