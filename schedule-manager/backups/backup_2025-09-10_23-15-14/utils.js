// Utility functions for the Workforce Schedule Manager
// Extracted from script.js for better organization and maintainability

/**
 * Get default color for shift types based on shift name
 * @param {string} shiftName - The name of the shift type
 * @returns {string} Hex color code
 */
function getDefaultShiftColor(shiftName) {
    if (!shiftName || typeof shiftName !== 'string') {
        return '#fbcfe8'; // default light pink
    }

    // Special case: Off
    if (shiftName.trim().toLowerCase() === 'off') {
        return '#6b7280'; // gray for Off
    }

    const name = shiftName.trim();
    const upper = name.toUpperCase();

    // Start with default hot pink
    let color = '#ec4899';

    // contains "R12" or "R 12" -> aqua (baseline that can be overwritten)
    if (upper.includes('R12') || upper.includes('R 12')) color = '#06b6d4';

    // Subsequent rules can overwrite the color
    // contains "ANM" -> green
    if (upper.includes('ANM')) color = '#10b981';
    // contains "Charg" -> custom red
    if (upper.includes('CHARG')) color = '#B53737';
    // contains "C " -> lime green
    if (name.includes('C ')) color = '#84cc16';
    // contains "7h16w" -> purple
    if (upper.includes('7H16W')) color = '#8b5cf6';
    // contains "6" -> orange
    if (name.includes('6')) color = '#f59e0b';
    // contains "18" -> regular blue
    if (name.includes('18')) color = '#3b82f6';
    // starts with "Mid" -> dark green
    if (upper.startsWith('MID')) color = '#065f46';
    // contains "Quali" -> gray
    if (upper.includes('QUALI')) color = '#9ca3af';
    // contains "Prece" -> light brown
    if (upper.includes('PRECE')) color = '#a78b5a';

    return color;
}

/**
 * Get a random color for unknown shift types
 * @returns {string} Hex color code
 */
function getRandomShiftColor() {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Get default color for job roles based on role name prefix
 * @param {string} roleName - The name of the job role
 * @returns {string} Hex color code
 */
function getDefaultRoleColor(roleName) {
    if (!roleName || typeof roleName !== 'string') {
        return '#3b82f6';
    }
    const upper = roleName.trim().toUpperCase();
    // AMGR → green, MGR → purple, PCT → red, RN → blue, US → orange
    if (upper.startsWith('AMGR')) return '#10b981';
    if (upper.startsWith('MGR')) return '#8b5cf6';
    if (upper.startsWith('PCT')) return '#ef4444';
    if (upper.startsWith('RN')) return '#3b82f6';
    if (upper.startsWith('US')) return '#f59e0b';
    return '#3b82f6';
}

/**
 * Escape HTML characters for safe display
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get a random color from predefined palette
 * @returns {string} Hex color code
 */
function getRandomColor() {
    const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Get a darker shade of a color
 * @param {string} color - Hex color code (with or without #)
 * @returns {string} RGB color string
 */
function getDarkerColor(color) {
    // Simple darkening function - reduce RGB values by 20%
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 51);
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 51);
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 51);

    return `rgb(${r}, ${g}, ${b})`;
}

// Export functions for use in other modules
window.ScheduleUtils = {
    getDefaultShiftColor,
    getRandomShiftColor,
    getDefaultRoleColor,
    escapeHtml,
    getRandomColor,
    getDarkerColor
};
