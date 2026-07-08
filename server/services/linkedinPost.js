// Builders for the LinkedIn post payload consumed by n8n.
//
// Two outputs per article:
//   - text: the body of the LinkedIn post, up to ~2600 chars of the article
//           content converted from markdown to LinkedIn-friendly plain text,
//           truncated at the last paragraph boundary + a tagline pointing
//           readers to the first comment.
//   - firstComment: a single-line comment with the canonical blog URL.
//
// Rationale for the two-node approach: LinkedIn's algorithm ranks posts
// with external URLs 5–10× lower. Moving the URL to a comment recovers
// most of that penalty while keeping the canonical link discoverable.
// See CHANGELOG Phase 24 for the full rationale.

const SITE_URL = process.env.SITE_URL || 'https://gcn-data.fr';

// Safe upper bound for the post body. LinkedIn feed posts cap at 3000 chars
// but Unicode characters (emojis) can consume 2+ code units — 2600 leaves
// room for the tagline + surprise chars, well under the hard limit.
const MAX_POST_CHARS = 2600;
const TAGLINE = '\n\n🔽 Article complet + le lien en commentaire ↓';

function articleUrl(article) {
  return `${SITE_URL}/blog/${article.slug}`;
}

// Convert an article's markdown content into a LinkedIn-friendly plain text.
// LinkedIn feed posts don't render markdown at all — we strip syntax and
// preserve structure via line breaks and bullet substitutions.
//
// Handled constructs (in order — order matters for some replacements):
//   - Code fences  ```lang\n…\n```  →  the inner content, un-fenced
//   - Inline code  `x`              →  x  (backticks removed)
//   - Images       ![alt](src)      →  dropped
//   - Links        [text](url)      →  text  (URL stripped, LinkedIn would
//                                             penalize inline URLs anyway)
//   - Bold         **x** / __x__    →  x
//   - Italic       *x* / _x_        →  x  (careful not to eat list bullets)
//   - Headings     ##.. Title       →  Title  (with a blank line after)
//   - Blockquotes  > quoted         →  ❯ quoted
//   - Ordered      "1. item"        →  kept as-is (renders fine on LinkedIn)
//   - Unordered    "- item" / "* i" →  "• item"
//   - HR           ---              →  dropped (visual noise on LinkedIn)
function markdownToLinkedInText(md) {
  if (!md || typeof md !== 'string') return '';

  let text = md;

  // 1. Fenced code blocks — keep the content, drop the fence + lang tag.
  //    Multi-line, greedy up to the closing fence.
  text = text.replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, (_, code) => code.trim());

  // 2. Images — dropped entirely (no visual on LinkedIn text posts).
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 3. Links — keep the visible text, drop the URL.
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 4. Inline code — drop backticks, keep content.
  text = text.replace(/`([^`]+)`/g, '$1');

  // 5. Bold — **x** and __x__ both drop the wrapping markers.
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');

  // 6. Italic — *x* and _x_. Applied after bold to avoid double-processing.
  //    Regex is careful: single * / _ not inside a word, no leading whitespace
  //    weirdness. This one is the most bug-prone; keep it last among wrappers.
  text = text.replace(/(?<![*\w])\*([^*\n]+)\*(?!\w)/g, '$1');
  text = text.replace(/(?<![_\w])_([^_\n]+)_(?!\w)/g, '$1');

  // 7. Headings — strip the leading #s, keep the title text, ensure a blank
  //    line follows so headings visually separate on LinkedIn.
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '$1');

  // 8. Blockquotes — use a heavier arrow so it reads intentional on LinkedIn.
  text = text.replace(/^>\s?/gm, '❯ ');

  // 9. Unordered lists — normalize both "-" and "*" to a bullet char.
  //    Only when at the start of a line (after possible indentation).
  text = text.replace(/^(\s*)[-*]\s+/gm, '$1• ');

  // 10. Horizontal rules — drop (they're layout noise).
  text = text.replace(/^\s*---+\s*$/gm, '');

  // 11. Collapse 3+ consecutive newlines into 2 (a single blank line).
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

// Truncate at the last paragraph boundary (\n\n) before the budget.
// Falls back to a hard cut with an ellipsis if no paragraph boundary is
// available (e.g. one gigantic paragraph). Never returns an empty string
// unless the input was empty.
function truncateAtParagraph(text, budget) {
  if (text.length <= budget) return text;

  const window = text.slice(0, budget);
  const lastBreak = window.lastIndexOf('\n\n');
  if (lastBreak >= budget * 0.5) {
    // Found a natural break at least halfway into the budget — use it.
    return text.slice(0, lastBreak).trimEnd();
  }
  // No paragraph break available — hard cut at a word boundary + ellipsis.
  const lastSpace = window.lastIndexOf(' ');
  const cut = lastSpace > 0 ? lastSpace : budget;
  return text.slice(0, cut).trimEnd() + '…';
}

// Build the LinkedIn post body from an article. Returns a plain string
// ready to send. The URL is NOT included — it goes into firstComment.
function buildLinkedInPost(article) {
  const converted = markdownToLinkedInText(article.content || '');

  // Reserve room for the tagline, then truncate the body.
  const bodyBudget = MAX_POST_CHARS - TAGLINE.length;
  const body = truncateAtParagraph(converted, bodyBudget);

  // If the body is empty (empty/missing content), drop the tagline's leading
  // blank lines so we don't ship a post that starts with visible whitespace.
  return body ? `${body}${TAGLINE}` : TAGLINE.trimStart();
}

// Build the first comment: canonical URL + tagline. Deliberately short so
// LinkedIn's comment preview shows the whole thing without truncation.
function buildLinkedInFirstComment(article) {
  return `🔗 Article complet + tous mes autres écrits : ${articleUrl(article)}`;
}

module.exports = {
  buildLinkedInPost,
  buildLinkedInFirstComment,
  markdownToLinkedInText,
  truncateAtParagraph,
  articleUrl,
  MAX_POST_CHARS,
  TAGLINE,
};
