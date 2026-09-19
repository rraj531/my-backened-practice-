const mysql = require('mysql2');
require('dotenv').config();

// Create connection to MySQL (without specifying database yet)
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error('MySQL connection failed: ', err.message);
        return;
    }
    console.log('Connected to MySQL successfully!');

    // 1. Create Database if it doesn't exist
    const createDbQuery = `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`;
    db.query(createDbQuery, (err) => {
        if (err) throw err;
        console.log(`Database '${process.env.DB_NAME}' is ready.`);

        // 2. Switch to the created database
        db.changeUser({ database: process.env.DB_NAME }, (err) => {
            if (err) throw err;

            // 3. Create 'users' table
            const createUsersTable = `
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;
            db.query(createUsersTable, (err) => {
                if (err) throw err;
                console.log('Table "users" is ready.');
            });

            // 4. Create 'tasks' table
            const createTasksTable = `
                CREATE TABLE IF NOT EXISTS tasks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    completed BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `;
            db.query(createTasksTable, (err) => {
                if (err) throw err;
                console.log('Table "tasks" is ready.');
            });
        });
    });
});

module.exports = db;
