const db = require('../db/db');

// ─── CREATE TASK ──────────────────────────────────────────────────────────────
// POST /api/tasks
// Naya task banao (sirf logged-in user ke liye)
exports.createTask = (req, res) => {
    const { title, description, priority, due_date } = req.body;
    const userId = req.user.id; // JWT middleware ne set kiya tha

    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    // Priority validation (low, medium, high)
    const validPriorities = ['low', 'medium', 'high'];
    const taskPriority = validPriorities.includes(priority) ? priority : 'medium';
    const taskDueDate = due_date ? due_date : null;

    const query = 'INSERT INTO tasks (user_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?)';

    db.query(query, [userId, title, description || null, taskPriority, taskDueDate], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
        }

        res.status(201).json({
            message: 'Task created successfully!',
            task: {
                id: result.insertId,
                user_id: userId,
                title,
                description: description || null,
                completed: false,
                priority: taskPriority,
                due_date: taskDueDate
            }
        });
    });
};

// ─── GET ALL TASKS (of logged-in user) ────────────────────────────────────────
// GET /api/tasks?sort=priority|due_date|newest
// Logged-in user ke saare tasks dikhao with dynamic sorting
exports.getAllTasks = (req, res) => {
    const userId = req.user.id;
    const sort = req.query.sort;

    let orderByClause = 'ORDER BY created_at DESC';
    if (sort === 'priority') {
        // High priority first, then medium, then low
        orderByClause = "ORDER BY FIELD(priority, 'high', 'medium', 'low'), created_at DESC";
    } else if (sort === 'due_date') {
        // Earliest due date first, tasks without due dates at the end
        orderByClause = 'ORDER BY (due_date IS NULL), due_date ASC, created_at DESC';
    }

    const query = `SELECT * FROM tasks WHERE user_id = ? ${orderByClause}`;

    db.query(query, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
        }

        res.status(200).json({
            message: `Found ${results.length} task(s)`,
            tasks: results
        });
    });
};

// ─── GET SINGLE TASK ──────────────────────────────────────────────────────────
// GET /api/tasks/:id
// Ek specific task dikhao (sirf apna)
exports.getTaskById = (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.id;

    const query = 'SELECT * FROM tasks WHERE id = ? AND user_id = ?';

    db.query(query, [taskId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.status(200).json({ task: results[0] });
    });
};

// ─── UPDATE TASK ──────────────────────────────────────────────────────────────
// PUT /api/tasks/:id
// Task ka title, description, completed, priority, ya due_date update karo
exports.updateTask = (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.id;
    const { title, description, completed, priority, due_date } = req.body;

    // Pehle check karo ki task exist karta hai aur is user ka hai
    const findQuery = 'SELECT * FROM tasks WHERE id = ? AND user_id = ?';

    db.query(findQuery, [taskId, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const existingTask = results[0];

        // Jo value user ne nahi bheji, woh purani value use karo
        const updatedTitle = title !== undefined ? title : existingTask.title;
        const updatedDescription = description !== undefined ? description : existingTask.description;
        const updatedCompleted = completed !== undefined ? completed : existingTask.completed;
        const updatedPriority = priority !== undefined ? priority : existingTask.priority;
        const updatedDueDate = due_date !== undefined ? (due_date || null) : existingTask.due_date;

        const updateQuery = 'UPDATE tasks SET title = ?, description = ?, completed = ?, priority = ?, due_date = ? WHERE id = ? AND user_id = ?';

        db.query(updateQuery, [updatedTitle, updatedDescription, updatedCompleted, updatedPriority, updatedDueDate, taskId, userId], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error', details: err.message });
            }

            res.status(200).json({
                message: 'Task updated successfully!',
                task: {
                    id: parseInt(taskId),
                    user_id: userId,
                    title: updatedTitle,
                    description: updatedDescription,
                    completed: updatedCompleted,
                    priority: updatedPriority,
                    due_date: updatedDueDate
                }
            });
        });
    });
};

// ─── DELETE TASK ──────────────────────────────────────────────────────────────
// DELETE /api/tasks/:id
// Task delete karo (sirf apna)
exports.deleteTask = (req, res) => {
    const taskId = req.params.id;
    const userId = req.user.id;

    const query = 'DELETE FROM tasks WHERE id = ? AND user_id = ?';

    db.query(query, [taskId, userId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error', details: err.message });
        }

        // affectedRows = 0 matlab koi task mila hi nahi
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.status(200).json({ message: 'Task deleted successfully!' });
    });
};
