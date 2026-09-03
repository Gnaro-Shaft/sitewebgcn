const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
    },
    excerpt: {
      type: String,
      maxlength: 300,
    },
    tags: {
      type: [String],
      default: [],
    },
    published: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
    // Per-platform status of the LinkedIn/X publication queue. Status values:
    //   'pending'  — never queued (default, article is only on the blog)
    //   'queued'   — publish clicked, waiting for n8n to poll and post
    //   'posted'   — successfully posted, postUrn stored for backref
    //   'failed'   — n8n reported failure with error message
    // The old boolean flag has been migrated to `status === 'posted'` reads.
    socialPosted: {
      linkedin: {
        status: {
          type: String,
          enum: ['pending', 'queued', 'posted', 'failed'],
          default: 'pending',
        },
        queuedAt: Date,
        postedAt: Date,
        postUrn: String,      // URN LinkedIn du post (renvoyé par leur API)
        commentUrn: String,   // URN du firstComment
        error: String,        // message si status='failed'
        // Texte du post, écrit à la main dans le tableau de bord. Il n'est
        // plus dérivé de l'article : c'était la cause de la sérialité des
        // posts (cf. services/linkedinPost.js). Sans texte, pas d'enfilement.
        text: String,
        firstComment: String, // commentaire posté juste après, par n8n
      },
      x: {
        status: {
          type: String,
          enum: ['pending', 'queued', 'posted', 'failed'],
          default: 'pending',
        },
        queuedAt: Date,
        postedAt: Date,
        postUrn: String,
        error: String,
      },
    },
    // Anciens slugs conservés pour rediriger en 301 vers le slug courant.
    // Sans ça, corriger la slugification casse tous les liens déjà partagés
    // sur LinkedIn et déjà indexés par Google.
    oldSlugs: {
      type: [String],
      default: [],
      index: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Translittère un titre en slug lisible.
// Le `normalize('NFD')` décompose les caractères accentués en (lettre + accent),
// puis on retire les accents — sans ça « déployer » devenait « d-ployer » et
// chaque mot-clé français était détruit dans l'URL.
function slugify(title) {
  return String(title)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Auto-generate slug from title if not provided
articleSchema.pre('save', async function () {
  if (!this.isModified('title') && this.slug) return;

  const previousSlug = this.slug;
  let slug = slugify(this.title);

  // Ensure unique slug
  const existing = await mongoose.model('Article').findOne({ slug, _id: { $ne: this._id } });
  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  // Le slug change sur un article déjà publié → on garde l'ancien pour le 301
  if (previousSlug && previousSlug !== slug && !this.oldSlugs.includes(previousSlug)) {
    this.oldSlugs.push(previousSlug);
  }

  this.slug = slug;
});

// Exposé pour les tests et le script de migration
articleSchema.statics.slugify = slugify;

module.exports = mongoose.model('Article', articleSchema);
