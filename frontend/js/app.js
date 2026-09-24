// ─── STATE MANAGEMENT ────────────────────────────────────────────────────────
const state = {
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    tasks: [],
    filter: 'all',
    sort: 'newest',
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
            const hadSession = Boolean(state.token);
            logout(false); // Silent cleanup without redundant logout toast
            if (hadSession) {
                showToast('Session expired. Please log in again.', 'error');
            }
            throw new Error('AUTH_EXPIRED');
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

    resetRegisterSteps();

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

function resetRegisterSteps() {
    const s1 = document.getElementById('register-step-1');
    const s2 = document.getElementById('register-step-2');
    const emailOtpInput = document.getElementById('register-email-otp');
    const mobileOtpInput = document.getElementById('register-mobile-otp');
    const devNotice = document.getElementById('otp-dev-notice');
    if (s1) s1.style.display = 'block';
    if (s2) s2.style.display = 'none';
    if (emailOtpInput) emailOtpInput.value = '';
    if (mobileOtpInput) mobileOtpInput.value = '';
    if (devNotice) devNotice.style.display = 'none';
}

async function handleSendOtp() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const password = document.getElementById('register-password').value;

    if (!name || !email || !phone || !password) {
        showToast('Please fill in Name, Email, Mobile Number, and Password', 'error');
        return;
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
        showToast('Please enter a valid 10-digit mobile number', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    const btn = document.getElementById('btn-send-otp');
    btn.disabled = true;
    btn.textContent = 'Sending OTPs...';

    try {
        const cleanEmail = email.toLowerCase();
        const data = await apiFetch('/api/auth/send-dual-otp', {
            method: 'POST',
            body: { email: cleanEmail, phone: cleanPhone }
        });

        document.getElementById('otp-sent-email').textContent = cleanEmail;
        document.getElementById('otp-sent-phone').textContent = cleanPhone;
        document.getElementById('register-step-1').style.display = 'none';
        document.getElementById('register-step-2').style.display = 'block';

        const devNotice = document.getElementById('otp-dev-notice');
        const devVal = document.getElementById('dev-mobile-otp-value');
        if (data.devMobileOtp && devNotice && devVal) {
            devVal.textContent = data.devMobileOtp;
            devNotice.style.display = 'block';
        } else if (devNotice) {
            devNotice.style.display = 'none';
        }

        document.getElementById('register-email-otp').focus();

        showToast(data.message || 'OTPs sent to your Gmail and Mobile!');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Verification OTPs 📲';
    }
}

async function handleVerifyAndRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const phone = document.getElementById('register-phone').value.trim();
    const password = document.getElementById('register-password').value;
    const emailOtp = document.getElementById('register-email-otp').value.trim();
    const mobileOtp = document.getElementById('register-mobile-otp').value.trim();

    if (!emailOtp || emailOtp.length < 6) {
        showToast('Please enter the 6-digit Email OTP from Gmail', 'error');
        return;
    }

    if (!mobileOtp || mobileOtp.length < 6) {
        showToast('Please enter the 6-digit Mobile SMS OTP', 'error');
        return;
    }

    const btn = document.getElementById('btn-verify-otp');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
        const cleanEmail = email.toLowerCase();
        const cleanPhone = phone.replace(/\D/g, '').slice(-10);
        await apiFetch('/api/auth/verify-dual-otp-register', {
            method: 'POST',
            body: { 
                name, 
                email: cleanEmail, 
                phone: cleanPhone, 
                password, 
                emailOtp: emailOtp.trim(), 
                mobileOtp: mobileOtp.trim() 
            }
        });

        showToast('Account created successfully! Please login.');
        resetRegisterSteps();
        switchAuthTab('login');
        document.getElementById('login-email').value = cleanEmail;
        document.getElementById('login-password').focus();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Verify Both OTPs & Register ✅';
    }
}

function logout(notify = true) {
    state.token = null;
    state.user = null;
    state.tasks = [];
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateUI();
    if (notify) {
        showToast('Logged out successfully');
    }
}

// ─── TASK CRUD LOGIC ──────────────────────────────────────────────────────
async function loadTasks() {
    try {
        const data = await apiFetch(`/api/tasks?sort=${state.sort}`);
        state.tasks = data.tasks || [];
        renderTasks();
        renderStats();
    } catch (err) {
        if (err.message !== 'AUTH_EXPIRED') {
            showToast('Failed to load tasks: ' + err.message, 'error');
        }
    }
}

