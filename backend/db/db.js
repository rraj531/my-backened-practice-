const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2');

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
                    phone VARCHAR(20) NULL,
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
                    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
                    due_date DATE NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `;
            db.query(createTasksTable, (err) => {
                if (err) throw err;
                console.log('Table "tasks" is ready.');

                // Safe migration: Add priority column if it doesn't exist
                db.query(`ALTER TABLE tasks ADD COLUMN priority ENUM('low', 'medium', 'high') DEFAULT 'medium'`, (err) => {
                    if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                        console.error('Priority migration notice:', err.message);
                    }
                });

                // Safe migration: Add due_date column if it doesn't exist
                db.query(`ALTER TABLE tasks ADD COLUMN due_date DATE NULL`, (err) => {
                    if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                        console.error('Due date migration notice:', err.message);
                    }
                });

                // 5. Create 'email_otps' table
                const createEmailOtpsTable = `
                    CREATE TABLE IF NOT EXISTS email_otps (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        email VARCHAR(100) NOT NULL,
                        otp VARCHAR(6) NOT NULL,
                        expires_at DATETIME NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `;
                db.query(createEmailOtpsTable, (err) => {
                    if (err) throw err;
                    console.log('Table "email_otps" is ready.');
                });

                // Safe migration: Add phone column to users table if it doesn't exist
                db.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL`, (err) => {
                    if (err && err.errno !== 1060 && err.code !== 'ER_DUP_FIELDNAME') {
                        console.error('Phone column migration notice:', err.message);
                    }
                });

                // 6. Create 'registration_otps' table (Dual Email + Mobile OTP)
                const createRegistrationOtpsTable = `
                    CREATE TABLE IF NOT EXISTS registration_otps (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        email VARCHAR(100) NOT NULL,
                        phone VARCHAR(20) NOT NULL,
                        email_otp VARCHAR(6) NOT NULL,
                        mobile_otp VARCHAR(6) NOT NULL,
                        expires_at DATETIME NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `;
                db.query(createRegistrationOtpsTable, (err) => {
                    if (err) throw err;
                    console.log('Table "registration_otps" is ready.');
                });
            });
        });
    });
});

module.exports = db;
