const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
    },
    messages: [messageSchema],
    summary: {
      type: String,
      trim: true,
    },
    // Tags extraits automatiquement (thèmes, techno, projets mentionnés)
    tags: {
      type: [String],
      default: [],
    },
    // Type de conversation
    type: {
      type: String,
      enum: ['general', 'article-idea', 'code-review', 'feedback', 'other'],
      default: 'general',
    },
    // Utilisé par AIAgent comme contexte
    contextNotes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Statut
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index pour recherche rapide des conversations récentes par user
conversationSchema.index({ user: 1, createdAt: -1 });
// Index pour recherche par tags
conversationSchema.index({ user: 1, tags: 1 });

// Méthode pour obtenir les N derniers messages (optimisé pour le contexte)
conversationSchema.methods.getLastMessages = function (limit = 20) {
  return this.messages.slice(-limit);
};

// Méthode pour ajouter un message
conversationSchema.methods.addMessage = function (role, content) {
  this.messages.push({ role, content });
  return this;
};

// Méthode pour mettre à jour le résumé
conversationSchema.methods.updateSummary = function (summary) {
  this.summary = summary;
  return this;
};

// Méthode pour extraire le contexte utile pour AIAgent
conversationSchema.methods.extractAiContext = function () {
  const context = {
    summary: this.summary,
    tags: this.tags,
    type: this.type,
    notes: this.contextNotes,
  };

  // Ajouter les dernières discussions pertinentes
  const recentMessages = this.getLastMessages(10);
  const userMessages = recentMessages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .slice(-5); // 5 derniers messages utilisateur

  if (userMessages.length > 0) {
    context.recentDiscussions = userMessages;
  }

  return context;
};

module.exports = mongoose.model('Conversation', conversationSchema);
