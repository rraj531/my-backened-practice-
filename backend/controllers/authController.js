const db = require('../db/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../utils/emailService');
const { sendMobileOtp } = require('../utils/smsService');

// ─── SEND DUAL OTP (EMAIL + MOBILE SMS) ───────────────────────────────────────
// POST /api/auth/send-dual-otp
exports.sendDualOtp = async (req, res) => {
    const { email, phone } = req.body;

    if (!email || !phone) {
        return res.status(400).json({ error: 'Please provide both Email and Mobile Number' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);

    if (cleanPhone.length !== 10) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
    }

    // 1. Check if email or phone already registered
    const checkQuery = 'SELECT id FROM users WHERE email = ? OR phone = ?';
    db.query(checkQuery, [cleanEmail, cleanPhone], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error', details: err.message });

        if (results.length > 0) {
            return res.status(400).json({ error: 'This email or mobile number is already registered. Please log in.' });
        }

        // 2. Generate two distinct 6-digit OTPs
        const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const mobileOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // 3. Clear existing OTPs for this email / phone
        db.query('DELETE FROM registration_otps WHERE LOWER(email) = ? OR phone = ?', [cleanEmail, cleanPhone], (delErr) => {
            if (delErr) return res.status(500).json({ error: 'Database error', details: delErr.message });

            const insertQuery = `
                INSERT INTO registration_otps (email, phone, email_otp, mobile_otp, expires_at)
                VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
            `;

            db.query(insertQuery, [cleanEmail, cleanPhone, emailOtp, mobileOtp], async (insErr) => {
                if (insErr) return res.status(500).json({ error: 'Database error', details: insErr.message });

                console.log(`\n==============================================`);
                console.log(`🔑 DUAL REGISTRATION OTPs FOR: ${cleanEmail}`);
                console.log(`✉️ Email OTP:  ${emailOtp}`);
                console.log(`📱 Mobile OTP: ${mobileOtp} (Sent to +91 ${cleanPhone})`);
                console.log(`==============================================\n`);

                // 4. Send Real Email via Nodemailer
                await sendOtpEmail(cleanEmail, emailOtp);

                // 5. Send Mobile SMS via Supabase / SMS Service
                await sendMobileOtp(cleanPhone, mobileOtp);

                res.status(200).json({
                    message: `OTPs sent! Check your Gmail (${cleanEmail}) and Mobile (+91 ${cleanPhone})`,
                    devMobileOtp: mobileOtp
                });
            });
        });
    });
};

// ─── VERIFY DUAL OTP & COMPLETE REGISTRATION ──────────────────────────────────
// POST /api/auth/verify-dual-otp-register
exports.verifyAndRegisterDualOtp = async (req, res) => {
    const { name, email, phone, password, emailOtp, mobileOtp } = req.body;

    if (!name || !email || !phone || !password || !emailOtp || !mobileOtp) {
        return res.status(400).json({ error: 'Please provide Name, Email, Mobile, Password, Email OTP, and Mobile OTP' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const cleanEmailOtp = emailOtp.toString().trim();
    const cleanMobileOtp = mobileOtp.toString().trim();

    // 1. Check record in registration_otps
    const query = `
        SELECT * FROM registration_otps 
        WHERE LOWER(email) = ? AND phone = ? AND expires_at >= NOW() 
        ORDER BY id DESC LIMIT 1
    `;

    db.query(query, [cleanEmail, cleanPhone], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error', details: err.message });

        if (results.length === 0) {
            return res.status(400).json({ error: 'OTP request expired or not found. Please click "Resend OTP".' });
        }

        const record = results[0];

        // 2. Validate Email OTP
        if (record.email_otp !== cleanEmailOtp) {
            return res.status(400).json({ error: 'Incorrect Email OTP! Please check the code sent to your Gmail.' });
        }

        // 3. Validate Mobile OTP
        if (record.mobile_otp !== cleanMobileOtp) {
            return res.status(400).json({ error: 'Incorrect Mobile OTP! Please check the SMS code sent to your phone.' });
        }

        try {
            // 4. Hash Password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 5. Create user in database with phone
            const insertUserQuery = 'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)';
            db.query(insertUserQuery, [name, cleanEmail, cleanPhone, hashedPassword], (userErr, userResult) => {
                if (userErr) {
                    if (userErr.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ error: 'This email or phone is already registered.' });
                    }
                    return res.status(500).json({ error: 'Database error', details: userErr.message });
                }

                // 6. Delete used OTPs
                db.query('DELETE FROM registration_otps WHERE LOWER(email) = ? OR phone = ?', [cleanEmail, cleanPhone]);

                res.status(201).json({
                    message: 'Both OTPs verified! Account created successfully! Please log in.',
                    userId: userResult.insertId
                });
            });
        } catch (error) {
            res.status(500).json({ error: 'Server error', details: error.message });
        }
    });
};

