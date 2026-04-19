import { useTranslation } from 'react-i18next';

export default function WidgetError({ onRetry }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <svg className="w-8 h-8 text-red-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-gray-500 dark:text-dark-muted mb-3">{t('common.error')}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-dark-bg rounded-lg font-medium transition-all"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
