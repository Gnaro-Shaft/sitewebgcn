const express = require('express');
const router = express.Router();
const { sendContact } = require('../controllers/contactController');
const { validateContact } = require('../middleware/validate');

router.post('/', validateContact, sendContact);

module.exports = router;