// ─── SEND REGISTRATION OTP ───────────────────────────────────────────────────
// POST /api/auth/send-otp
exports.sendOtp = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Please provide an email address' });
    }

    // 1. Check if email already registered
    const checkQuery = 'SELECT id FROM users WHERE email = ?';
    db.query(checkQuery, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error', details: err.message });

        if (results.length > 0) {
            return res.status(400).json({ error: 'This email is already registered. Please log in.' });
        }

        // 2. Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // 10 minutes expiry
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // 3. Clear existing OTPs for this email and save new one
        const cleanEmail = email.trim().toLowerCase();
        db.query('DELETE FROM email_otps WHERE LOWER(email) = ?', [cleanEmail], (delErr) => {
            if (delErr) return res.status(500).json({ error: 'Database error', details: delErr.message });

            // Using MySQL's DATE_ADD(NOW(), INTERVAL 10 MINUTE) ensures zero timezone discrepancy
            const insertQuery = 'INSERT INTO email_otps (email, otp, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))';
            db.query(insertQuery, [cleanEmail, otp], async (insErr) => {
                if (insErr) return res.status(500).json({ error: 'Database error', details: insErr.message });

                console.log(`\n========================================`);
                console.log(`🔑 REGISTRATION OTP for ${cleanEmail}: ${otp}`);
                console.log(`========================================\n`);

                // 4. Send Real Email via Nodemailer
                const emailResult = await sendOtpEmail(cleanEmail, otp);

                res.status(200).json({
                    message: emailResult.success 
                        ? `OTP successfully sent to ${cleanEmail}!` 
                        : `OTP generated: ${otp}`,
                    emailDelivery: emailResult.success ? 'SENT' : 'LOGGED_TO_CONSOLE'
                });
            });
        });
    });
};

// ─── VERIFY OTP & REGISTER ────────────────────────────────────────────────────
// POST /api/auth/verify-register
exports.verifyAndRegister = async (req, res) => {
    const { name, email, password, otp } = req.body;

    if (!name || !email || !password || !otp) {
        return res.status(400).json({ error: 'Please provide name, email, password, and OTP' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    // 1. Verify OTP in database using MySQL's NOW() check
    const otpQuery = 'SELECT * FROM email_otps WHERE LOWER(email) = ? AND otp = ? AND expires_at >= NOW() ORDER BY id DESC LIMIT 1';

    db.query(otpQuery, [cleanEmail, cleanOtp], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error', details: err.message });

        if (results.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP. Please check the code and try again.' });
        }

        try {
            // 2. Hash Password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 3. Create User
            const insertUserQuery = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
            db.query(insertUserQuery, [name, email, hashedPassword], (userErr, userResult) => {
                if (userErr) {
                    if (userErr.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ error: 'This email is already registered.' });
                    }
                    return res.status(500).json({ error: 'Database error', details: userErr.message });
                }

                // 4. Delete used OTP
                db.query('DELETE FROM email_otps WHERE email = ?', [email]);

                res.status(201).json({
                    message: 'Account verified and created successfully! You can now log in.',
                    userId: userResult.insertId
                });
            });
        } catch (error) {
            res.status(500).json({ error: 'Server error', details: error.message });
        }
    });
};

exports.register = async (req, res) => {
    // 1. Get data from the frontend (request body)
    const { name, email, password } = req.body;

    // Check if user provided all fields
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Please provide name, email, and password' });
    }

    try {
        // 2. Hash (Encrypt) the password using bcrypt
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Save the user in the MySQL database
        const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
        
        db.query(query, [name, email, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'This email is already registered' });
                }
                return res.status(500).json({ error: 'Database error', details: err.message });
            }

            res.status(201).json({ 
                message: 'User registered successfully!',
                userId: result.insertId 
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error', details: error.message });
    }
};

// ─── LOGIN (Email or Mobile Number) ──────────────────────────────────────────
exports.login = async (req, res) => {
    // 1. Email/Mobile aur password request body se lo
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email or mobile number and password' });
    }

    const cleanInput = email.trim();
    const cleanPhone = cleanInput.replace(/\D/g, '').slice(-10);

    // 2. Allow login via either registered Email or Mobile Number
    const query = 'SELECT * FROM users WHERE LOWER(email) = ? OR (phone = ? AND phone IS NOT NULL AND phone != "") LIMIT 1';

    db.query(query, [cleanInput.toLowerCase(), cleanPhone], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error', details: err.message });

        // Agar koi user nahi mila
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email/mobile number or password' });
        }

        const user = results[0];

        // 3. Jo password user ne type kiya, use database ke hashed password se compare karo
        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.status(401).json({ error: 'Invalid email/mobile number or password' });
        }

        // 4. Password sahi hai! JWT Token banao
        const payload = {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        // 5. Token and user info frontend ko bhej do
        res.status(200).json({
            message: 'Login successful!',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });
    });
};
