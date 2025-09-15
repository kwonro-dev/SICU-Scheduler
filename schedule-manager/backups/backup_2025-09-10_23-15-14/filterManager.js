// Filter Management Module
// Handles all filtering logic for shifts, roles, and column visibility

class FilterManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        
        // Initialize filter states from localStorage
        this.shiftFilters = this.workforceManager.loadData('shiftFilters') || {
            'all-shifts': true,
            'day': true,
            'night': true
        };
        this.roleFilters = this.workforceManager.loadData('roleFilters') || {};
        this.columnVisibility = this.workforceManager.loadData('columnVisibility') || {
            weekend: true,
            vacation: true,
            required: true
        };
    }

    // Initialize calendar filter states from saved preferences
    initializeCalendarFilters() {
        // Apply saved shift filter states
        Object.keys(this.shiftFilters).forEach(filterKey => {
            const button = document.querySelector(`[data-filter="${filterKey}"]`);
            if (button) {
                if (this.shiftFilters[filterKey]) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }
        });

        // Apply saved role filter states
        Object.keys(this.roleFilters).forEach(filterKey => {
            if (filterKey !== 'all-roles') {
                const button = document.querySelector(`[data-filter="${filterKey}"]`);
                if (button) {
                    if (this.roleFilters[filterKey]) {
                        button.classList.add('active');
                    } else {
                        button.classList.remove('active');
                    }
                }
            }
        });
    }

    // Create role filter buttons dynamically
    createRoleFilterButtons() {
        const roleFiltersContainer = document.getElementById('roleFilters');
        const allRolesButton = document.getElementById('filterAllRoles');

        // Clear existing role buttons (except "All")
        const existingButtons = roleFiltersContainer.querySelectorAll('.role-filter-btn');
        existingButtons.forEach(button => button.remove());

        // Create filter buttons for each job role
        this.workforceManager.jobRoles.forEach(role => {
            const button = document.createElement('button');
            button.id = `filterRole${role.id}`;
            button.className = 'filter-btn role-filter-btn active';
            button.setAttribute('data-filter', role.id);
            button.innerHTML = `<i class="fas fa-user-tag"></i> ${role.name}`;

            button.addEventListener('click', () => this.toggleRoleFilter(role.id));
            roleFiltersContainer.appendChild(button);

            // Initialize filter state
            if (!(role.id in this.roleFilters)) {
                this.roleFilters[role.id] = true; // Default to active
            }
        });

        // Update button states
        this.updateRoleFilterStates();
    }

    // Toggle shift filter
    toggleShiftFilter(filterKey) {
        console.log('Toggling shift filter:', filterKey);
        
        if (filterKey === 'all-shifts') {
            // Toggle all shifts on/off
            const newState = !this.shiftFilters['all-shifts'];
            this.shiftFilters['all-shifts'] = newState;
            this.shiftFilters['day'] = newState;
            this.shiftFilters['night'] = newState;
        } else {
            // Toggle individual shift filter
            this.shiftFilters[filterKey] = !this.shiftFilters[filterKey];

            // Update "all-shifts" state based on individual filters
            const allActive = this.shiftFilters['day'] && this.shiftFilters['night'];
            const allInactive = !this.shiftFilters['day'] && !this.shiftFilters['night'];
            this.shiftFilters['all-shifts'] = allActive || allInactive;
        }

        console.log('New filter state:', this.shiftFilters);

        // Save filter states
        this.workforceManager.saveData('shiftFilters', this.shiftFilters);

        // Update button states
        this.updateShiftFilterStates();

        // Apply filters
        this.applyCalendarFilters();
    }

    // Toggle role filter
    toggleRoleFilter(filterKey) {
        console.log('🎛️ Toggling role filter:', filterKey, 'Current state:', this.roleFilters);

        if (filterKey === 'all-roles') {
            // Toggle all roles on/off
            const newState = !this.roleFilters['all-roles'];
            this.roleFilters['all-roles'] = newState;

            // Set all individual role filters to match
            this.workforceManager.jobRoles.forEach(role => {
                this.roleFilters[role.id] = newState;
            });
        } else {
            // Toggle individual role filter
            this.roleFilters[filterKey] = !this.roleFilters[filterKey];

            // Update "all-roles" state based on individual filters
            const allActive = this.workforceManager.jobRoles.every(role => this.roleFilters[role.id]);
            const allInactive = this.workforceManager.jobRoles.every(role => !this.roleFilters[role.id]);
            this.roleFilters['all-roles'] = allActive || allInactive;
        }

        // Save filter states
        this.workforceManager.saveData('roleFilters', this.roleFilters);

        console.log('🎛️ New role filter state:', this.roleFilters);

        // Update button states
        this.updateRoleFilterStates();

        // Apply filters
        this.applyCalendarFilters();
    }

    // Update shift filter button states
    updateShiftFilterStates() {
        Object.keys(this.shiftFilters).forEach(filterKey => {
            const button = document.querySelector(`[data-filter="${filterKey}"]`);
            if (button) {
                if (this.shiftFilters[filterKey]) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }
        });
    }

    // Update role filter button states
    updateRoleFilterStates() {
        Object.keys(this.roleFilters).forEach(filterKey => {
            const button = document.querySelector(`[data-filter="${filterKey}"]`);
            if (button) {
                if (this.roleFilters[filterKey]) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            }
        });
    }

    // Apply calendar filters to show/hide employees
    applyCalendarFilters() {
        console.log('🎯 Applying calendar filters...');
        const matrixContainer = document.getElementById('scheduleMatrix');
        if (!matrixContainer) {
            console.log('❌ Matrix container not found');
            return;
        }

        // Clear existing filtered rows
        matrixContainer.classList.remove('filtered-view');

        // Re-render the matrix with filters applied
        console.log('🔄 Re-rendering schedule matrix with filters...');
        this.workforceManager.renderScheduleMatrix();

        // Add filtered class to enable filtered styling
        matrixContainer.classList.add('filtered-view');

        console.log('✅ Filters applied successfully');
    }

    // Determine if an employee should be shown based on current filters
    shouldShowEmployee(employee) {
        // Check shift filter
        const employeeShiftType = this.workforceManager.determineEmployeeShiftType(employee);
        const shiftMatch = this.shiftFilters['all-shifts'] ||
                          (this.shiftFilters['day'] && employeeShiftType === 'Day') ||
                          (this.shiftFilters['night'] && employeeShiftType === 'Night');

        // Check role filter
        const roleMatch = this.roleFilters['all-roles'] || this.roleFilters[employee.roleId];

        // Debug: Log filtering decision for first few employees
        if (employee.name && (employee.name.includes('John') || employee.name.includes('Jane'))) {
            console.log(`🎯 Filtering ${employee.name}: shiftMatch=${shiftMatch}, roleMatch=${roleMatch}, all-roles=${this.roleFilters['all-roles']}, employeeRole=${this.roleFilters[employee.roleId]}, shouldShow=${shiftMatch && roleMatch}`);
        }

        return shiftMatch && roleMatch;
    }

    // Update role filters when roles are modified
    updateRoleFilters() {
        console.log('🔄 Updating role filters...');
        console.log('Before update:', this.roleFilters);

        // Initialize all-roles filter if not present
        if (!('all-roles' in this.roleFilters)) {
            this.roleFilters['all-roles'] = true;
        }

        // Ensure all roles have filter entries
        this.workforceManager.jobRoles.forEach(role => {
            if (!(role.id in this.roleFilters)) {
                this.roleFilters[role.id] = true;
            }
        });

        // Remove filters for roles that no longer exist
        Object.keys(this.roleFilters).forEach(filterKey => {
            if (filterKey !== 'all-roles' && !this.workforceManager.jobRoles.find(role => role.id === filterKey)) {
                delete this.roleFilters[filterKey];
            }
        });

        console.log('After update:', this.roleFilters);

        // Recreate role filter buttons to reflect any changes
        if (document.readyState === 'complete') {
            this.createRoleFilterButtons();
        }

        // Save updated filter states
        this.workforceManager.saveData('roleFilters', this.roleFilters);
    }

    // Helper method to check if a role type should be visible in summary
    shouldShowRoleInSummary(roleType) {
        // Check if there are any employees of this role type that pass the ROLE filters only
        return this.workforceManager.employees.some(employee => {
            // Apply only role filtering logic, not shift filtering
            const roleMatch = this.roleFilters['all-roles'] || this.roleFilters[employee.roleId];
            if (!roleMatch) {
                return false; // Skip this employee if they don't pass the role filters
            }

            const role = this.workforceManager.jobRoles.find(r => r.id === employee.roleId);
            const roleName = role ? role.name : '';

            // Check if this employee matches the role type we're looking for
            switch (roleType) {
                case 'AMGR':
                    return roleName.toUpperCase().includes('AMGR') ||
                           roleName.toUpperCase().includes('MANAGER') ||
                           roleName === 'AMGR';
                case 'PCT':
                    return roleName.toUpperCase().includes('PCT') ||
                           roleName.toUpperCase().includes('PHLEBOTOMIST') ||
                           roleName === 'PCT';
                case 'US':
                    return roleName.toUpperCase().includes('US') ||
                           roleName.toUpperCase().includes('ULTRASOUND') ||
                           roleName === 'US';
                case 'RN':
                    return roleName.toUpperCase().includes('RN') ||
                           roleName.toUpperCase().includes('NURSE') ||
                           roleName === 'RN';
                case 'RT':
                    return roleName.toUpperCase().includes('RT') ||
                           roleName.toUpperCase().includes('RESPIRATORY') ||
                           roleName === 'RT';
                case 'TECH':
                    return roleName.toUpperCase().includes('TECH') ||
                           roleName.toUpperCase().includes('TECHNICIAN') ||
                           roleName === 'TECH';
                case 'CHARGE':
                    return roleName.toUpperCase().includes('CHARGE') ||
                           roleName.toUpperCase().includes('CHG') ||
                           roleName === 'CHARGE';
                default:
                    return false;
            }
        });
    }

    // Toggle column visibility
    toggleColumn(columnType) {
        this.columnVisibility[columnType] = !this.columnVisibility[columnType];
        this.workforceManager.saveData('columnVisibility', this.columnVisibility);
        this.updateColumnToggleButtons();
        this.updateColumnVisibility();
        this.workforceManager.uiManager.updateGridTemplate();
    }

    // Update column toggle button states
    updateColumnToggleButtons() {
        const weekendToggle = document.getElementById('toggleWeekendColumns');
        const vacationToggle = document.getElementById('toggleVacationColumn');
        const requiredToggle = document.getElementById('toggleRequiredColumn');

        if (weekendToggle) {
            if (this.columnVisibility.weekend) {
                weekendToggle.classList.add('active');
            } else {
                weekendToggle.classList.remove('active');
            }
        }

        if (vacationToggle) {
            if (this.columnVisibility.vacation) {
                vacationToggle.classList.add('active');
            } else {
                vacationToggle.classList.remove('active');
            }
        }

        if (requiredToggle) {
            if (this.columnVisibility.required) {
                requiredToggle.classList.add('active');
            } else {
                requiredToggle.classList.remove('active');
            }
        }
    }

    // Update column visibility in the calendar with dynamic positioning
    updateColumnVisibility() {
        // Define column order (right to left) - easily extensible for new columns
        // To add new columns:
        // 1. Add the column key to this.columnVisibility in constructor
        // 2. Add the column definition here with key, selector, and width
        // 3. Add the HTML structure in renderScheduleMatrix()
        // 4. Add the toggle button in index.html
        // 5. Add the event listener in bindColumnToggles()
        const columnOrder = [
            { key: 'required', selector: 'req', width: 40 },
            { key: 'vacation', selector: 'vac', width: 40 },
            { key: 'weekend', selector: 'sun', width: 40 },
            { key: 'weekend', selector: 'sat', width: 40 },
            { key: 'weekend', selector: 'fri', width: 40 }
        ];

        // Calculate positions dynamically
        let currentPosition = 0;
        const positions = {};

        // Process columns from right to left
        for (let i = 0; i < columnOrder.length; i++) {
            const column = columnOrder[i];
            const isVisible = this.columnVisibility[column.key];
            
            if (isVisible) {
                positions[column.selector] = currentPosition;
                currentPosition += column.width;
            } else {
                positions[column.selector] = -1; // Hidden
            }
        }

        // Apply visibility and positioning
        columnOrder.forEach(column => {
            const headers = document.querySelectorAll(`.matrix-cell.count-header-${column.selector}`);
            const cells = document.querySelectorAll(`.matrix-cell.count-cell-${column.selector}`);
            
            const position = positions[column.selector];
            const isVisible = position >= 0;

            // Apply visibility
            headers.forEach(cell => {
                cell.style.display = isVisible ? 'block' : 'none';
                if (isVisible) {
                    cell.style.right = `${position}px`;
                }
            });

            cells.forEach(cell => {
                cell.style.display = isVisible ? 'block' : 'none';
                if (isVisible) {
                    cell.style.right = `${position}px`;
                }
            });
        });
    }

    // Bind column toggle event listeners
    bindColumnToggles() {
        const weekendToggle = document.getElementById('toggleWeekendColumns');
        const vacationToggle = document.getElementById('toggleVacationColumn');
        const requiredToggle = document.getElementById('toggleRequiredColumn');

        if (weekendToggle) {
            weekendToggle.addEventListener('click', () => this.toggleColumn('weekend'));
        }

        if (vacationToggle) {
            vacationToggle.addEventListener('click', () => this.toggleColumn('vacation'));
        }

        if (requiredToggle) {
            requiredToggle.addEventListener('click', () => this.toggleColumn('required'));
        }

        // Update button states based on current visibility
        this.updateColumnToggleButtons();
    }

    // Get visible count columns for grid template calculation
    getVisibleCountColumns() {
        let count = 0;
        if (this.columnVisibility.weekend) count += 3; // Fri, Sat, Sun
        if (this.columnVisibility.vacation) count += 1; // Vac
        if (this.columnVisibility.required) count += 1; // Req
        return count;
    }

    // Check if column is visible
    isColumnVisible(columnType) {
        return this.columnVisibility[columnType] || false;
    }
}

// Export the class
window.FilterManager = FilterManager;
