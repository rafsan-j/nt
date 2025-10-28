// Data Persistence Module

// Constants (Feature 1 limits)
const STORAGE_KEY = 'routineFlowGroups';
const SETTINGS_KEY = 'routineFlowSettings';
const TIMER_STATE_KEY = 'routineFlowTimerState';

// Global variables (populated by loadData)
export let groups = [];
export let settings = { theme: 'light', timerStyle: 'digital' };

/**
 * Loads all data from localStorage.
 */
export function loadData() {
    try {
        groups = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        settings = { ...settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    } catch (e) {
        console.error("Error loading data from localStorage:", e);
        groups = [];
    }
}

/**
 * Saves all current data to localStorage.
 */
export function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Saves the current timer state for recovery (Feature 6 & 7).
 * @param {object} state - The current timer state (group, index, remaining time).
 */
export function saveTimerState(state) {
    localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
}

/**
 * Loads the last saved timer state.
 * @returns {object|null} The timer state or null if none exists.
 */
export function loadTimerState() {
    try {
        const state = localStorage.getItem(TIMER_STATE_KEY);
        return state ? JSON.parse(state) : null;
    } catch (e) {
        console.error("Error loading timer state:", e);
        return null;
    }
}

/**
 * Clears the saved timer state.
 */
export function clearTimerState() {
    localStorage.removeItem(TIMER_STATE_KEY);
}

/**
 * Finds a group by its ID.
 * @param {string} groupId - The ID of the group.
 * @returns {object|undefined} The group object.
 */
export function getGroupById(groupId) {
    return groups.find(g => g.id === groupId);
}
