const express = require('express');
const router = express.Router();
const { register, login, refresh, logout, getMe } = require('../controllers/authController');
const { protect, loginAuth } = require('../middleware/auth');
const { validateLogin, validateRegister } = require('../middleware/validate');

router.post('/register', validateRegister, register);
router.post('/login', loginAuth, validateLogin, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);

module.exports = router;
