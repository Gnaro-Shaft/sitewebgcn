const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // Never return password by default
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    widgetsConfig: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Profil utilisateur pour personnalisation
    profile: {
      bio: {
        type: String,
        maxlength: 1000,
      },
      writingStyle: {
        type: {
          tone: {
            type: String,
            enum: ['pedagogique', 'technique', 'personnel', 'professionnel'],
            default: 'pedagogique',
          },
          perspective: {
            type: String,
            enum: ['first-person', 'third-person'],
            default: 'first-person',
          },
          audience: {
            type: String,
            enum: ['developers', 'managers', 'general', 'beginners', 'experts'],
            default: 'developers',
          },
          language: {
            type: String,
            default: 'fr',
          },
        },
        default: {},
      },
      preferences: {
        // Préférences pour la génération d'articles
        articleLength: {
          type: String,
          enum: ['short', 'medium', 'long'],
          default: 'medium',
        },
        includeCodeExamples: {
          type: Boolean,
          default: true,
        },
        autoGenerateTags: {
          type: Boolean,
          default: true,
        },
        // Thèmes d'intérêt pour suggestions
        interests: {
          type: [String],
          default: [],
        },
        // GitHub / tech stack pour contexte
        githubUsername: {
          type: String,
          default: '',
        },
        techStack: {
          type: [String],
          default: [],
        },
      },
      // Historique des préférences d'articles (pour apprentissage)
      articleHistory: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT
userSchema.methods.generateToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

module.exports = mongoose.model('User', userSchema);
