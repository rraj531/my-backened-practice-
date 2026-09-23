// ─── STATE MANAGEMENT ────────────────────────────────────────────────────────
const state = {
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    tasks: [],
    filter: 'all',
    search: '',
    editingTaskId: null
};

// ─── TOAST NOTIFICATIONS ──────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ─── API HELPER ───────────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    const headers = options.headers || {};
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    if (options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(endpoint, { ...options, headers });
        const data = await response.json().catch(() => ({}));

        if (response.status === 401 || response.status === 403) {
            // Token expired or invalid
            logout();
            throw new Error('Session expired. Please log in again.');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Something went wrong');
        }

        return data;
    } catch (err) {
        throw err;
    }
}

// ─── VIEW CONTROLLER ──────────────────────────────────────────────────────
function updateUI() {
    const authWrapper = document.getElementById('auth-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const userNav = document.getElementById('user-nav');
    const userNameSpan = document.getElementById('user-display-name');
    const userAvatar = document.getElementById('user-avatar');

    if (state.token && state.user) {
        authWrapper.style.display = 'none';
        dashboardSection.style.display = 'block';
        userNav.style.display = 'flex';
        userNameSpan.textContent = state.user.name || 'User';
        userAvatar.textContent = (state.user.name || 'U').charAt(0).toUpperCase();
        loadTasks();
    } else {
        authWrapper.style.display = 'block';
        dashboardSection.style.display = 'none';
        userNav.style.display = 'none';
    }
}

// ─── AUTH LOGIC ───────────────────────────────────────────────────────────
function switchAuthTab(tab) {
    const loginTab = document.getElementById('tab-login');
    const registerTab = document.getElementById('tab-register');
    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');

    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.style.display = 'block';
        loginForm.style.display = 'none';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
        const data = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: { email, password }
        });

        state.token = data.token;
        state.user = data.user || { name: email.split('@')[0], email };

        localStorage.setItem('token', state.token);
        localStorage.setItem('user', JSON.stringify(state.user));

        showToast('Login successful!');
        updateUI();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Login';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    const btn = document.getElementById('btn-register');
    btn.disabled = true;
    btn.textContent = 'Registering...';

    try {
        await apiFetch('/api/auth/register', {
            method: 'POST',
            body: { name, email, password }
        });

        showToast('Registration successful! Please login.');
        // Switch to login tab and prefill email
        switchAuthTab('login');
        document.getElementById('login-email').value = email;
        document.getElementById('login-password').focus();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
}

function logout() {
    state.token = null;
    state.user = null;
    state.tasks = [];
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateUI();
    showToast('Logged out successfully');
}

// ─── TASK CRUD LOGIC ──────────────────────────────────────────────────────
async function loadTasks() {
    try {
        const data = await apiFetch('/api/tasks');
        state.tasks = data.tasks || [];
        renderTasks();
        renderStats();
    } catch (err) {
        showToast('Failed to load tasks: ' + err.message, 'error');
    }
}

