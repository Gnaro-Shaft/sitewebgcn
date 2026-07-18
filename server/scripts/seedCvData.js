// One-shot seed for CvData. Idempotent — safe to re-run.
//
// Populates 2 documents (fr, en) with the current CV content matching
// the site's Ingénieur Data & IA positioning (Phase 23 pivot).
//
// USAGE:
//   node server/scripts/seedCvData.js               # populate + confirm
//   node server/scripts/seedCvData.js --dry-run     # preview only
//
// Requires MONGODB_URI. After running, `/api/cv/download?lang=fr|en` will
// generate the PDF from these docs. Admin UI (Phase 25 Session B) will
// let me edit them without touching this script again.

require('dotenv').config();
const mongoose = require('mongoose');
const CvData = require('../models/CvData');

const DRY_RUN = process.argv.includes('--dry-run');

const CONTACT = {
  email: 'gc.nisus@outlook.fr',
  phone: '+33 6 98 45 02 89',
  location: 'Suresnes (92), France',
  website: 'gcn-data.fr',
  github: 'github.com/Gnaro-Shaft',
  linkedin: 'linkedin.com/in/gcnisus',
};

const DOCS = [
  {
    lang: 'fr',
    fullName: 'GENARO-CEDRIC NISUS',
    title: 'Ingénieur Data & IA',
    ...CONTACT,
    summary:
      "Ingénieur Data & IA avec 7+ ans en environnements techniques critiques (C2S Bouygues / TF1). Je conçois des systèmes d'IA de qualité production : RAG self-hosted évalué à 90 % de précision (Mnemo), assistant IA multi-agents (Jarvis Local), et bot de trading crypto avec filtre ML déployé 24/7 (Hyperliquid V8). Certifié Chef de projet développement web/mobile (La Capsule, RNCP niv. 6). Focus finance et crypto.",
    experience: [
      {
        role: 'Technicien Informatique & Mobile',
        company: 'C2S Bouygues (mission TF1)',
        location: 'Boulogne-Billancourt',
        startDate: 'Juin 2018',
        endDate: 'Présent',
        description:
          "Support technique niveau 2 en environnement Windows/AD/O365, incidents complexes et procédures — le réflexe transféré à l'ingénierie IA : décortiquer un système, remonter à la cause racine, ne rien lâcher.",
        highlights: [
          '30+ incidents/jour, taux de résolution N1 > 85 %',
          "Analyse data-driven des tendances d'incidents pour améliorer les processus",
          'Formation et supervision de 5 techniciens, procédures standardisées',
          'Administration AD, déploiement postes, gestion droits et sécurité SI',
        ],
      },
      {
        role: 'Technicien Helpdesk',
        company: 'Eiffage',
        location: 'La Défense',
        startDate: '2017',
        endDate: '2018',
        description:
          'Support technique N2 pour 500+ utilisateurs : diagnostic, résolution et escalade en environnement ITIL.',
        highlights: [],
      },
      {
        role: 'Conseiller Clientèle',
        company: 'Bouygues Telecom',
        location: '',
        startDate: '2007',
        endDate: '2017',
        description:
          "Gestion d'un portefeuille de 200+ clients B2B/B2C : analyse besoins, conseil technique, suivi KPIs. Management d'équipe.",
        highlights: [],
      },
    ],
    education: [
      {
        degree: 'Artificial Intelligence Essentials',
        school: 'Jedha',
        location: '',
        startDate: '',
        endDate: 'Avril 2026',
        description:
          "Formation intensive IA appliquée : Python pour l'IA, intégration et personnalisation de LLMs, conception d'agents IA, prompt engineering, RAG + bases vectorielles, workflows automatisés (n8n), APIs, évaluation de modèles. Certifié (voir Certifications).",
      },
      {
        degree: "Chef de projet de développement d'applications web et mobile",
        school: 'La Capsule',
        location: 'Paris',
        startDate: 'Oct. 2021',
        endDate: 'Déc. 2021',
        description:
          'Bootcamp intensif full-stack (13 semaines). Front-end HTML5/CSS/JS, back-end Node.js/Express, MongoDB, Git/GitHub. Certifié RNCP Niveau 6 (voir Certifications).',
      },
      {
        degree: 'Technicien Informatique Systèmes et Réseaux',
        school: 'GEFI',
        location: '',
        startDate: '',
        endDate: '2017',
        description: 'Certification Professionnelle Niveau 5 (Bac+2).',
      },
    ],
    skills: [
      {
        category: 'IA & Machine Learning',
        items: [
          'Python', 'scikit-learn', 'Machine Learning', 'RAG', 'Embeddings (bge-m3)',
          'Qdrant', 'LLM (Claude API, OpenAI API)', 'MCP', 'Prompt Engineering',
          'Pandas', 'NumPy',
        ],
      },
      {
        category: 'Backend',
        items: ['FastAPI', 'Node.js', 'Express.js', 'API REST', 'MongoDB', 'PostgreSQL', 'Mongoose'],
      },
      {
        category: 'Frontend',
        items: ['React.js', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3'],
      },
      {
        category: 'DevOps & Cloud',
        items: ['Git', 'GitHub', 'Docker', 'Fly.io', 'Render', 'Vercel', 'CI/CD', 'Linux'],
      },
      {
        category: 'Infrastructure IT',
        items: ['ITIL', 'Helpdesk N2/N3', 'Active Directory', 'Windows Server', 'TCP/IP', 'WAN/LAN'],
      },
    ],
    projects: [
      {
        name: 'Mnemo — RAG self-hosted sur ma vault Obsidian',
        techStack: ['Python', 'FastAPI', 'Qdrant', 'bge-m3', 'Docker Compose'],
        description:
          'Système RAG production sur mes notes personnelles. A/B testing des modèles d\'embeddings avec benchmark de 20 queries — Hit@1 passé de 30 % (nomic-embed-text) à 90 % (bge-m3). Pipeline dockerisé complet.',
        link: 'gcn-data.fr/projects (Mnemo)',
        highlights: [
          'Hit@1 : 30 % → 90 % en changeant juste le modèle d\'embeddings',
          'Ingestion incrémentale + chunking + Qdrant en production',
        ],
        startDate: '2024',
        endDate: 'présent',
      },
      {
        name: 'Hyperliquid Trading Bot V8 — bot ML de trading crypto',
        techStack: ['Python', 'scikit-learn', 'MongoDB', 'WebSocket', 'Fly.io'],
        description:
          'Bot de trading crypto déployé 24/7 sur Fly.io. Scoring multi-timeframe filtré par un modèle ML (scikit-learn) avec réentraînement automatique toutes les 6h — pattern champion/challenger, holdout de validation, garde anti-régression.',
        link: '',
        highlights: [
          'Réentraînement ML 6h avec champion/challenger + holdout validation',
          'Gestion du risque : exposure caps, circuit breaker, corrélation BTC/SOL',
          'Observabilité : logs de décisions structurés + heartbeat visualisés dans un dashboard React perso',
        ],
        startDate: '2024',
        endDate: 'présent',
      },
      {
        name: 'Jarvis Local — assistant IA multi-agents',
        techStack: ['Python', 'Claude API', 'MCP'],
        description:
          'Assistant personnel multi-agents utilisant Claude via MCP (Model Context Protocol). Recherche vault Obsidian, prise de notes, synthèse email, planification.',
        link: '',
        highlights: [],
        startDate: '2024',
        endDate: 'présent',
      },
    ],
    languages: [
      { name: 'Français', level: 'Natif' },
      { name: 'Anglais', level: 'Professionnel' },
    ],
    certifications: [
      {
        name: 'Artificial Intelligence Essentials',
        issuer: 'Jedha',
        date: 'Avril 2026 (sans expiration)',
        description:
          "Compétences validées : Python pour l'IA, intégration et personnalisation de LLMs (IA générative), conception d'agents IA capables d'utiliser des outils, prompt engineering, RAG avec bases vectorielles, pipelines et workflows d'IA automatisés (n8n), connexion de données (APIs, bases de données) aux applications d'IA, évaluation et amélioration des modèles.",
      },
      {
        name: "Chef de projet de développement d'applications web et mobile",
        issuer: 'La Capsule — Coding Bootcamp 13 semaines (RNCP Niveau 6, Bac+3/4)',
        date: 'oct. 2021 – déc. 2021',
        description:
          "Modules : conception et prototypage d'applications web ; front-end HTML5 / CSS / JavaScript ; back-end Node.js / Express ; base de données MongoDB ; workflow Git / GitHub.",
      },
    ],
  },
  // English mirror
  {
    lang: 'en',
    fullName: 'GENARO-CEDRIC NISUS',
    title: 'Data & AI Engineer',
    ...CONTACT,
    summary:
      "Data & AI Engineer with 7+ years in mission-critical technical environments (C2S Bouygues / TF1). I build production-grade AI systems: a self-hosted RAG evaluated at 90% precision (Mnemo), a multi-agent AI assistant (Jarvis Local), and a crypto trading bot with an ML filter deployed 24/7 (Hyperliquid V8). Certified web/mobile development project manager (La Capsule, RNCP level 6). Focus on finance and crypto.",
    experience: [
      {
        role: 'IT & Mobile Technician',
        company: 'C2S Bouygues (TF1 assignment)',
        location: 'Boulogne-Billancourt, France',
        startDate: 'June 2018',
        endDate: 'Present',
        description:
          'Level 2 technical support in Windows/AD/O365 environment. Key reflex transferred to AI engineering: dissect a system, trace a flow back to its root cause, never give up until it works.',
        highlights: [
          '30+ incidents/day, L1 resolution rate > 85%',
          'Data-driven analysis of incident trends to improve processes',
          'Trained and supervised a 5-person technician team, standardized procedures',
          'Managed Active Directory, workstation deployment, permissions and IT security',
        ],
      },
      {
        role: 'Helpdesk Technician',
        company: 'Eiffage',
        location: 'La Défense, France',
        startDate: '2017',
        endDate: '2018',
        description:
          'L2 technical support for 500+ users: diagnosis, resolution and escalation of incidents in an ITIL environment.',
        highlights: [],
      },
      {
        role: 'Customer Advisor',
        company: 'Bouygues Telecom',
        location: 'France',
        startDate: '2007',
        endDate: '2017',
        description:
          'Managed a portfolio of 200+ B2B/B2C clients: needs analysis, technical advisory, KPI tracking. Team management.',
        highlights: [],
      },
    ],
    education: [
      {
        degree: 'Artificial Intelligence Essentials',
        school: 'Jedha',
        location: '',
        startDate: '',
        endDate: 'April 2026',
        description:
          'Intensive applied AI training: Python for AI systems, integrating and customizing LLMs, designing AI agents, prompt engineering, RAG + vector databases, automated pipelines (n8n), APIs, model evaluation. Certified (see Certifications).',
      },
      {
        degree: 'Web & Mobile Application Development Project Manager',
        school: 'La Capsule',
        location: 'Paris, France',
        startDate: 'Oct. 2021',
        endDate: 'Dec. 2021',
        description:
          'Intensive full-stack bootcamp (13 weeks). Front-end HTML5/CSS/JS, back-end Node.js/Express, MongoDB, Git/GitHub. RNCP Level 6 certified (see Certifications).',
      },
      {
        degree: 'IT Systems & Networks Technician',
        school: 'GEFI',
        location: '',
        startDate: '',
        endDate: '2017',
        description: 'Professional Certification Level 5 (Associate equivalent).',
      },
    ],
    skills: [
      {
        category: 'AI & Machine Learning',
        items: [
          'Python', 'scikit-learn', 'Machine Learning', 'RAG', 'Embeddings (bge-m3)',
          'Qdrant', 'LLMs (Claude API, OpenAI API)', 'MCP', 'Prompt Engineering',
          'Pandas', 'NumPy',
        ],
      },
      {
        category: 'Backend',
        items: ['FastAPI', 'Node.js', 'Express.js', 'REST API', 'MongoDB', 'PostgreSQL', 'Mongoose'],
      },
      {
        category: 'Frontend',
        items: ['React.js', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3'],
      },
      {
        category: 'DevOps & Cloud',
        items: ['Git', 'GitHub', 'Docker', 'Fly.io', 'Render', 'Vercel', 'CI/CD', 'Linux'],
      },
      {
        category: 'IT Infrastructure',
        items: ['ITIL', 'Helpdesk L2/L3', 'Active Directory', 'Windows Server', 'TCP/IP', 'WAN/LAN'],
      },
    ],
    projects: [
      {
        name: 'Mnemo — Self-hosted RAG for my Obsidian vault',
        techStack: ['Python', 'FastAPI', 'Qdrant', 'bge-m3', 'Docker Compose'],
        description:
          'Production-grade RAG on my personal notes. A/B tested embedding models on a 20-query benchmark — Hit@1 lifted from 30% (nomic-embed-text) to 90% (bge-m3). Fully dockerized pipeline.',
        link: 'gcn-data.fr/projects (Mnemo)',
        highlights: [
          'Hit@1: 30% → 90% by swapping just the embedding model',
          'Incremental ingestion + chunking + Qdrant in production',
        ],
        startDate: '2024',
        endDate: 'present',
      },
      {
        name: 'Hyperliquid Trading Bot V8 — ML-driven crypto trading bot',
        techStack: ['Python', 'scikit-learn', 'MongoDB', 'WebSocket', 'Fly.io'],
        description:
          'Crypto trading bot deployed 24/7 on Fly.io. Multi-timeframe scoring filtered by an ML model (scikit-learn) with automatic 6-hour retraining — champion/challenger pattern, holdout validation, anti-regression guard.',
        link: '',
        highlights: [
          '6-hour ML retraining with champion/challenger + holdout validation',
          'Risk management: exposure caps, circuit breaker, BTC/SOL correlation gate',
          'Observability: structured decision logs + heartbeat visualized in a personal React dashboard',
        ],
        startDate: '2024',
        endDate: 'present',
      },
      {
        name: 'Jarvis Local — Multi-agent AI assistant',
        techStack: ['Python', 'Claude API', 'MCP'],
        description:
          'Personal multi-agent assistant using Claude via MCP (Model Context Protocol). Obsidian vault search, note-taking, email summarization, planning.',
        link: '',
        highlights: [],
        startDate: '2024',
        endDate: 'present',
      },
    ],
    languages: [
      { name: 'French', level: 'Native' },
      { name: 'English', level: 'Professional' },
    ],
    certifications: [
      {
        name: 'Artificial Intelligence Essentials',
        issuer: 'Jedha',
        date: 'April 2026 (no expiration)',
        description:
          'Validated skills: Python for AI, integrating and customizing generative AI models (LLMs), designing AI agents capable of using tools, prompt engineering, RAG with vector databases, automated AI pipelines and workflows (n8n), connecting data sources (APIs, databases) to AI applications, evaluating and improving model performance.',
      },
      {
        name: 'Web & Mobile Application Development Project Manager',
        issuer: 'La Capsule — 13-week Coding Bootcamp (RNCP Level 6, Bachelor equivalent)',
        date: 'Oct. 2021 – Dec. 2021',
        description:
          'Modules: web application design and prototyping; front-end HTML5 / CSS / JavaScript; back-end Node.js / Express; MongoDB database; Git / GitHub workflow.',
      },
    ],
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI missing from env. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`✅ Connected to MongoDB${DRY_RUN ? ' (DRY-RUN MODE)' : ''}`);

  for (const doc of DOCS) {
    const existing = await CvData.findOne({ lang: doc.lang });
    if (existing) {
      console.log(`→ [${doc.lang}] existing document found (_id=${existing._id})`);
      if (DRY_RUN) {
        console.log('   dry-run — no changes');
      } else {
        Object.assign(existing, doc);
        await existing.save();
        console.log('   updated');
      }
    } else {
      console.log(`→ [${doc.lang}] no document — will create`);
      if (!DRY_RUN) {
        const created = await CvData.create(doc);
        console.log(`   created (_id=${created._id})`);
      }
    }
  }

  console.log(`\nDone${DRY_RUN ? ' (dry-run — no writes performed)' : ''}.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Script failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
