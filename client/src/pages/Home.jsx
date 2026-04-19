import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO';
import MatrixRain from '../components/ui/MatrixRain';
import Hero from '../components/sections/Hero';
import About from '../components/sections/About';
import Skills from '../components/sections/Skills';
import Projects from '../components/sections/Projects';
import Contact from '../components/sections/Contact';

export default function Home() {
  const { t } = useTranslation();

  // Home page uses snap-scroll — lock body scroll to avoid double scrollbar
  useEffect(() => {
    document.body.classList.add('home-page');
    return () => document.body.classList.remove('home-page');
  }, []);

  return (
    <>
      <SEO />
      {/* Matrix rain — fixed behind everything */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <MatrixRain />
      </div>

      {/* Scroll-snap container */}
      <div className="snap-container">
        <section id="hero" className="snap-section">
          <Hero />
        </section>

        <section id="about" className="snap-section">
          <About />
        </section>

        <section id="skills" className="snap-section">
          <Skills />
        </section>

        <section id="projects" className="snap-section">
          <Projects limit={6} />
        </section>

        <section id="contact" className="snap-section">
          <Contact />
          <footer className="absolute bottom-4 left-0 right-0 text-center text-sm text-gray-500 dark:text-dark-muted">
            &copy; {new Date().getFullYear()} Genaro-Cedric. {t('footer.rights')}
          </footer>
        </section>
      </div>
    </>
  );
}
