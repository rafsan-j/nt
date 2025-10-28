// Application Logic Module
import * as Storage from './storage.js';
import * as TimerEngine from './timer-engine.js';

const MAX_TASKS_PER_GROUP = 100;

// --- UTILS ---

/**
 * Converts milliseconds to HH:MM:SS string (Feature 2).
 */
export const msToTime = (ms) => {
    const totalSeconds = Math.round(ms / 1000);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
};

/**
 * Converts HH:MM:SS string to milliseconds (Feature 2).
 */
export const timeToMs = (timeStr) => {
    const parts = timeStr.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return (h * 3600 + m * 60 + s) * 1000;
};

/**
 * Utility to switch between application screens (Feature 5).
 */
function setScreen(screenId) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('active-timer-screen').style.display = 'none';

    if (screenId === 'active-timer-screen') {
        document.getElementById('active-timer-screen').style.display = 'flex';
    } else {
        document.getElementById(screenId).style.display = 'block';
    }
}

// --- NOTIFICATIONS (Feature 3) ---

/**
 * Requests notification permission once during initialization.
 */
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        try {
            await Notification.requestPermission();
        } catch(e) {
            console.warn("Notification permission request failed or denied.", e);
        }
    }
}

/**
 * Sends a reliable system notification using the Web Notifications API.
 * This should work reliably in the background via the Service Worker (Feature 3).
 * @param {string} taskName - The name of the task.
 * @param {string} type - 'start' or 'end'.
 */
window.sendTaskNotification = (taskName, type) => {
    if (Notification.permission === 'granted') {
        const title = `RoutineFlow: ${TimerEngine.activeGroup.name}`;
        const body = `${type === 'start' ? 'Starting' : 'Completed'}: ${taskName}`;
        
        // Use a unique tag to replace old notifications if necessary
        const tag = 'routine-flow-timer';
        
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
                body: body,
                tag: tag, 
                renotify: true,
                vibrate: [200, 100, 200], // Custom vibration pattern (Feature 3)
                // Add sound property here if custom sound is allowed and implemented
            });
        });
    }
}

// --- SETTINGS (Feature 4) ---

function applySettings() {
    document.documentElement.setAttribute('data-theme', Storage.settings.theme);
    document.getElementById('theme-select').value = Storage.settings.theme;
    
    const displayEl = document.getElementById('countdown-display');
    displayEl.className = Storage.settings.timerStyle === 'digital' ? 'digital-style' : 'minimal-style';
    document.getElementById('timer-style-select').value = Storage.settings.timerStyle;
}

// --- UI RENDERING (Feature 5) ---

