const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST request to register a new user
// Full URL will be: POST /api/auth/register
router.post('/register', authController.register);

// POST request to login
// Full URL will be: POST /api/auth/login
router.post('/login', authController.login);

module.exports = router;
