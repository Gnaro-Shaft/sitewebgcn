// Pure helpers shared by ArticleCard + FeaturedArticleCard.
// No React, no DOM — testable in vitest under server/__tests__.

// 8 Tailwind gradient palettes for procedural article covers.
// Each entry is a `from-... to-...` pair tuned for both light + dark.
// Order matters — index is used by hashSlug below.
export const GRADIENT_PALETTES = [
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-indigo-600',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-purple-600',
  'from-cyan-500 to-blue-600',
  'from-lime-500 to-green-600',
  'from-rose-500 to-pink-600',
  'from-slate-500 to-zinc-600',
];

// djb2-style hash → modulo. Deterministic: same slug always picks the
// same palette across reloads. Returns the gradient class string.
export function gradientForSlug(slug) {
  if (!slug) return GRADIENT_PALETTES[0];
  let hash = 5381;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) + hash + slug.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % GRADIENT_PALETTES.length;
  return GRADIENT_PALETTES[idx];
}

// Tag-to-color map. Lowercase keys. Border + text use the color,
// background is opacity-10 to stay quiet. Fallback = neutral gray.
const TAG_COLORS = {
  claude: '#8b5cf6',
  ai: '#8b5cf6',
  rag: '#6366f1',
  embeddings: '#6366f1',
  python: '#3b82f6',
  node: '#3b82f6',
  devops: '#f97316',
  docker: '#f97316',
  eval: '#84cc16',
  tests: '#84cc16',
  data: '#06b6d4',
  react: '#ec4899',
  frontend: '#ec4899',
};

export function colorForTag(tag) {
  if (!tag) return null;
  return TAG_COLORS[String(tag).toLowerCase()] || null;
}

// Inline style for a tag chip. Returns {} for unknown tags so the
// component falls back to its default gray Tailwind classes.
export function tagChipStyle(tag) {
  const color = colorForTag(tag);
  if (!color) return {};
  return {
    color,
    borderColor: color,
    backgroundColor: color + '1a', // hex + 10% alpha
  };
}
