const User = require('../models/User');
const asyncHandler = require('../middleware/asyncHandler');

// Default widget config
const DEFAULT_WIDGETS = [
  { id: 'crypto', label: 'Crypto Live', enabled: true },
  { id: 'github', label: 'GitHub Stats', enabled: true },
  { id: 'blog', label: 'Blog Stats', enabled: true },
  { id: 'trades', label: 'Trades', enabled: true },
  { id: 'performance', label: 'Algo Performance', enabled: true },
  { id: 'signals', label: 'Signals', enabled: true },
];

// GET /api/dashboard/widgets
exports.getWidgets = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const config = user.widgetsConfig?.get('widgets');

  res.json({
    success: true,
    data: config || DEFAULT_WIDGETS,
  });
});

// PATCH /api/dashboard/widgets
exports.updateWidgets = asyncHandler(async (req, res) => {
  const { widgets } = req.body;

  if (!Array.isArray(widgets)) {
    return res.status(400).json({ success: false, error: 'widgets must be an array' });
  }

  const user = await User.findById(req.user._id);
  user.widgetsConfig.set('widgets', widgets);
  await user.save();

  res.json({ success: true, data: widgets });
});
