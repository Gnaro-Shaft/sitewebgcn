import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import SEO from '../components/SEO';
import ArchitectureDiagram from '../components/stack/ArchitectureDiagram';

export default function StackPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <SEO title={t('stack.title')} url="https://gcn-data.fr/stack" />

      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-dark-text">
          {t('stack.title')}
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-dark-muted max-w-2xl mx-auto">
          {t('stack.tagline')}
        </p>
      </header>

      <Stats />

      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">
          {t('stack.diagramTitle')}
        </h2>
        <p className="text-gray-600 dark:text-dark-muted mb-6">
          {t('stack.diagramHint')}
        </p>
        <div className="rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg2 p-4 md:p-8 overflow-x-auto">
          <ArchitectureDiagram />
        </div>
      </section>

      <Layers />

      <Decisions />

      <Lessons />

      <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-dark-border text-center text-sm text-gray-500 dark:text-dark-muted">
        <p>{t('stack.footer.builtWith')}</p>
        <p className="mt-2">
          <a
            href="https://github.com/Gnaro-Shaft/sitewebgcn"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            github.com/Gnaro-Shaft/sitewebgcn
          </a>
        </p>
      </footer>
    </div>
  );
}

function Stats() {
  const { t } = useTranslation();
  const stats = [
    { value: '10K+', label: t('stack.stats.linesOfCode') },
    { value: '60+', label: t('stack.stats.npmDeps') },
    { value: '20+', label: t('stack.stats.endpoints') },
    { value: '7', label: t('stack.stats.widgets') },
    { value: '11j', label: t('stack.stats.buildTime') },
    { value: '< 30s', label: t('stack.stats.deploy') },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-16">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-4 text-center"
        >
          <div className="text-2xl font-bold text-accent">{s.value}</div>
          <div className="text-xs text-gray-500 dark:text-dark-muted mt-1 uppercase tracking-wider">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function Layers() {
  const { t } = useTranslation();
  const layers = [
    {
      key: 'frontend',
      icon: '🎨',
      title: t('stack.layers.frontend.title'),
      desc: t('stack.layers.frontend.desc'),
      tech: ['React 19', 'Vite', 'Tailwind v4', 'React Router v7', 'i18next', 'react-helmet-async'],
    },
    {
      key: 'backend',
      icon: '⚙️',
      title: t('stack.layers.backend.title'),
      desc: t('stack.layers.backend.desc'),
      tech: ['Node 20', 'Express 5', 'Mongoose', 'JWT', 'Helmet', 'express-rate-limit', 'express-validator'],
    },
    {
      key: 'external',
      icon: '🔌',
      title: t('stack.layers.external.title'),
      desc: t('stack.layers.external.desc'),
      tech: ['Anthropic Claude', 'GitHub API', 'Hyperliquid API', 'CoinGecko', 'Make.com', 'Nodemailer'],
    },
    {
      key: 'infra',
      icon: '🚀',
      title: t('stack.layers.infra.title'),
      desc: t('stack.layers.infra.desc'),
      tech: ['Fly.io (Paris)', 'Docker multi-stage', 'MongoDB Atlas', 'GitHub Actions', 'gcn-data.fr'],
    },
  ];

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">
        {t('stack.layersTitle')}
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
        {layers.map((l) => (
          <div
            key={l.key}
            className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 hover:border-accent-border transition-colors"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{l.icon}</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text">{l.title}</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-dark-muted mb-4">{l.desc}</p>
            <div className="flex flex-wrap gap-1.5">
              {l.tech.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-1 rounded-md bg-accent/10 text-accent border border-accent-border"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Decisions() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(0);

  const decisions = [
    'mongo',
    'flyio',
    'webhook',
    'analytics',
    'webhookGeneric',
    'snapscroll',
  ];

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-2">
        {t('stack.decisionsTitle')}
      </h2>
      <p className="text-gray-600 dark:text-dark-muted mb-6">
        {t('stack.decisionsSubtitle')}
      </p>
      <div className="space-y-2">
        {decisions.map((key, i) => (
          <DecisionItem
            key={key}
            isOpen={open === i}
            onToggle={() => setOpen(open === i ? -1 : i)}
            title={t(`stack.decisions.${key}.title`)}
            choice={t(`stack.decisions.${key}.choice`)}
            reasoning={t(`stack.decisions.${key}.reasoning`)}
            tradeoff={t(`stack.decisions.${key}.tradeoff`)}
          />
        ))}
      </div>
    </section>
  );
}

function DecisionItem({ isOpen, onToggle, title, choice, reasoning, tradeoff }) {
  const { t } = useTranslation();
  return (
    <div
      className={`bg-white dark:bg-dark-bg2 rounded-xl border transition-all ${
        isOpen ? 'border-accent-border' : 'border-gray-200 dark:border-dark-border'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-dark-text">{title}</h3>
          <p className="text-sm text-accent mt-0.5 font-mono">→ {choice}</p>
        </div>
        <span
          className={`text-gray-400 ml-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 space-y-3 border-t border-gray-100 dark:border-dark-border pt-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-muted mb-1">
              {t('stack.decisions.reasoning')}
            </h4>
            <p className="text-sm text-gray-700 dark:text-dark-text whitespace-pre-line">{reasoning}</p>
          </div>
          {tradeoff && tradeoff !== 'stack.decisions.tradeoff' && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-muted mb-1">
                {t('stack.decisions.tradeoffLabel')}
              </h4>
              <p className="text-sm text-gray-700 dark:text-dark-text whitespace-pre-line">{tradeoff}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Lessons() {
  const { t } = useTranslation();
  const items = ['1', '2', '3', '4'];
  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-6">
        {t('stack.lessonsTitle')}
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
        {items.map((i) => (
          <div
            key={i}
            className="bg-gradient-to-br from-accent/5 to-transparent rounded-xl border border-accent-border p-5"
          >
            <div className="text-xs font-bold text-accent uppercase tracking-widest mb-2">
              {t('stack.lessons.label')} {i}
            </div>
            <p className="text-gray-800 dark:text-dark-text leading-relaxed">
              {t(`stack.lessons.${i}`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
