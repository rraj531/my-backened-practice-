const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const db = require('./db/db'); // Initialize DB connection

// Initialize the Express app
const app = express();

const cors = require('cors');
app.use(cors());

// Middleware to parse JSON data from requests
app.use(express.json());

// Import and use routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const taskRoutes = require('./routes/taskRoutes');
app.use('/api/tasks', taskRoutes);

// A basic route (GET request)
app.get('/', (req, res) => {
    res.send('Welcome to the Task Manager API!');
});

// Another route for testing
app.get('/api/test', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

// ─── Protected Route (JWT middleware ka test) ─────────────────────────────────
const verifyToken = require('./middleware/authMiddleware');

// Yeh route sirf wahi access kar sakta hai jiske paas valid JWT token hai
app.get('/api/profile', verifyToken, (req, res) => {
    // req.user middleware ne set kiya tha (decoded JWT data)
    res.json({
        message: 'You accessed a PROTECTED route!',
        loggedInUser: req.user
    });
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
