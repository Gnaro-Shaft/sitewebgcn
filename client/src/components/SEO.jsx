import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';

const DEFAULT_IMAGE = 'https://gcn-data.fr/og-image.png';
const DEFAULT_URL = 'https://gcn-data.fr';

export default function SEO({ title, description, image, url, type = 'website' }) {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const defaultTitle = lang === 'fr'
    ? 'Genaro-Cedric NISUS — Developpeur Fullstack & Ingenieur IA'
    : 'Genaro-Cedric NISUS — Fullstack Developer & AI Engineer';

  const defaultDescription = lang === 'fr'
    ? 'Portfolio de Genaro-Cedric NISUS. Developpeur Fullstack et Ingenieur IA en formation. Projets production, dashboard trading live, blog tech.'
    : 'Portfolio of Genaro-Cedric NISUS. Fullstack Developer and AI Engineer in training. Production projects, live trading dashboard, tech blog.';

  const seoTitle = title ? `${title} — GCN` : defaultTitle;
  const seoDescription = description || defaultDescription;
  const seoImage = image || DEFAULT_IMAGE;
  const seoUrl = url || DEFAULT_URL;

  return (
    <Helmet>
      <html lang={lang} />
      <title>{seoTitle}</title>
      <meta name="description" content={seoDescription} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:image" content={seoImage} />
      <meta property="og:url" content={seoUrl} />
      <meta property="og:site_name" content="Genaro-Cedric NISUS" />
      <meta property="og:locale" content={lang === 'fr' ? 'fr_FR' : 'en_US'} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      <meta name="twitter:image" content={seoImage} />

      {/* Canonical */}
      <link rel="canonical" href={seoUrl} />
    </Helmet>
  );
}
