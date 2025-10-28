// Timer Engine Module
import { getGroupById, saveTimerState, clearTimerState } from './storage.js';
import { msToTime, timeToMs, updateTimerDisplay, handleRoutineComplete } from './app.js';

// Timer State
export let activeGroup = null;
export let currentTaskIndex = 0;
export let timerInterval = null;
export let isPaused = false;
export let startTime = 0;
export let taskDurationMs = 0;
export let remainingTimeMs = 0;

// Feature 7: Placeholder for Wake Lock
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock acquired!');
        } catch (err) {
            console.error('Wake Lock request failed:', err);
        }
    }
}

function releaseWakeLock() {
    if (wakeLock) {
        wakeLock.release().then(() => {
            wakeLock = null;
            console.log('Wake Lock released.');
        });
    }
}

/**
 * Initiates the timer routine.
 * @param {string} groupId - The ID of the group to start.
 */
export function startTimer(groupId) {
    activeGroup = getGroupById(groupId);
    currentTaskIndex = 0;
    isPaused = false;
    
    if (!activeGroup || activeGroup.tasks.length === 0) {
        console.error("Cannot start an empty group.");
        return;
    }

    requestWakeLock();
    processTask();
}

/**
 * Moves to and processes the current task.
 */
export function processTask() {
    if (!activeGroup || currentTaskIndex >= activeGroup.tasks.length) {
        stopTimer(true); // Routine finished
        return;
    }

    const currentTask = activeGroup.tasks[currentTaskIndex];
    taskDurationMs = timeToMs(currentTask.duration);
    remainingTimeMs = taskDurationMs; // Start fresh
    startTime = Date.now();
    isPaused = false;

    // Trigger Notification on Start (handled in app.js)
    updateTimerDisplay(currentTask, activeGroup.name, currentTaskIndex + 1);
    
    if (currentTask.notify === 'start' || currentTask.notify === 'both') {
        window.sendTaskNotification(currentTask.name, 'start');
    }

    // Start the tick
    clearInterval(timerInterval);
    timerInterval = setInterval(timerTick, 100);
}

/**
 * Core timer loop - Feature 2 (Timestamp-based accuracy).
 */
function timerTick() {
    if (isPaused || !activeGroup) return;

    // Timestamp-based calculation
    const elapsed = Date.now() - startTime;
    remainingTimeMs = Math.max(0, taskDurationMs - elapsed);

    // Update UI (app.js handles display formatting)
    window.updateTimerTime(remainingTimeMs, taskDurationMs);
    
    // Feature 6: Save state frequently for robust recovery
    saveTimerState({
        groupId: activeGroup.id,
        taskIndex: currentTaskIndex,
        paused: false,
        remaining: remainingTimeMs,
        taskDuration: taskDurationMs,
        lastTick: Date.now()
    });
    
    if (remainingTimeMs === 0) {
        clearInterval(timerInterval);
        const currentTask = activeGroup.tasks[currentTaskIndex];

        // Trigger Notification on End
        if (currentTask.notify === 'end' || currentTask.notify === 'both') {
            window.sendTaskNotification(currentTask.name, 'end');
        }
        
        // Auto-starts next task (Feature 6)
        currentTaskIndex++;
        processTask();
    }
}

/**
 * Pauses or Resumes the timer.
 */
export function togglePause() {
    isPaused = !isPaused;
    
    if (!isPaused) {
        // Correct start time for drift/pause duration
        startTime = Date.now() - (taskDurationMs - remainingTimeMs);
        clearInterval(timerInterval);
        timerInterval = setInterval(timerTick, 100);
    } else {
        clearInterval(timerInterval);
    }
    
    // Save state on pause/resume
    saveTimerState({
        groupId: activeGroup.id,
        taskIndex: currentTaskIndex,
        paused: isPaused,
        remaining: remainingTimeMs,
        taskDuration: taskDurationMs,
        lastTick: Date.now()
    });

    return isPaused;
}

/**
 * Skips the current task.
 */
export function skipTask() {
    if (!activeGroup) return;
    clearInterval(timerInterval);
    currentTaskIndex++;
    processTask();
}

/**
 * Stops the routine.
 * @param {boolean} finished - True if the routine completed naturally.
 */
export function stopTimer(finished = false) {
    clearInterval(timerInterval);
    releaseWakeLock();
    clearTimerState();
    
    const wasActive = activeGroup !== null;
    activeGroup = null;
    currentTaskIndex = 0;
    isPaused = false;
    
    if (wasActive) {
        handleRoutineComplete(finished);
    }
}

/**
 * Recovers the timer state after a refresh (Feature 6 & 7).
 * @param {object} state - The loaded state from storage.
 */
export function recoverTimer(state) {
    activeGroup = getGroupById(state.groupId);
    if (!activeGroup) {
        clearTimerState(); // Invalid state
        return false;
    }
    
    const currentTask = activeGroup.tasks[state.taskIndex];
    if (!currentTask) {
        clearTimerState();
        return false;
    }

    currentTaskIndex = state.taskIndex;
    taskDurationMs = state.taskDuration;
    remainingTimeMs = state.remaining;
    isPaused = state.paused;

    requestWakeLock();
    updateTimerDisplay(currentTask, activeGroup.name, currentTaskIndex + 1);
    window.updateTimerTime(remainingTimeMs, taskDurationMs);
    
    if (!isPaused) {
        // Calculate remaining time correction based on time elapsed since lastTick
        const timeSinceLastTick = Date.now() - state.lastTick;
        remainingTimeMs = Math.max(0, remainingTimeMs - timeSinceLastTick);
        
        startTime = Date.now() - (taskDurationMs - remainingTimeMs);
        timerInterval = setInterval(timerTick, 100);
    }

    return true; // Recovery successful
}