async function handleCreateTask(e) {
    e.preventDefault();
    const titleInput = document.getElementById('task-title-input');
    const descInput = document.getElementById('task-desc-input');

    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    if (!title) {
        showToast('Please enter a task title', 'error');
        return;
    }

    try {
        const data = await apiFetch('/api/tasks', {
            method: 'POST',
            body: { title, description }
        });

        titleInput.value = '';
        descInput.value = '';

        showToast('Task added successfully!');
        // Prepend task to array or reload
        if (data.task) {
            state.tasks.unshift(data.task);
            renderTasks();
            renderStats();
        } else {
            loadTasks();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleTaskComplete(taskId, currentStatus) {
    const newStatus = !currentStatus;
    try {
        await apiFetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            body: { completed: newStatus }
        });

        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = newStatus;
            renderTasks();
            renderStats();
        }
        showToast(newStatus ? 'Task marked complete! ✅' : 'Task marked pending');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
        await apiFetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });

        state.tasks = state.tasks.filter(t => t.id !== taskId);
        renderTasks();
        renderStats();
        showToast('Task deleted successfully!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── EDIT MODAL LOGIC ─────────────────────────────────────────────────────
function openEditModal(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    state.editingTaskId = taskId;
    document.getElementById('edit-title-input').value = task.title;
    document.getElementById('edit-desc-input').value = task.description || '';
    document.getElementById('edit-modal').classList.add('active');
}

function closeEditModal() {
    state.editingTaskId = null;
    document.getElementById('edit-modal').classList.remove('active');
}

async function handleUpdateTask(e) {
    e.preventDefault();
    if (!state.editingTaskId) return;

    const title = document.getElementById('edit-title-input').value.trim();
    const description = document.getElementById('edit-desc-input').value.trim();

    if (!title) {
        showToast('Title cannot be empty', 'error');
        return;
    }

    try {
        await apiFetch(`/api/tasks/${state.editingTaskId}`, {
            method: 'PUT',
            body: { title, description }
        });

        const task = state.tasks.find(t => t.id === state.editingTaskId);
        if (task) {
            task.title = title;
            task.description = description;
            renderTasks();
        }

        closeEditModal();
        showToast('Task updated successfully!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── RENDERING & FILTERS ──────────────────────────────────────────────────
function renderStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => Boolean(t.completed)).length;
    const pending = total - completed;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-completed').textContent = completed;
}

function renderTasks() {
    const list = document.getElementById('tasks-container');
    list.innerHTML = '';

    // Filter tasks
    let filtered = state.tasks.filter(task => {
        const isCompleted = Boolean(task.completed);
        if (state.filter === 'pending') return !isCompleted;
        if (state.filter === 'completed') return isCompleted;
        return true;
    });

    // Search filter
    if (state.search.trim()) {
        const q = state.search.toLowerCase();
        filtered = filtered.filter(task => 
            (task.title && task.title.toLowerCase().includes(q)) ||
            (task.description && task.description.toLowerCase().includes(q))
        );
    }

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <h3>No tasks found</h3>
                <p>${state.search ? 'Try a different search term.' : 'Add your first task above to get started!'}</p>
            </div>
        `;
        return;
    }

    filtered.forEach(task => {
        const isCompleted = Boolean(task.completed);
        const item = document.createElement('div');
        item.className = `task-item ${isCompleted ? 'completed' : ''}`;

        const createdDate = task.created_at ? new Date(task.created_at).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric'
        }) : '';

        item.innerHTML = `
            <div class="task-checkbox-wrapper">
                <input type="checkbox" class="task-checkbox" ${isCompleted ? 'checked' : ''} 
                       title="Mark complete / incomplete" onchange="toggleTaskComplete(${task.id}, ${isCompleted})">
            </div>
            <div class="task-body">
                <h4 class="task-title">${escapeHtml(task.title)}</h4>
                ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
                <div class="task-meta">
                    <span class="badge ${isCompleted ? 'badge-completed' : 'badge-pending'}">
                        ${isCompleted ? 'Completed' : 'Pending'}
                    </span>
                    ${createdDate ? `<span>📅 ${createdDate}</span>` : ''}
                </div>
            </div>
            <div class="task-actions">
                <button class="btn btn-sm btn-outline" onclick="openEditModal(${task.id})" title="Edit Task">✏️ Edit</button>
                <button class="btn btn-sm btn-danger-outline" onclick="deleteTask(${task.id})" title="Delete Task">🗑️</button>
            </div>
        `;

        list.appendChild(item);
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// ─── INITIALIZATION ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Check existing login session
    if (state.token) {
        try {
            const profile = await apiFetch('/api/profile');
            state.user = profile.loggedInUser;
            localStorage.setItem('user', JSON.stringify(state.user));
        } catch (e) {
            // Invalid token
            state.token = null;
            state.user = null;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }

    updateUI();

    // Event listeners
    document.getElementById('tab-login').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tab-register').addEventListener('click', () => switchAuthTab('register'));

    document.getElementById('form-login').addEventListener('submit', handleLogin);
    document.getElementById('form-register').addEventListener('submit', handleRegister);
    document.getElementById('btn-logout').addEventListener('click', logout);

    document.getElementById('form-create-task').addEventListener('submit', handleCreateTask);
    document.getElementById('form-edit-task').addEventListener('submit', handleUpdateTask);
    document.getElementById('btn-close-modal').addEventListener('click', closeEditModal);

    // Filter pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            state.filter = pill.getAttribute('data-filter');
            renderTasks();
        });
    });

    // Search input
    document.getElementById('search-input').addEventListener('input', (e) => {
        state.search = e.target.value;
        renderTasks();
    });
});
