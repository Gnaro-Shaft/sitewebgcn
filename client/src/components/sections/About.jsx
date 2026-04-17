import { useTranslation } from 'react-i18next';
import useInView from '../../hooks/useInView';

export default function About() {
  const { t } = useTranslation();
  const [ref, inView] = useInView();

  return (
    <div ref={ref} className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-dark-text mb-6">
          {t('about.title')}
        </h2>
        <div className="space-y-4 text-gray-600 dark:text-dark-muted text-lg leading-relaxed">
          <p>
            {t('about.paragraph1_start')}
            <span className="text-gray-900 dark:text-dark-text font-medium">{t('about.paragraph1_highlight')}</span>
            {t('about.paragraph1_end')}
          </p>
          <p>
            {t('about.paragraph2')}
          </p>
          <p>
            {t('about.paragraph3_start')}
            <span className="text-accent font-medium">{t('about.paragraph3_highlight')}</span>
            {t('about.paragraph3_end')}
          </p>
          <p>
            {t('about.paragraph4')}
          </p>
        </div>

        <div className="mt-10 flex items-center justify-center gap-0">
          <TimelineStep label={t('about.timeline.support')} period={t('about.timeline.supportPeriod')} />
          <div className="w-12 md:w-20 h-px bg-gray-300 dark:bg-dark-border" />
          <TimelineStep label={t('about.timeline.bootcamp')} period={t('about.timeline.bootcampPeriod')} />
          <div className="w-12 md:w-20 h-px bg-accent" />
          <TimelineStep label={t('about.timeline.ai')} period={t('about.timeline.aiPeriod')} active />
        </div>
      </div>
    </div>
  );
}

function TimelineStep({ label, period, active }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${active ? 'bg-accent shadow-[0_0_10px_rgba(0,255,136,0.5)]' : 'bg-gray-300 dark:bg-dark-border'}`} />
      <span className={`text-xs font-semibold ${active ? 'text-accent' : 'text-gray-900 dark:text-dark-text'}`}>
        {label}
      </span>
      <span className="text-xs text-gray-500 dark:text-dark-muted">{period}</span>
    </div>
  );
}
