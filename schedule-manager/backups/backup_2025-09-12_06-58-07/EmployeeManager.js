// Employee Manager Module
// Handles all employee-related operations and management

class EmployeeManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
    }

    // Render users management view
    renderUsersView() {
        const usersContent = document.getElementById('usersContent');
        if (!usersContent) return;

        let html = '<div class="data-list">';

        if (this.workforceManager.employees.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No Employees</h3>
                    <p>Import employee data or add new employees manually.</p>
                </div>
            `;
        } else {
            html += '<h4>Imported Employees</h4>';
            this.workforceManager.employees.forEach(employee => {
                const role = this.workforceManager.jobRoles.find(r => r.id === employee.roleId);
                const roleName = role ? role.name : 'No Role';
                const shiftType = employee.shiftType || this.determineEmployeeShiftType(employee);
                const shiftBadgeClass = shiftType === 'Night' ? 'night-shift-badge' : 'day-shift-badge';
                const roleBadgeClass = this.getRoleBadgeClass(roleName);
                const priority = employee.priority || '';
                const priorityBadge = priority ? `<span class="priority-badge priority-${priority.toLowerCase()}">${priority}</span>` : '';

                html += `
                    <div class="data-item">
                        <div class="data-info">
                            <strong>${employee.name}</strong>
                            <div class="badge-container">
                                <span class="role-badge ${roleBadgeClass}">${roleName}</span>
                                <span class="shift-type-badge ${shiftBadgeClass}">${shiftType}</span>
                                ${priorityBadge}
                            </div>
                        </div>
                        <div class="data-actions">
                            <div class="priority-quick-set">
                                <button class="priority-btn priority-a ${priority === 'A' ? 'active' : ''}" onclick="workforceManager.employeeManager.setPriority('${employee.id}', 'A')" title="Set Priority A">A</button>
                                <button class="priority-btn priority-b ${priority === 'B' ? 'active' : ''}" onclick="workforceManager.employeeManager.setPriority('${employee.id}', 'B')" title="Set Priority B">B</button>
                                <button class="priority-btn priority-c ${priority === 'C' ? 'active' : ''}" onclick="workforceManager.employeeManager.setPriority('${employee.id}', 'C')" title="Set Priority C">C</button>
                                <button class="priority-btn priority-none ${!priority ? 'active' : ''}" onclick="workforceManager.employeeManager.setPriority('${employee.id}', '')" title="Remove Priority">×</button>
                            </div>
                            <button class="btn btn-sm btn-secondary" onclick="workforceManager?.modalManager?.editEmployee('${employee.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="workforceManager.employeeManager.deleteEmployee('${employee.id}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        usersContent.innerHTML = html;
    }

    // Set employee priority
    setPriority(employeeId, priority) {
        const employee = this.workforceManager.employees.find(e => e.id === employeeId);
        if (!employee) return;

        employee.priority = priority || '';
        
        // Save changes
        this.workforceManager.saveData('employees', this.workforceManager.employees);

        // Refresh views
        this.renderUsersView();
        this.workforceManager.calendarRenderer.renderScheduleMatrix();
    }

    // Delete employee
    deleteEmployee(employeeId) {
        const employee = this.workforceManager.employees.find(e => e.id === employeeId);
        if (!employee) return;

        if (confirm(`Are you sure you want to delete ${employee.name}?`)) {
            // Remove employee
            this.workforceManager.employees = this.workforceManager.employees.filter(e => e.id !== employeeId);
            // Remove associated schedules
            this.workforceManager.schedules = this.workforceManager.schedules.filter(s => s.employeeId !== employeeId);

            // Save changes
            this.workforceManager.saveData('employees', this.workforceManager.employees);
            this.workforceManager.saveData('schedules', this.workforceManager.schedules);

            // Refresh views
            this.renderUsersView();
            this.workforceManager.calendarRenderer.renderScheduleMatrix();
        }
    }

    // Helper function to get CSS class for role badges
    getRoleBadgeClass(roleName) {
        // Find the role by name to get its custom color
        const role = this.workforceManager.jobRoles.find(r => r.name === roleName);
        if (role && role.color) {
            // Return a dynamic class name based on the color
            return `custom-role-badge-${role.color.replace('#', '')}`;
        }

        // Fallback to default colors for legacy roles or when no color is set
        const defaultClasses = {
            'Manager': 'manager-badge',
            'Senior Cashier': 'senior-cashier-badge',
            'Cashier': 'cashier-badge',
            'Stock Clerk': 'stock-clerk-badge',
            'Sales Associate': 'sales-associate-badge',
            'No Role': 'no-role-badge'
        };

        return defaultClasses[roleName] || 'default-role-badge';
    }

    // Helper function to determine employee's shift type based on their schedules
    determineEmployeeShiftType(employee) {
        // Get all schedules for this employee
        const employeeSchedules = this.workforceManager.schedules.filter(s => s.employeeId === employee.id);

        // Check if any schedules contain night shifts
        for (const schedule of employeeSchedules) {
            const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
            if (shiftType && this.isNightShift(shiftType.name)) {
                return 'Night';
            }
        }

        // If no night shifts found, classify as Day
        return 'Day';
    }

    // Get available shifts for an employee (based on their role and shift history)
    getAvailableShiftsForEmployee(employee) {
        // Simplified and optimized version for better performance
        // Just return the most common shifts without complex role-based filtering
        
        // Get shifts the employee has actually worked (most relevant)
        const employeeSchedules = this.workforceManager.schedules.filter(s => s.employeeId === employee.id);
        const employeeShiftIds = new Set(employeeSchedules.map(s => s.shiftId).filter(id => id));
        const employeeShifts = this.workforceManager.shiftTypes.filter(shift => employeeShiftIds.has(shift.id));
        
        // If employee has worked shifts, return those plus a few common ones
        if (employeeShifts.length > 0) {
            const commonShifts = this.workforceManager.shiftTypes.filter(shift => {
                const name = shift.name.toUpperCase();
                return name.includes('OFF') || name.includes('VAC') || name.includes('SICK') || 
                       name.includes('6T') || name.includes('18T') || name.includes('6W') || name.includes('18W');
            });
            
            // Combine and deduplicate
            const allShifts = [...employeeShifts, ...commonShifts];
            const uniqueShifts = allShifts.filter((shift, index, self) => 
                index === self.findIndex(s => s.id === shift.id)
            );
            
            return uniqueShifts.slice(0, 8);
        }
        
        // Fallback: return first 8 shift types
        return this.workforceManager.shiftTypes.slice(0, 8);
    }

    // Helper function to check if a shift name represents a night shift
    isNightShift(shiftName) {
        if (!shiftName) return false;

        const nightPatterns = [
            /^ANM N/i,  // Matches "ANM N" (case insensitive)
            /^18/,      // Matches "18*" (starts with 18)
            /^Night/i   // Matches "Night*" (case insensitive)
        ];

        return nightPatterns.some(pattern => pattern.test(shiftName));
    }

    // Helper function to check if a shift represents a day shift
    isDayShift(shiftType) {
        if (!shiftType) return false;

        const dayPatterns = [
            /^DAY$/i,   // Matches "DAY" (case insensitive)
            /^Day$/i,   // Matches "Day" (case insensitive)
            /DAY/i,     // Contains "DAY"
            /Day/i      // Contains "Day"
        ];

        return dayPatterns.some(pattern => pattern.test(shiftType));
    }

    // Update employee shift types based on their current schedules
    updateAllEmployeeShiftTypes() {
        this.workforceManager.employees.forEach(employee => {
            const shiftType = this.determineEmployeeShiftType(employee);
            employee.shiftType = shiftType;
        });
        this.workforceManager.saveData('employees', this.workforceManager.employees);
    }

    /**
     * Assign a shift to an employee for a specific date
     * @param {string} employeeId - The ID of the employee
     * @param {string} date - The date in YYYY-MM-DD format
     * @param {string|null} shiftId - The ID of the shift to assign, or null to remove assignment
     */
    assignShiftToEmployee(employeeId, date, shiftId) {
        console.log(`Assigning shift ${shiftId} to employee ${employeeId} for date ${date}`);

        // Find existing schedule entry
        const existingSchedule = this.workforceManager.schedules.find(s =>
            s.employeeId === employeeId && s.date === date
        );

        if (shiftId) {
            // Update or create schedule entry
            if (existingSchedule) {
                existingSchedule.shiftId = shiftId;
            } else {
                this.workforceManager.schedules.push({
                    id: this.workforceManager.generateId(),
                    employeeId,
                    shiftId,
                    date
                });
            }
        } else {
            // Remove schedule entry if shiftId is null/empty (set to "off")
            if (existingSchedule) {
                this.workforceManager.schedules = this.workforceManager.schedules.filter(s =>
                    !(s.employeeId === employeeId && s.date === date)
                );
            }
        }

        // Update employee shift type based on their schedules
        const employee = this.workforceManager.employees.find(e => e.id === employeeId);
        if (employee) {
            employee.shiftType = this.determineEmployeeShiftType(employee);
        }

        // Save changes
        this.workforceManager.saveData('schedules', this.workforceManager.schedules);
        this.workforceManager.saveData('employees', this.workforceManager.employees);

        // Refresh the UI
        this.workforceManager.calendarRenderer.renderScheduleMatrix();
        this.workforceManager.calendarRenderer.renderWorkerCountSummary();
    }


    // Add custom shift
    addCustomShift() {
        if (!this.workforceManager.uiManager || !this.workforceManager.uiManager.currentShiftContext) {
            console.error('No current shift context available');
            return;
        }

        const customShiftInput = document.getElementById('customShiftInput');
        if (!customShiftInput) return;

        const customShiftName = customShiftInput.value.trim();
        if (!customShiftName) {
            alert('Please enter a shift name.');
            return;
        }

        // Check if this shift type already exists
        let shiftType = this.workforceManager.shiftTypes.find(s => s.name.toLowerCase() === customShiftName.toLowerCase());

        // If it doesn't exist, create it
        if (!shiftType) {
            shiftType = {
                id: this.workforceManager.generateId(),
                name: customShiftName,
                description: `Custom shift: ${customShiftName}`,
                color: ScheduleUtils.getDefaultShiftColor(customShiftName)
            };

            this.workforceManager.shiftTypes.push(shiftType);
            this.workforceManager.saveData('shiftTypes', this.workforceManager.shiftTypes);
            console.log(`✅ Created new custom shift type: ${customShiftName}`);
        }

        // Apply the shift change
        const { employeeId, date } = this.workforceManager.uiManager.currentShiftContext;
        this.assignShiftToEmployee(employeeId, date, shiftType.id);

        // Clear the input and hide context menu
        customShiftInput.value = '';
        if (this.workforceManager.uiManager.hideContextMenu) {
            this.workforceManager.uiManager.hideContextMenu();
        }
    }
}

// Export the class
window.EmployeeManager = EmployeeManager;

// Make EmployeeManager available globally
console.log('EmployeeManager module loaded');