async function handleCreateTask(e) {
    e.preventDefault();
    const titleInput = document.getElementById('task-title-input');
    const descInput = document.getElementById('task-desc-input');
    const priorityInput = document.getElementById('task-priority-input');
    const dueDateInput = document.getElementById('task-due-date-input');

    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const priority = priorityInput ? priorityInput.value : 'medium';
    const due_date = dueDateInput ? dueDateInput.value : null;

    if (!title) {
        showToast('Please enter a task title', 'error');
        return;
    }

    try {
        await apiFetch('/api/tasks', {
            method: 'POST',
            body: { title, description, priority, due_date: due_date || null }
        });

        titleInput.value = '';
        descInput.value = '';
        if (dueDateInput) dueDateInput.value = '';
        if (priorityInput) priorityInput.value = 'medium';

        showToast('Task added successfully!');
        loadTasks();
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
    
    const editPriority = document.getElementById('edit-priority-input');
    if (editPriority) {
        editPriority.value = task.priority || 'medium';
    }

    const editDueDate = document.getElementById('edit-due-date-input');
    if (editDueDate) {
        if (task.due_date) {
            // Convert to YYYY-MM-DD
            editDueDate.value = task.due_date.split('T')[0];
        } else {
            editDueDate.value = '';
        }
    }

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
    const priority = document.getElementById('edit-priority-input').value;
    const dueDate = document.getElementById('edit-due-date-input').value;

    if (!title) {
        showToast('Title cannot be empty', 'error');
        return;
    }

    try {
        await apiFetch(`/api/tasks/${state.editingTaskId}`, {
            method: 'PUT',
            body: { 
                title, 
                description, 
                priority, 
                due_date: dueDate || null 
            }
        });

        closeEditModal();
        showToast('Task updated successfully!');
        loadTasks();
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

    // Filter tasks by status
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

    const todayStr = new Date().toISOString().split('T')[0];

    filtered.forEach(task => {
        const isCompleted = Boolean(task.completed);
        const item = document.createElement('div');
        item.className = `task-item ${isCompleted ? 'completed' : ''}`;

        // Priority Badge
        const priority = task.priority || 'medium';
        let priorityBadge = '';
        if (priority === 'high') {
            priorityBadge = `<span class="badge badge-priority-high">🔴 High</span>`;
        } else if (priority === 'low') {
            priorityBadge = `<span class="badge badge-priority-low">🟢 Low</span>`;
        } else {
            priorityBadge = `<span class="badge badge-priority-medium">🟡 Med</span>`;
        }

        // Due Date Badge
        let dueDateBadge = '';
        if (task.due_date) {
            const dateStr = task.due_date.split('T')[0];
            const dateObj = new Date(task.due_date);
            const formatted = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

            if (!isCompleted) {
                if (dateStr < todayStr) {
                    dueDateBadge = `<span class="badge badge-overdue">⚠️ Overdue (${formatted})</span>`;
                } else if (dateStr === todayStr) {
                    dueDateBadge = `<span class="badge badge-due-today">⏰ Due Today</span>`;
                } else {
                    dueDateBadge = `<span class="badge badge-due-upcoming">📅 Due ${formatted}</span>`;
                }
            } else {
                dueDateBadge = `<span class="badge badge-due-upcoming">📅 ${formatted}</span>`;
            }
        }

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
                    ${priorityBadge}
                    ${dueDateBadge}
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
            // Direct fetch (not apiFetch) to avoid auto-logout loop on invalid token
            const res = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${state.token}` }
            });

            if (res.ok) {
                const profile = await res.json();
                state.user = profile.loggedInUser;
                localStorage.setItem('user', JSON.stringify(state.user));
            } else {
                // Token invalid/expired — silently clear session
                state.token = null;
                state.user = null;
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        } catch (e) {
            // Network error — use cached user data if available
            // Don't clear session on network failure
        }
    }

    updateUI();

    // Event listeners
    document.getElementById('tab-login').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('tab-register').addEventListener('click', () => switchAuthTab('register'));

    document.getElementById('form-login').addEventListener('submit', handleLogin);
    document.getElementById('btn-send-otp').addEventListener('click', handleSendOtp);
    document.getElementById('link-resend-otp').addEventListener('click', handleSendOtp);
    document.getElementById('link-back-step1').addEventListener('click', resetRegisterSteps);
    document.getElementById('form-register').addEventListener('submit', handleVerifyAndRegister);
    const autoFillBtn = document.getElementById('btn-autofill-mobile-otp');
    if (autoFillBtn) {
        autoFillBtn.addEventListener('click', () => {
            const devVal = document.getElementById('dev-mobile-otp-value').textContent;
            if (devVal) {
                document.getElementById('register-mobile-otp').value = devVal.trim();
                showToast('Test Mobile OTP auto-filled!');
            }
        });
    }
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

    // Sort select
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            state.sort = e.target.value;
            loadTasks();
        });
    }

    // Search input
    document.getElementById('search-input').addEventListener('input', (e) => {
        state.search = e.target.value;
        renderTasks();
    });
});
