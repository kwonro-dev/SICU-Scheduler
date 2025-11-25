// Employee Manager Module
// Handles all employee-related operations and management

class EmployeeManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        // PERFORMANCE FIX: Cache for role badge classes to avoid repeated lookups
        this.roleBadgeClassCache = new Map();
    }
    
    // Clear cache when roles change
    clearRoleBadgeCache() {
        this.roleBadgeClassCache.clear();
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
                                <button class="priority-btn priority-a ${priority === 'A' ? 'active' : ''}" onclick="window.workforceManager?.employeeManager?.setPriority('${employee.id}', 'A')" title="Set Priority A">A</button>
                                <button class="priority-btn priority-b ${priority === 'B' ? 'active' : ''}" onclick="window.workforceManager?.employeeManager?.setPriority('${employee.id}', 'B')" title="Set Priority B">B</button>
                                <button class="priority-btn priority-c ${priority === 'C' ? 'active' : ''}" onclick="window.workforceManager?.employeeManager?.setPriority('${employee.id}', 'C')" title="Set Priority C">C</button>
                                <button class="priority-btn priority-none ${!priority ? 'active' : ''}" onclick="window.workforceManager?.employeeManager?.setPriority('${employee.id}', '')" title="Remove Priority">×</button>
                            </div>
                            <button class="btn btn-sm btn-secondary" onclick="workforceManager?.modalManager?.editEmployee('${employee.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="window.workforceManager?.employeeManager?.deleteEmployee('${employee.id}')">
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
    async setPriority(employeeId, priority) {
        const employee = this.workforceManager.employees.find(e => e.id === employeeId);
        if (!employee) return;

        employee.priority = priority || '';

        // Save changes using individual CRUD
        await this.workforceManager.updateEmployee(employee.id, { priority: employee.priority });

        // Refresh views
        this.renderUsersView();
        this.workforceManager.calendarRenderer.renderScheduleMatrix();
    }

    // Delete employee
    async deleteEmployee(employeeId) {
        const employee = this.workforceManager.employees.find(e => e.id === employeeId);
        if (!employee) return;

        if (confirm(`Are you sure you want to delete ${employee.name}?`)) {
            // Remove employee
            this.workforceManager.employees = this.workforceManager.employees.filter(e => e.id !== employeeId);
            // Remove associated schedules
            // Remove associated schedules using individual CRUD
            const schedulesToDelete = this.workforceManager.schedules.filter(s => s.employeeId === employeeId);
            for (const schedule of schedulesToDelete) {
                await this.workforceManager.deleteSchedule(schedule.id);
            }

            // Delete employee using individual CRUD
            await this.workforceManager.deleteEmployee(employeeId);

            // Refresh views
            this.renderUsersView();
            this.workforceManager.calendarRenderer.renderScheduleMatrix();
        }
    }

    // Helper function to get CSS class for role badges
    // PERFORMANCE FIX: Cache lookups to avoid repeated .find() calls
    getRoleBadgeClass(roleName) {
        // Check cache first
        if (this.roleBadgeClassCache.has(roleName)) {
            return this.roleBadgeClassCache.get(roleName);
        }
        
        // Find the role by name to get its custom color
        const role = this.workforceManager.jobRoles.find(r => r.name === roleName);
        let result;
        
        if (role && role.color) {
            // Return a dynamic class name based on the color
            result = `custom-role-badge-${role.color.replace('#', '')}`;
        } else {
            // Fallback to default colors for legacy roles or when no color is set
            const defaultClasses = {
                'Manager': 'manager-badge',
                'Senior Cashier': 'senior-cashier-badge',
                'Cashier': 'cashier-badge',
                'Stock Clerk': 'stock-clerk-badge',
                'Sales Associate': 'sales-associate-badge',
                'No Role': 'no-role-badge'
            };
            result = defaultClasses[roleName] || 'default-role-badge';
        }
        
        // Cache the result
        this.roleBadgeClassCache.set(roleName, result);
        return result;
    }

    // Helper function to determine employee's shift type based on their schedules
    // PERFORMANCE FIX: Use pre-built map and early exit
    determineEmployeeShiftType(employee) {
        // Build shift type map once if not cached
        if (!this._shiftTypeMap) {
            this._shiftTypeMap = new Map();
            this.workforceManager.shiftTypes.forEach(s => {
                this._shiftTypeMap.set(s.id, s);
            });
        }
        
        // Check schedules with early exit on first night shift found
        const schedules = this.workforceManager.schedules;
        const employeeId = employee.id;
        
        for (let i = 0; i < schedules.length; i++) {
            const schedule = schedules[i];
            if (schedule.employeeId === employeeId) {
                const shiftType = this._shiftTypeMap.get(schedule.shiftId);
                if (shiftType && this.isNightShift(shiftType.name)) {
                    return 'Night';
                }
            }
        }

        // If no night shifts found, classify as Day
        return 'Day';
    }
    
    // Clear shift type map when shift types change
    clearShiftTypeCache() {
        this._shiftTypeMap = null;
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
    async updateAllEmployeeShiftTypes() {
        for (const employee of this.workforceManager.employees) {
            const shiftType = this.determineEmployeeShiftType(employee);
            employee.shiftType = shiftType;
            // Update employee using individual CRUD
            await this.workforceManager.updateEmployee(employee.id, { shiftType });
        }
    }

    /**
     * Assign a shift to an employee for a specific date
     * @param {string} employeeId - The ID of the employee
     * @param {string} date - The date in YYYY-MM-DD format
     * @param {string|null} shiftId - The ID of the shift to assign, or null to remove assignment
     */
    async assignShiftToEmployee(employeeId, date, shiftId) {
        console.log(`Assigning shift ${shiftId} to employee ${employeeId} for date ${date}`);

        // Find existing schedule entry
        const existingSchedule = this.workforceManager.schedules.find(s =>
            s.employeeId === employeeId && s.date === date
        );

        // Get employee and shift details for logging
        const employee = this.workforceManager.employees.find(e => e.id === employeeId);
        const shiftType = this.workforceManager.shiftTypes.find(s => s.id === shiftId);

        if (shiftId) {
            // Update or create schedule entry
            if (existingSchedule) {
                console.log(`🔄 Updating existing schedule ${existingSchedule.id} from shift ${existingSchedule.shiftId} to ${shiftId}`);

                // Update existing schedule
                await this.workforceManager.updateSchedule(existingSchedule.id, { shiftId });

                // Force local data refresh to ensure UI consistency
                const index = this.workforceManager.schedules.findIndex(s => s.id === existingSchedule.id);
                if (index >= 0) {
                    this.workforceManager.schedules[index] = { ...this.workforceManager.schedules[index], shiftId };
                    console.log(`✅ Local data updated: schedule ${existingSchedule.id} now has shiftId ${shiftId}`);
                }

                // Log activity
                await this.workforceManager.activityManager.ensureActivityLogger();
                if (this.workforceManager.activityManager.activityLogger) {
                    await this.workforceManager.activityManager.activityLogger.logActivity(
                        'assign_shift',
                        'schedule',
                        existingSchedule.id,
                        {
                            employeeName: employee?.name || 'Unknown',
                            shiftName: shiftType?.name || 'Unknown',
                            date: date
                        }
                    );
                }
            } else {
                // Create new schedule
                const newSchedule = {
                    employeeId,
                    shiftId,
                    date
                };
                const createdSchedule = await this.workforceManager.addSchedule(newSchedule);
                
                // Log activity
                await this.workforceManager.activityManager.ensureActivityLogger();
                if (this.workforceManager.activityManager.activityLogger) {
                    await this.workforceManager.activityManager.activityLogger.logActivity(
                        'assign_shift',
                        'schedule',
                        createdSchedule.id,
                        { 
                            employeeName: employee?.name || 'Unknown',
                            shiftName: shiftType?.name || 'Unknown',
                            date: date
                        }
                    );
                }
            }
        } else {
            // Remove schedule entry if shiftId is null/empty (set to "off")
            if (existingSchedule) {
                await this.workforceManager.deleteSchedule(existingSchedule.id);
                
                // Log activity
                await this.workforceManager.activityManager.ensureActivityLogger();
                if (this.workforceManager.activityManager.activityLogger) {
                    await this.workforceManager.activityManager.activityLogger.logActivity(
                        'unassign_shift',
                        'schedule',
                        existingSchedule.id,
                        { 
                            employeeName: employee?.name || 'Unknown',
                            date: date
                        }
                    );
                }
            }
        }

        // Update employee shift type based on their schedules
        if (employee) {
            employee.shiftType = this.determineEmployeeShiftType(employee);
            // Update employee using individual CRUD
            await this.workforceManager.updateEmployee(employeeId, { shiftType: employee.shiftType });
        }

        // Always force re-render for any schedule change to ensure UI consistency
        setTimeout(() => {
            console.log('🔄 Forcing re-render after schedule operation');
            console.log('📊 Current schedules state:', this.workforceManager.schedules.filter(s =>
                s.employeeId === employeeId && s.date === date
            ));

            // Cleanup existing event handlers before re-render
            if (this.workforceManager.uiManager) {
                this.workforceManager.uiManager.cleanupGlobalContextMenu();
            }

            this.workforceManager.calendarRenderer.renderScheduleMatrix();
            // Ensure events are rebound after the re-render
            setTimeout(() => {
                if (this.workforceManager.uiManager) {
                    this.workforceManager.uiManager.bindShiftCellEvents();
                }
            }, 50);
        }, 50);
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
            this.workforceManager.dataManager.saveData('shiftTypes', this.workforceManager.shiftTypes);
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
