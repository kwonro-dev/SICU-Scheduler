// Utility functions for the Workforce Schedule Manager
// Extracted from script.js for better organization and maintainability

/**
 * Generate a unique identifier using timestamp and random string
 * @returns {string} Unique ID in base36 format
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Format a Date object to YYYY-MM-DD string format
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string (YYYY-MM-DD)
 */
function formatDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Update custom role badge styles dynamically
 * @param {Array} jobRoles - Array of job role objects
 */
function updateRoleBadgeStyles(jobRoles) {
    // Remove existing custom styles
    const existingStyle = document.getElementById('custom-role-styles');
    if (existingStyle) {
        existingStyle.remove();
    }

    // Create new styles for custom role colors
    let customStyles = '';

    jobRoles.forEach(role => {
        if (role.color) {
            const colorClass = `custom-role-badge-${role.color.replace('#', '')}`;
            const darkerColor = ScheduleUtils.getDarkerColor(role.color);

            customStyles += `
                .${colorClass} {
                    background: linear-gradient(135deg, ${role.color} 0%, ${darkerColor} 100%);
                    border: 1px solid ${darkerColor};
                    color: white !important;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
                }
            `;
        }
    });

    // Add base styles for all role badges to ensure text visibility
    const baseStyles = `
        .manager-badge, .senior-cashier-badge, .cashier-badge, .stock-clerk-badge, 
        .sales-associate-badge, .no-role-badge, .default-role-badge,
        [class*="custom-role-badge-"] {
            color: white !important;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            font-weight: 500;
        }
    `;

    const allStyles = baseStyles + customStyles;

    if (allStyles) {
        const styleElement = document.createElement('style');
        styleElement.id = 'custom-role-styles';
        styleElement.textContent = allStyles;
        document.head.appendChild(styleElement);
    }
}

/**
 * Show a centered alert dialog
 * @param {string} message - The message to display
 * @param {string} title - Optional title for the dialog
 * @returns {Promise} Promise that resolves when dialog is closed
 */
function showAlert(message, title = 'Alert') {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal active';
        overlay.style.cssText = 'z-index: 20000; display: flex; align-items: center; justify-content: center;';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '400px';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `
            <h3>${title}</h3>
        `;
        
        // Create body
        const body = document.createElement('div');
        body.className = 'modal-body';
        body.innerHTML = `<p style="margin: 0; line-height: 1.5;">${message}</p>`;
        
        // Create footer with OK button
        const footer = document.createElement('div');
        footer.style.cssText = 'padding: 1.5rem; border-top: 1px solid rgba(255,255,255,0.3); display: flex; justify-content: flex-end; background: rgba(248,250,252,0.8);';
        
        const okButton = document.createElement('button');
        okButton.className = 'btn btn-primary';
        okButton.textContent = 'OK';
        okButton.style.cssText = 'min-width: 80px;';
        
        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(body);
        modalContent.appendChild(footer);
        footer.appendChild(okButton);
        overlay.appendChild(modalContent);
        
        // Add to DOM
        document.body.appendChild(overlay);
        
        // Handle OK button click
        const closeDialog = () => {
            document.body.removeChild(overlay);
            resolve();
        };
        
        okButton.addEventListener('click', closeDialog);
        
        // Handle overlay click (close on outside click)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog();
            }
        });
        
        // Handle Escape key
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    });
}

/**
 * Show a centered confirm dialog
 * @param {string} message - The message to display
 * @param {string} title - Optional title for the dialog
 * @returns {Promise<boolean>} Promise that resolves to true if confirmed, false if cancelled
 */
function showConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal active';
        overlay.style.cssText = 'z-index: 20000; display: flex; align-items: center; justify-content: center;';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '400px';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `
            <h3>${title}</h3>
        `;
        
        // Create body
        const body = document.createElement('div');
        body.className = 'modal-body';
        body.innerHTML = `<p style="margin: 0; line-height: 1.5;">${message}</p>`;
        
        // Create footer with buttons
        const footer = document.createElement('div');
        footer.style.cssText = 'padding: 1.5rem; border-top: 1px solid rgba(255,255,255,0.3); display: flex; justify-content: flex-end; gap: 0.75rem; background: rgba(248,250,252,0.8);';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'btn';
        cancelButton.textContent = 'Cancel';
        cancelButton.style.cssText = 'min-width: 80px; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db;';
        
        const confirmButton = document.createElement('button');
        confirmButton.className = 'btn btn-primary';
        confirmButton.textContent = 'Confirm';
        confirmButton.style.cssText = 'min-width: 80px;';
        
        // Assemble modal
        modalContent.appendChild(header);
        modalContent.appendChild(body);
        modalContent.appendChild(footer);
        footer.appendChild(cancelButton);
        footer.appendChild(confirmButton);
        overlay.appendChild(modalContent);
        
        // Add to DOM
        document.body.appendChild(overlay);
        
        // Handle button clicks
        const closeDialog = (result) => {
            document.body.removeChild(overlay);
            resolve(result);
        };
        
        cancelButton.addEventListener('click', () => closeDialog(false));
        confirmButton.addEventListener('click', () => closeDialog(true));
        
        // Handle overlay click (close on outside click)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog(false);
            }
        });
        
        // Handle Escape key
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                closeDialog(false);
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
        
        // Focus the confirm button
        confirmButton.focus();
    });
}

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
    if (upper.includes('R12') || upper.includes('R 12')) {
        color = '#06b6d4';
    }

    // Subsequent rules can overwrite the color
    // contains "ANM" -> green
    if (upper.includes('ANM')) {
        color = '#10b981';
    }
    // contains "Charg" -> custom red
    if (upper.includes('CHARG')) {
        color = '#B53737';
    }
    // contains "C " -> lime green
    if (name.includes('C ')) {
        color = '#84cc16';
    }
    // contains "6t" or "6w" (but not "16w") -> orange
    if ((name.includes('6t') || name.includes('6w')) && !name.includes('16w')) {
        color = '#f59e0b';
    }
    // contains "18t" or "18w" -> regular blue
    if (name.includes('18t') || name.includes('18w')) {
        color = '#3b82f6';
    }
    // starts with "Mid" -> dark green
    if (upper.startsWith('MID')) {
        color = '#065f46';
    }
    // contains "Quali" -> gray
    if (upper.includes('QUALI')) {
        color = '#9ca3af';
    }
    // contains "7h" -> purple (evaluated last for highest priority)
    if (upper.includes('7H') || name.includes('7h')) {
        color = '#8b5cf6';
    }


    return color;
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
 * Get a darker shade of a color
 * @param {string} color - Hex color code (with or without #)
 * @returns {string} RGB color string
 */
function getDarkerColor(color) {
    // Simple darkening function - reduce RGB values by 20%
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 51);
    const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 51);
    const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 51);

    return `rgb(${r}, ${g}, ${b})`;
}

// Export functions for use in other modules
window.ScheduleUtils = {
    getDefaultShiftColor,
    getDefaultRoleColor,
    escapeHtml,
    getDarkerColor
};
