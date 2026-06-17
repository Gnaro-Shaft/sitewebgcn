const mongoose = require('mongoose');
const crypto = require('crypto');

// Refresh tokens are stored as their SHA-256 hash. We never persist the raw
// token — if the DB is exposed, the attacker can't impersonate sessions.
// This is the same pattern Auth0/Clerk use internally.
const refreshTokenSchema = new mongoose.Schema(
  {
    // sha256 of the raw token, hex-encoded
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Hard expiry — TTL index drops it automatically after this date
    expiresAt: {
      type: Date,
      required: true,
      // expireAfterSeconds: 0 means "drop when expiresAt < now"
      index: { expireAfterSeconds: 0 },
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    // When this refresh token was used to mint a new one (rotation).
    // Helps detect replay: if a revoked-via-rotation token is reused, it
    // means it was stolen — we can wipe all that user's sessions.
    replacedBy: {
      type: String, // hash of the new token that replaced this one
      default: null,
    },
    createdByIp: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);

// Generate a strong random token. 32 bytes = 256 bits of entropy, plenty.
refreshTokenSchema.statics.generateRaw = function () {
  return crypto.randomBytes(32).toString('hex');
};

refreshTokenSchema.statics.hash = function (raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
};

// Find an active (not revoked, not expired) refresh token by raw value.
refreshTokenSchema.statics.findActiveByRaw = async function (raw) {
  if (!raw) return null;
  const tokenHash = this.hash(raw);
  const doc = await this.findOne({ tokenHash, revoked: false });
  if (!doc) return null;
  if (doc.expiresAt < new Date()) return null;
  return doc;
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
