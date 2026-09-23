const db = require('../db/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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
        // We use ? to prevent SQL injection attacks
        const query = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
        
        db.query(query, [name, email, hashedPassword], (err, result) => {
            if (err) {
                // If email is already registered, MySQL will throw 'ER_DUP_ENTRY'
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'This email is already registered' });
                }
                return res.status(500).json({ error: 'Database error', details: err.message });
            }

            // 4. Send a success response back
            res.status(201).json({ 
                message: 'User registered successfully!',
                userId: result.insertId 
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error', details: error.message });
    }
};

// ─── LOGIN ───────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
    // 1. Email aur password request body se lo
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password' });
    }

    // 2. Database mein check karo ki yeh email exist karti hai ya nahi
    const query = 'SELECT * FROM users WHERE email = ?';

    db.query(query, [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        // Agar koi user nahi mila
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = results[0]; // Pehla (aur ek hi) user

        // 3. Jo password user ne type kiya, use database ke hashed password se compare karo
        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // 4. Password sahi hai! Ab JWT Token banao
        // Payload: Token ke andar chhupa hua data (non-sensitive only)
        const payload = {
            id: user.id,
            name: user.name,
            email: user.email
        };

        // jwt.sign(payload, secret, options)
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        // 5. Token and user info frontend ko bhej do
        res.status(200).json({
            message: 'Login successful!',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });
    });
};
