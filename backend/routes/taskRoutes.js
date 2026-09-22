const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const taskController = require('../controllers/taskController');

// Saari routes protected hain — verifyToken middleware lagega
// Matlab: har request mein JWT token hona zaroori hai

// POST   /api/tasks       → Naya task banao
router.post('/', verifyToken, taskController.createTask);

// GET    /api/tasks       → Apne saare tasks dekho
router.get('/', verifyToken, taskController.getAllTasks);

// GET    /api/tasks/:id   → Ek specific task dekho
router.get('/:id', verifyToken, taskController.getTaskById);

// PUT    /api/tasks/:id   → Task update karo
router.put('/:id', verifyToken, taskController.updateTask);

// DELETE /api/tasks/:id   → Task delete karo
router.delete('/:id', verifyToken, taskController.deleteTask);

module.exports = router;