function renderGroupCards() {
    const container = document.getElementById('groups-container');
    container.innerHTML = '';

    if (Storage.groups.length === 0) {
        container.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">No routines yet. Create your first Group!</p>';
        return;
    }

    Storage.groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'card group-card';
        card.style.borderLeftColor = group.color || 'var(--color-primary)'; // Group color (Feature 4)
        card.innerHTML = `
            <div>
                <h3 style="color: ${group.color || 'var(--color-primary)'}">${group.name}</h3>
                <p>${group.tasks.length} tasks</p>
            </div>
            <div>
                <button class="btn-primary start-btn" data-group-id="${group.id}">Start</button>
                <button class="btn edit-btn" data-group-id="${group.id}">Edit</button>
                <button class="btn copy-btn" data-group-id="${group.id}">Copy</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function addTaskToBuilder(task = { name: '', duration: '00:05:00', notify: 'end', icon: '📝' }) {
    const container = document.getElementById('tasks-container');
    if (container.children.length >= MAX_TASKS_PER_GROUP) {
        alert(`You can have a maximum of ${MAX_TASKS_PER_GROUP} tasks per group.`);
        return;
    }

    const index = container.children.length;
    const taskEl = document.createElement('div');
    taskEl.className = 'task-item';
    taskEl.innerHTML = `
        <span style="font-weight: bold;">${index + 1}.</span>
        <input type="text" placeholder="Icon (e.g. 🏃)" value="${task.icon}" data-task-field="icon" style="width: 50px;">
        <input type="text" placeholder="Task Name" value="${task.name}" data-task-field="name">
        <input type="text" placeholder="HH:MM:SS" value="${task.duration}" data-task-field="duration">
        <select data-task-field="notify">
            <option value="none" ${task.notify === 'none' ? 'selected' : ''}>None</option>
            <option value="start" ${task.notify === 'start' ? 'selected' : ''}>Start</option>
            <option value="end" ${task.notify === 'end' ? 'selected' : ''}>End</option>
            <option value="both" ${task.notify === 'both' ? 'selected' : ''}>Both</option>
        </select>
        <button class="btn-danger" style="padding: 5px 10px;" onclick="this.parentElement.remove()">X</button>
    `;
    container.appendChild(taskEl);
}

function showGroupBuilder(groupId = null) {
    const tasksContainer = document.getElementById('tasks-container');
    tasksContainer.innerHTML = '';
    document.getElementById('group-id').value = '';
    document.getElementById('group-name').value = '';
    document.getElementById('group-color').value = '#007bff';
    document.getElementById('delete-group-btn').style.display = 'none';

    let groupToEdit = { name: '', color: '#007bff', tasks: [{ name: 'New Task 1', duration: '00:05:00', notify: 'end', icon: '📝' }] };

    if (groupId) {
        groupToEdit = Storage.groups.find(g => g.id === groupId);
        document.getElementById('group-id').value = groupId;
        document.getElementById('group-name').value = groupToEdit.name;
        document.getElementById('group-color').value = groupToEdit.color || '#007bff';
        document.getElementById('delete-group-btn').style.display = 'inline-block';
    }

    groupToEdit.tasks.forEach(task => addTaskToBuilder(task));

    setScreen('group-builder');
}

function showDashboard() {
    renderGroupCards();
    setScreen('home-dashboard');
}

// --- TIMER DISPLAY UPDATES ---

/**
 * Updates the non-time parts of the active timer screen.
 */
export function updateTimerDisplay(currentTask, groupName, taskNumber) {
    document.getElementById('timer-group-name').textContent = groupName;
    document.getElementById('current-task-name').innerHTML = `${currentTask.icon} ${taskNumber}. ${currentTask.name}`;
    document.getElementById('task-details').textContent = `Duration: ${currentTask.duration} | Notify: ${currentTask.notify}`;
    
    const nextTask = TimerEngine.activeGroup.tasks[TimerEngine.currentTaskIndex + 1];
    document.getElementById('next-task-info').textContent = nextTask ? `Next: ${nextTask.icon} ${nextTask.name}` : 'Next: Routine Complete';
    
    document.getElementById('pause-resume-btn').textContent = TimerEngine.isPaused ? 'Resume' : 'Pause';

    setScreen('active-timer-screen');
}

/**
 * Updates the live countdown and progress bar.
 */
window.updateTimerTime = (remainingMs, durationMs) => {
    document.getElementById('countdown-display').textContent = msToTime(remainingMs);
    
    const progress = (1 - (remainingMs / durationMs)) * 100;
    document.getElementById('timer-progress-bar').style.width = `${progress}%`;
}

/**
 * Handles UI after routine completes or stops.
 */
export function handleRoutineComplete(finished) {
    showDashboard();
    
    const title = finished ? 'Routine Completed!' : 'Routine Stopped';
    const body = finished ? 'All tasks finished. Great job!' : 'The routine was manually stopped.';
    
    // Use a non-intrusive notification instead of alert()
    if (Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
                body: body,
                tag: 'routine-flow-status',
            });
        });
    } else {
         // Fallback alert for status if notifications are blocked
         alert(title);
    }
}


// --- EVENT HANDLERS ---

function saveGroupHandler() {
    const groupId = document.getElementById('group-id').value;
    const groupName = document.getElementById('group-name').value.trim();
    const groupColor = document.getElementById('group-color').value;
    const taskElements = document.getElementById('tasks-container').children;

    if (!groupName) { alert('Group name is required.'); return; }

    const newTasks = [];
    for (const el of taskElements) {
        const name = el.querySelector('[data-task-field="name"]').value.trim();
        const duration = el.querySelector('[data-task-field="duration"]').value.trim();
        const notify = el.querySelector('[data-task-field="notify"]').value;
        const icon = el.querySelector('[data-task-field="icon"]').value;

        if (!name || !duration) { continue; }
        if (timeToMs(duration) <= 0) { alert('Task duration must be greater than 0.'); return; }

        newTasks.push({ name, duration, notify, icon });
    }

    if (newTasks.length === 0) { alert('A group must have at least one task.'); return; }
    
    let group = { name: groupName, color: groupColor, tasks: newTasks };

    if (groupId) {
        // Update existing group
        const index = Storage.groups.findIndex(g => g.id === groupId);
        if (index !== -1) {
            Storage.groups[index] = { ...Storage.groups[index], ...group };
        }
    } else {
        // Create new group
        if (Storage.groups.length >= 50) { alert(`Max of 50 groups reached.`); return; }
        group.id = 'group-' + Date.now();
        Storage.groups.push(group);
    }

    Storage.saveData();
    showDashboard();
}

function handleGroupAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    const groupId = btn.dataset.groupId;

    if (btn.classList.contains('start-btn')) {
        TimerEngine.startTimer(groupId);
    } else if (btn.classList.contains('edit-btn')) {
        showGroupBuilder(groupId);
    } else if (btn.classList.contains('copy-btn')) {
        // Duplication logic
        const original = Storage.getGroupById(groupId);
        if (!original || Storage.groups.length >= 50) return;

        const newGroup = JSON.parse(JSON.stringify(original));
        newGroup.id = 'group-' + Date.now();
        newGroup.name = `Copy of ${original.name}`;
        Storage.groups.push(newGroup);
        Storage.saveData();
        renderGroupCards();
    }
}

// --- INITIALIZATION ---

function initApp() {
    Storage.loadData();
    applySettings();
    requestNotificationPermission();

    // Recover Timer State (Feature 6 & 7)
    const savedState = Storage.loadTimerState();
    if (savedState && TimerEngine.recoverTimer(savedState)) {
        console.log("Recovered timer state.");
    } else if (Storage.groups.length === 0) {
        // Add default group if none exist
        Storage.groups.push({
            id: 'group-default',
            name: 'Quick Demo Routine',
            color: '#17a2b8',
            tasks: [
                { name: 'Warm-up', duration: '00:03:00', notify: 'end', icon: '🏃' },
                { name: 'Work Set', duration: '00:15:00', notify: 'start', icon: '🏋️' },
                { name: 'Cool-down', duration: '00:05:00', notify: 'end', icon: '🧘' }
            ]
        });
        Storage.saveData();
    }
    
    showDashboard();

    // Event Listeners
    document.getElementById('groups-container').addEventListener('click', handleGroupAction);
    document.getElementById('create-group-btn').addEventListener('click', () => showGroupBuilder(null));
    document.getElementById('add-task-btn').addEventListener('click', () => addTaskToBuilder());
    document.getElementById('save-group-btn').addEventListener('click', saveGroupHandler);
    document.getElementById('cancel-builder-btn').addEventListener('click', showDashboard);
    document.getElementById('delete-group-btn').addEventListener('click', () => {
        if(confirm('Are you sure you want to delete this group?')) {
            Storage.groups = Storage.groups.filter(g => g.id !== document.getElementById('group-id').value);
            Storage.saveData();
            showDashboard();
        }
    });

    // Timer Control Listeners
    document.getElementById('pause-resume-btn').addEventListener('click', (e) => {
        const isPaused = TimerEngine.togglePause();
        e.target.textContent = isPaused ? 'Resume' : 'Pause';
    });
    document.getElementById('skip-task-btn').addEventListener('click', TimerEngine.skipTask);
    document.getElementById('stop-timer-btn').addEventListener('click', () => {
        if (confirm('Stop the current routine?')) {
            TimerEngine.stopTimer();
        }
    });

    // Settings Listeners
    document.getElementById('theme-select').addEventListener('change', (e) => {
        Storage.settings.theme = e.target.value;
        applySettings();
        Storage.saveData();
    });
    document.getElementById('timer-style-select').addEventListener('change', (e) => {
        Storage.settings.timerStyle = e.target.value;
        applySettings();
        Storage.saveData();
    });
}

// Start the app when the DOM is ready
document.addEventListener('DOMContentLoaded', initApp);