// Wrap async route handlers — catches errors and forwards to errorHandler.
// Returns the wrapped Promise so tests (and any caller that cares) can
// await actual completion of the handler. Express itself ignores the
// returned value, so this is harmless in production.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
