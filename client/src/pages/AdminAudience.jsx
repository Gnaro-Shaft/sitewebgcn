// Audience de gnaro.fr, en détail : série par jour, pages, origines, robots.
//
// Tout vient d'agrégats calculés chaque nuit sur le VPS (audience.py du dépôt
// gnaro). Aucune adresse, aucun identifiant : des comptes. La période se
// choisit en jours ; la variation compare à la période précédente de même
// longueur.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import CitationsGrille from '../components/CitationsGrille';

const PERIODES = [7, 30, 90, 365];
const ORIGINES = [
  ['ia', 'Assistants IA (ChatGPT, Perplexity, Claude, Gemini, Copilot)'],
  ['moteurs', 'Moteurs de recherche'],
  ['linkedin', 'LinkedIn'],
  ['plateformes', 'Malt, Free-Work'],
  ['autres', 'Autres sites'],
  ['direct', 'Sans référent'],
];

export default function AdminAudience() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [jours, setJours] = useState(30);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let vivant = true;
    api
      .get(`/audience/resume?jours=${jours}`)
      .then((res) => { if (vivant) { setData(res.data.data); setErreur(null); } })
      .catch((e) => { if (vivant) setErreur(e.response?.data?.error || e.message); });
    return () => { vivant = false; };
  }, [jours]);

  const maxVues = data ? Math.max(1, ...data.serie.map((j) => j.vues)) : 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-dark-bg2/80 backdrop-blur-md border-b border-gray-200 dark:border-dark-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-xl font-bold tracking-tight text-gray-900 dark:text-dark-text">
              G<span className="text-accent">.</span>
            </Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <Link to="/dashboard" className="text-sm text-gray-400 dark:text-dark-muted hover:text-accent">Dashboard</Link>
            <span className="text-sm text-gray-400 dark:text-dark-muted">/</span>
            <span className="text-sm font-medium text-gray-900 dark:text-dark-text">Audience gnaro.fr</span>
          </div>
          <button
            onClick={() => { navigate('/login'); setTimeout(() => logout(), 10); }}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-muted hover:text-red-500 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Audience de gnaro.fr</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-dark-muted">
              Comptes agrégés chaque nuit sur le serveur, robots exclus des vues. Aucune donnée personnelle.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-gray-200 dark:border-dark-border p-1">
            {PERIODES.map((p) => (
              <button
                key={p}
                onClick={() => setJours(p)}
                className={`px-3 py-1 text-xs rounded-md ${p === jours ? 'bg-accent text-dark-bg font-semibold' : 'text-gray-600 dark:text-dark-muted hover:text-accent'}`}
              >
                {p} j
              </button>
            ))}
          </div>
        </div>

        {erreur && (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {erreur}
          </div>
        )}

        {data && data.vide && (
          <p className="text-sm text-gray-400 dark:text-dark-muted">Aucune donnée d'audience pour l'instant.</p>
        )}

        {data && !data.vide && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Chiffre label={`Vues, ${data.du} → ${data.au}`} value={data.vues} accent />
              <Chiffre label="Vues de la page contact" value={data.contact} />
              <Chiffre label="Par rapport à la période précédente" value={data.variation === null ? '—' : `${data.variation > 0 ? '+' : ''}${data.variation} %`} />
              <Chiffre label="Jours avec trafic" value={`${data.joursAvecTrafic} / ${data.jours}`} />
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <Carte titre="Vues par jour" className="lg:col-span-2">
                <ul className="space-y-1">
                  {data.serie.map((j) => (
                    <li key={j.jour} className="flex items-center gap-3 text-xs">
                      <span className="w-24 shrink-0 tabular-nums text-gray-500 dark:text-dark-muted">{j.jour}</span>
                      <div className="flex-1 h-3 rounded bg-gray-100 dark:bg-dark-bg3 overflow-hidden">
                        <div className="h-3 bg-accent" style={{ width: `${Math.round((100 * j.vues) / maxVues)}%` }} />
                      </div>
                      <span className="w-10 text-right tabular-nums text-gray-900 dark:text-dark-text">{j.vues}</span>
                      <span className="w-28 text-right tabular-nums text-gray-400 dark:text-dark-muted" title="IA · moteurs · LinkedIn">
                        {j.ia} · {j.moteurs} · {j.linkedin}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-gray-400 dark:text-dark-muted">Colonne de droite : visites venues d'assistants IA · de moteurs · de LinkedIn.</p>
              </Carte>

              <Carte titre="Origine des visites">
                <Repartition items={ORIGINES.map(([k, label]) => [label, data.origines[k] || 0])} />
                <h4 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-muted">Passages de robots d'indexation</h4>
                <Repartition items={[['Robots des assistants IA', data.robots.ia || 0], ['Googlebot, Bingbot', data.robots.moteurs || 0]]} />
              </Carte>
            </section>

            <Carte titre={`Pages vues (${data.pages.length})`}>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 dark:text-dark-muted">
                  <tr><th className="text-left py-1">Page</th><th className="text-right py-1">Vues</th><th className="text-right py-1">Part</th></tr>
                </thead>
                <tbody>
                  {data.pages.map((p) => (
                    <tr key={p.page} className="border-t border-gray-100 dark:border-dark-border">
                      <td className="py-1.5 font-mono text-xs text-gray-900 dark:text-dark-text break-all">{p.page}</td>
                      <td className="py-1.5 text-right tabular-nums">{p.vues}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-500 dark:text-dark-muted">{p.part} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Carte>
          </>
        )}

        <CitationsGrille />
      </main>
    </div>
  );
}

function Chiffre({ label, value, accent }) {
  return (
    <div className="bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-5">
      <p className="text-xs text-gray-500 dark:text-dark-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? 'text-accent' : 'text-gray-900 dark:text-dark-text'}`}>{value}</p>
    </div>
  );
}

function Carte({ titre, className = '', children }) {
  return (
    <div className={`bg-white dark:bg-dark-bg2 rounded-xl border border-gray-200 dark:border-dark-border p-6 ${className}`}>
      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-4">{titre}</h3>
      {children}
    </div>
  );
}

function Repartition({ items }) {
  const total = items.reduce((n, [, v]) => n + v, 0) || 1;
  return (
    <ul className="space-y-2">
      {items.map(([label, v]) => (
        <li key={label} className="text-xs">
          <div className="flex justify-between text-gray-600 dark:text-dark-muted">
            <span>{label}</span><span className="tabular-nums">{v} · {Math.round((100 * v) / total)} %</span>
          </div>
          <div className="h-1.5 rounded bg-gray-100 dark:bg-dark-bg3"><div className="h-1.5 rounded bg-accent" style={{ width: `${Math.round((100 * v) / total)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
