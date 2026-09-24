const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST request to register a new user (Direct fallback)
router.post('/register', authController.register);

// POST request to send dual OTP (Email + Mobile SMS)
router.post('/send-dual-otp', authController.sendDualOtp);

// POST request to verify dual OTP and complete registration
router.post('/verify-dual-otp-register', authController.verifyAndRegisterDualOtp);

// POST request to send 6-digit email OTP (single)
router.post('/send-otp', authController.sendOtp);

// POST request to verify OTP and complete registration (single)
router.post('/verify-register', authController.verifyAndRegister);

// POST request to login
// Full URL will be: POST /api/auth/login
router.post('/login', authController.login);

module.exports = router;
