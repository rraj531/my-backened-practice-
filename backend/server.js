require('dotenv').config();
const express = require('express');
const db = require('./db/db'); // Initialize DB connection

// Initialize the Express app
const app = express();

// Middleware to parse JSON data from requests
app.use(express.json());

// Import and use routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// A basic route (GET request)
app.get('/', (req, res) => {
    res.send('Welcome to the Task Manager API!');
});

// Another route for testing
app.get('/api/test', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

// Database check route (for browser)
app.get('/api/db-check', (req, res) => {
    // Hum MySQL se pooch rahe hain ki uske paas kaunsi tables hain
    db.query('SHOW TABLES', (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database issue', details: err.message });
        }
        res.json({ 
            status: 'Success!',
            message: 'MySQL is perfectly connected!', 
            tables: results 
        });
    });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
