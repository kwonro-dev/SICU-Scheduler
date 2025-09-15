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
        // Get employee's existing schedules
        const employeeSchedules = this.workforceManager.schedules.filter(s => s.employeeId === employee.id);

        // Get unique shift types this employee has worked
        const employeeShiftIds = new Set(employeeSchedules.map(s => s.shiftId).filter(id => id));
        const employeeShifts = this.workforceManager.shiftTypes.filter(shift => employeeShiftIds.has(shift.id));

        // Get employee's role and day/night preference
        const role = this.workforceManager.jobRoles.find(r => r.id === employee.roleId);
        const employeeShiftType = employee.shiftType || this.determineEmployeeShiftType(employee);

        // Collect suggested shifts based on multiple criteria
        const suggestedShifts = new Set();

        // 1. Add shifts the employee has actually worked (highest priority)
        employeeShifts.forEach(shift => suggestedShifts.add(shift));

        // 2. Add role-appropriate shifts
        if (role) {
            const roleName = role.name.toUpperCase();

            this.workforceManager.shiftTypes.forEach(shift => {
                const shiftName = shift.name.toUpperCase();

                // AMGR - ANM shifts
                if (roleName.includes('AMGR') && shiftName.includes('ANM')) {
                    suggestedShifts.add(shift);
                }
                // PCT - 6t and 18t shifts
                else if (roleName.includes('PCT') && (shiftName.includes('6T') || shiftName.includes('18T'))) {
                    suggestedShifts.add(shift);
                }
                // US - 6w and 18w shifts
                else if (roleName.includes('US') && (shiftName.includes('6W') || shiftName.includes('18W'))) {
                    suggestedShifts.add(shift);
                }
                // RN - various RN shifts
                else if (roleName.includes('RN') && (shiftName.includes('6T') || shiftName.includes('18T') || shiftName.includes('MID'))) {
                    suggestedShifts.add(shift);
                }
            });
        }

        // 3. Add shifts that match employee's day/night preference
        if (employeeShiftType) {
            const isDayEmployee = employeeShiftType === 'Day';
            const isNightEmployee = employeeShiftType === 'Night';

            this.workforceManager.shiftTypes.forEach(shift => {
                const shiftName = shift.name.toUpperCase();

                // For day employees, prefer day shifts
                if (isDayEmployee && this.isDayShift(shift.name)) {
                    suggestedShifts.add(shift);
                }
                // For night employees, prefer night shifts
                else if (isNightEmployee && this.isNightShift(shift.name)) {
                    suggestedShifts.add(shift);
                }
            });
        }

        // Convert Set to Array and sort by relevance
        let result = Array.from(suggestedShifts);

        // Sort by: 1) Employee's actual shifts first, 2) Then by shift name
        result.sort((a, b) => {
            const aWorked = employeeShiftIds.has(a.id);
            const bWorked = employeeShiftIds.has(b.id);

            if (aWorked && !bWorked) return -1;
            if (!aWorked && bWorked) return 1;

            return a.name.localeCompare(b.name);
        });

        // Limit to 15 most relevant shifts
        return result.slice(0, 15);
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

    // Delete the current shift (set to "off")
    deleteCurrentShift() {
        if (!this.workforceManager.uiManager || !this.workforceManager.uiManager.currentShiftContext) {
            console.error('No current shift context available');
            return;
        }

        const { employeeId, date, currentShiftId } = this.workforceManager.uiManager.currentShiftContext;

        if (!currentShiftId) {
            alert('No shift to delete - this employee is already off.');
            return;
        }

        if (confirm('Are you sure you want to delete this shift? The employee will be marked as "Off".')) {
            // Record the change for undo functionality
            this.workforceManager.recordShiftChange(employeeId, date, currentShiftId, null);

            // Remove the schedule entry
            this.workforceManager.schedules = this.workforceManager.schedules.filter(s =>
                !(s.employeeId === employeeId && s.date === date)
            );

            // Update employee shift type
            const employee = this.workforceManager.employees.find(e => e.id === employeeId);
            if (employee) {
                employee.shiftType = this.determineEmployeeShiftType(employee);
            }

            // Save changes
            this.workforceManager.saveData('schedules', this.workforceManager.schedules);
            this.workforceManager.saveData('employees', this.workforceManager.employees);

            console.log(`🗑️ Shift deleted for employee ${employeeId} on ${date}`);
        }
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
