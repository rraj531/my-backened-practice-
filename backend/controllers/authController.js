const db = require('../db/db');
const bcrypt = require('bcrypt');

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
