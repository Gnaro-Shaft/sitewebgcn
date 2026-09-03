// Validation du post LinkedIn rédigé à la main dans le tableau de bord.
//
// Ce module NE construit plus de post. Il l'a fait jusqu'en août 2026 :
// corps = les 2600 premiers caractères de l'article convertis en texte plat,
// suivis d'une tagline constante, plus un premier commentaire lui aussi
// constant. Résultat : chaque post avait la même forme, la même longueur et
// la même chute. La portée est tombée de 759 à 28 impressions au fil de la
// série. Un gabarit qui varie ne corrige pas ça — il produit la même série
// avec plus de références. Le texte est donc écrit à la main, et le seul
// rôle qui reste ici est de refuser ce qui ne peut pas partir.
//
// Le contrat consommé par n8n est inchangé : /api/social/pending sert
// toujours { text, firstComment }. Le workflow n'a pas besoin d'être
// réimporté sur homeserv01.

const SITE_URL = process.env.SITE_URL || 'https://gcn-data.fr';

// Borne haute sûre pour le corps du post. LinkedIn coupe à 3000 caractères
// mais un caractère Unicode (emoji) peut consommer 2 unités de code — 2600
// laisse de la marge sous la limite dure.
const MAX_POST_CHARS = 2600;

// Plancher volontairement bas : il attrape la soumission vide ou accidentelle,
// pas la brièveté. Un post court et dense est un bon post LinkedIn — ce n'est
// pas au serveur d'avoir un avis là-dessus.
const MIN_POST_CHARS = 50;

// Les commentaires LinkedIn sont coupés à 1250 caractères. Au-delà, l'API
// refuse et n8n marque l'article `failed` — autant le refuser ici, où le
// message d'erreur arrive à quelqu'un qui peut corriger.
const MAX_COMMENT_CHARS = 1250;

function articleUrl(article) {
  return `${SITE_URL}/blog/${article.slug}`;
}

// Valide le corps du post. Retourne { ok: true } ou { ok: false, error }.
// L'appelant décide du code HTTP — ce module ne connaît pas Express.
function validatePostText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: 'Le texte du post est requis' };
  }

  const trimmed = text.trim();

  if (trimmed.length < MIN_POST_CHARS) {
    return {
      ok: false,
      error: `Le texte du post fait ${trimmed.length} caractères, minimum ${MIN_POST_CHARS}`,
    };
  }
  if (trimmed.length > MAX_POST_CHARS) {
    return {
      ok: false,
      error: `Le texte du post fait ${trimmed.length} caractères, maximum ${MAX_POST_CHARS}`,
    };
  }

  return { ok: true };
}

// Valide le premier commentaire. Le vide est licite : l'appelant y met alors
// l'URL canonique. Seule la longueur est contrôlée.
function validateFirstComment(comment) {
  if (comment == null || comment === '') return { ok: true };
  if (typeof comment !== 'string') {
    return { ok: false, error: 'Le commentaire doit être du texte' };
  }

  const trimmed = comment.trim();
  if (trimmed.length > MAX_COMMENT_CHARS) {
    return {
      ok: false,
      error: `Le commentaire fait ${trimmed.length} caractères, maximum ${MAX_COMMENT_CHARS}`,
    };
  }

  return { ok: true };
}

module.exports = {
  articleUrl,
  validatePostText,
  validateFirstComment,
  MAX_POST_CHARS,
  MIN_POST_CHARS,
  MAX_COMMENT_CHARS,
};
