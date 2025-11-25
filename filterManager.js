// Filter Management Module
// Handles all filtering logic for shifts, roles, and column visibility

class FilterManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        
        // Initialize filter states from localStorage
        this.shiftFilters = this.workforceManager.dataManager.loadData('shiftFilters') || {
            'all-shifts': true,
            'day': true,
            'night': true
        };
        
        // Initialize role filters from localStorage with defaults
        this.roleFilters = this.workforceManager.dataManager.loadData('roleFilters') || {
            'charge-shifts': false  // Default to inactive
        };
        // Force reset column visibility to clean defaults (ignore saved data)
        this.columnVisibility = {
            weekend: false,  // F/S/S filter OFF by default
            vacation: false, // VAC filter OFF by default
            required: false, // REQ filter OFF by default
            charge: false,   // CN filter OFF by default
            move: false      // MOV filter OFF by default
        };
        
        // Clear any saved column visibility data from localStorage
        localStorage.removeItem('columnVisibility');
        this.sortOrder = this.workforceManager.dataManager.loadData('sortOrder') || 'original';
        
        // Debouncing for filter updates
        this.filterUpdateTimeout = null;
        this.pendingFilterUpdate = false;
        
        // Cache for filtered employees to avoid recalculation
        this.filteredEmployeesCache = null;
        this.lastFilterState = null;
        
        // Cache for expensive role operations
        this.roleFilterCache = new Map();
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

        // Initialize sort dropdown label if present
        const sortMenu = document.getElementById('sortMenu');
        const sortMenuLabel = document.getElementById('sortMenuLabel');
        if (sortMenu && sortMenuLabel) {
            const initialItem = sortMenu.querySelector(`.dropdown-item[data-sort="${this.sortOrder || 'original'}"]`);
            if (initialItem) {
                const text = initialItem.textContent.trim();
                sortMenuLabel.textContent = text.replace(/^.*?\s/, '') || text;
            }
        }
    }

    // Create role filter buttons dynamically
    createRoleFilterButtons() {
        const roleFiltersContainer = document.getElementById('roleFilters');
        const allRolesButton = document.getElementById('filterAllRoles');

        // Clear existing role buttons (except "All")
        const existingButtons = roleFiltersContainer.querySelectorAll('.role-filter-btn');
        existingButtons.forEach(button => button.remove());

        // Define the preferred order for role filter buttons
        const roleOrder = ['AMGR', 'MGR', 'RN', 'PCT', 'US', 'CHARGE'];
        
        // Sort job roles according to the preferred order
        const sortedRoles = [...this.workforceManager.jobRoles].sort((a, b) => {
            const aIndex = roleOrder.indexOf(a.name.toUpperCase());
            const bIndex = roleOrder.indexOf(b.name.toUpperCase());
            
            // If both roles are in the order list, sort by their position
            if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
            }
            // If only one role is in the order list, prioritize it
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            // If neither role is in the order list, sort alphabetically
            return a.name.localeCompare(b.name);
        });

        // Create filter buttons for each job role in the sorted order
        sortedRoles.forEach(role => {
            const button = document.createElement('button');
            button.id = `filterRole${role.id}`;
            button.className = 'filter-btn role-filter-btn';
            button.setAttribute('data-filter', role.id);
            // Add data-role attribute for styling based on role name
            button.setAttribute('data-role', role.name.toUpperCase());
            button.innerHTML = `<i class="fas fa-user-tag"></i> ${role.name}`;

            button.addEventListener('click', () => this.toggleRoleFilter(role.id));
            roleFiltersContainer.appendChild(button);

            // Initialize filter state - ensure all roles have entries
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

        // Performance logging only in development
        if (window.location.hostname === 'localhost') {
            console.log('New filter state:', this.shiftFilters);
        }

        // Save filter states
        this.workforceManager.dataManager.saveData('shiftFilters', this.shiftFilters);

        // Invalidate cache since filters changed
        this.filteredEmployeesCache = null;
        this.roleFilterCache.clear();

        // Update button states
        this.updateShiftFilterStates();

        // Apply filters with debouncing
        this.applyCalendarFiltersDebounced();
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
            
            // Note: charge-shifts filter remains independent and is not affected by "All" toggle
        } else if (filterKey === 'charge-shifts') {
            // Toggle charge-shifts filter
            this.roleFilters[filterKey] = !this.roleFilters[filterKey];
        } else {
            // Toggle individual role filter
            this.roleFilters[filterKey] = !this.roleFilters[filterKey];

            // Update "all-roles" state based on individual filters
            const allActive = this.workforceManager.jobRoles.every(role => this.roleFilters[role.id]);
            const allInactive = this.workforceManager.jobRoles.every(role => !this.roleFilters[role.id]);
            this.roleFilters['all-roles'] = allActive || allInactive;
        }

        // Save filter states
        this.workforceManager.dataManager.saveData('roleFilters', this.roleFilters);

        // Performance logging only in development
        if (window.location.hostname === 'localhost') {
            console.log('🎛️ New role filter state:', this.roleFilters);
        }

        // Invalidate cache since filters changed
        this.filteredEmployeesCache = null;
        this.roleFilterCache.clear();

        // Update button states
        this.updateRoleFilterStates();

        // Apply filters with debouncing
        this.applyCalendarFiltersDebounced();
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
        const matrixContainer = document.getElementById('scheduleMatrix');
        if (!matrixContainer) {
            return;
        }

        // Clear existing filtered rows
        matrixContainer.classList.remove('filtered-view');

        // Re-render the matrix with filters applied
        this.workforceManager.calendarRenderer.renderScheduleMatrix();

        // Re-initialize filter buttons after rendering
        this.initializeCalendarFilters();
        this.createRoleFilterButtons();

        // Add filtered class to enable filtered styling
        matrixContainer.classList.add('filtered-view');

        // Performance logging only in development
        if (window.location.hostname === 'localhost') {
            console.log('✅ Filters applied successfully');
        }
    }

    // Debounced version of applyCalendarFilters to prevent rapid successive calls
    applyCalendarFiltersDebounced() {
        // Clear existing timeout
        if (this.filterUpdateTimeout) {
            clearTimeout(this.filterUpdateTimeout);
        }

        // Use requestAnimationFrame for smoother updates
        this.filterUpdateTimeout = setTimeout(() => {
            requestAnimationFrame(() => {
                this.applyCalendarFilters();
                this.pendingFilterUpdate = false;
            });
        }, 4); // 4ms + RAF = ultra-responsive
    }

    // Get cached filtered employees or calculate if cache is invalid
    // PERFORMANCE FIX: Cache now works for ALL sort orders including 'original'
    getCachedFilteredEmployees() {
        // Build cache key from employee count + filter state (faster than JSON.stringify)
        const employeeCount = this.workforceManager.employees.length;
        const cacheKey = `${employeeCount}_${this.sortOrder}_${Object.keys(this.shiftFilters).map(k => this.shiftFilters[k] ? '1' : '0').join('')}_${Object.keys(this.roleFilters).map(k => this.roleFilters[k] ? '1' : '0').join('')}`;

        // Return cached result if cache key hasn't changed
        if (this.filteredEmployeesCache && this.lastFilterState === cacheKey) {
            return this.filteredEmployeesCache;
        }

        // Calculate filtered employees
        const filteredEmployees = this.workforceManager.employees.filter(employee => 
            this.shouldShowEmployee(employee)
        );

        // Sort employees (works for all sort orders including 'original')
        const sortedEmployees = this.getSortedEmployees(filteredEmployees);

        // Cache the result
        this.filteredEmployeesCache = sortedEmployees;
        this.lastFilterState = cacheKey;

        return sortedEmployees;
    }

    /**
     * Determine if an employee should be shown based on current filters
     * @param {Object} employee - The employee object to check
     * @returns {boolean} True if employee should be displayed
     */
    shouldShowEmployee(employee) {
        // Check shift filter
        const employeeShiftType = this.workforceManager.employeeManager.determineEmployeeShiftType(employee);
        const shiftMatch = this.shiftFilters['all-shifts'] ||
                          (this.shiftFilters['day'] && employeeShiftType === 'Day') ||
                          (this.shiftFilters['night'] && employeeShiftType === 'Night');

        // Check role filter
        const roleMatch = this.roleFilters['all-roles'] || this.roleFilters[employee.roleId];

        // Check charge-shifts filter
        const chargeMatch = !this.roleFilters['charge-shifts'] || this.hasChargeShifts(employee);

        // Debug logging removed for performance

        return shiftMatch && roleMatch && chargeMatch;
    }

    // Update role filters when roles are modified
    updateRoleFilters(saveToFirebase = true) {
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

        // Save updated filter states (only if saveToFirebase is true)
        if (saveToFirebase) {
            this.workforceManager.dataManager.saveData('roleFilters', this.roleFilters);
        }
    }

    // Helper method to check if a role type should be visible in summary
    shouldShowRoleInSummary(roleType) {
        // Check cache first
        const cacheKey = `${roleType}_${JSON.stringify(this.roleFilters)}`;
        if (this.roleFilterCache.has(cacheKey)) {
            return this.roleFilterCache.get(cacheKey);
        }

        // Check if there are any employees of this role type that pass the ROLE filters only
        const result = this.workforceManager.employees.some(employee => {
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

        // Cache the result
        this.roleFilterCache.set(cacheKey, result);
        return result;
    }

    // Toggle column visibility
    toggleColumn(columnType) {
        this.columnVisibility[columnType] = !this.columnVisibility[columnType];
        this.workforceManager.dataManager.saveData('columnVisibility', this.columnVisibility);
        this.updateColumnToggleButtons();
        this.updateColumnVisibility();
        this.workforceManager.uiManager.updateGridTemplate();
    }

    // Update column toggle button states
    updateColumnToggleButtons() {
        const weekendToggle = document.getElementById('toggleWeekendColumns');
        const vacationToggle = document.getElementById('toggleVacationColumn');
        const requiredToggle = document.getElementById('toggleRequiredColumn');
        const chargeToggle = document.getElementById('toggleChargeColumn');
        const moveToggle = document.getElementById('toggleMoveColumn');

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

        if (chargeToggle) {
            if (this.columnVisibility.charge) {
                chargeToggle.classList.add('active');
            } else {
                chargeToggle.classList.remove('active');
            }
        }

        if (moveToggle) {
            if (this.columnVisibility.move) {
                moveToggle.classList.add('active');
            } else {
                moveToggle.classList.remove('active');
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
            { key: 'weekend', selector: 'fri', width: 40 },
            { key: 'weekend', selector: 'sat', width: 40 },
            { key: 'weekend', selector: 'sun', width: 40 },
            { key: 'vacation', selector: 'vac', width: 40 },
            { key: 'required', selector: 'req', width: 40 },
            { key: 'charge', selector: 'cha', width: 40 },
            { key: 'move', selector: 'mov', width: 40 }
        ];

        // Calculate positions dynamically from right to left
        let currentPosition = 0;
        const positions = {};
        const visibleColumns = columnOrder.filter(col => this.columnVisibility[col.key]);

        // Calculate total width of visible columns first
        const totalVisibleWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0);

        // Process columns from right to left for proper sticky positioning
        for (let i = columnOrder.length - 1; i >= 0; i--) {
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
                if (isVisible) {
                    cell.style.display = 'block';
                    cell.style.visibility = 'visible';
                    cell.style.width = '40px';
                    cell.style.minWidth = '40px';
                    cell.style.position = 'sticky';
                    cell.style.right = `${position}px`;
                    cell.style.zIndex = '15';
                    // Restore original border styles
                    cell.style.border = '';
                    cell.style.padding = '';
                } else {
                    cell.style.visibility = 'hidden';
                    cell.style.width = '0px';
                    cell.style.minWidth = '0px';
                    cell.style.padding = '0px';
                    cell.style.border = 'none';
                }
            });

            cells.forEach(cell => {
                if (isVisible) {
                    cell.style.display = 'block';
                    cell.style.visibility = 'visible';
                    cell.style.width = '40px';
                    cell.style.minWidth = '40px';
                    cell.style.position = 'sticky';
                    cell.style.right = `${position}px`;
                    cell.style.zIndex = '12';
                    // Restore original border styles
                    cell.style.border = '';
                    cell.style.padding = '';
                } else {
                    cell.style.visibility = 'hidden';
                    cell.style.width = '0px';
                    cell.style.minWidth = '0px';
                    cell.style.padding = '0px';
                    cell.style.border = 'none';
                }
            });
        });
    }

    // Bind column toggle event listeners
    bindColumnToggles() {
        const weekendToggle = document.getElementById('toggleWeekendColumns');
        const vacationToggle = document.getElementById('toggleVacationColumn');
        const requiredToggle = document.getElementById('toggleRequiredColumn');
        const chargeToggle = document.getElementById('toggleChargeColumn');
        const moveToggle = document.getElementById('toggleMoveColumn');

        if (weekendToggle) {
            weekendToggle.addEventListener('click', () => this.toggleColumn('weekend'));
        }

        if (vacationToggle) {
            vacationToggle.addEventListener('click', () => this.toggleColumn('vacation'));
        }

        if (requiredToggle) {
            requiredToggle.addEventListener('click', () => this.toggleColumn('required'));
        }

        if (chargeToggle) {
            chargeToggle.addEventListener('click', () => this.toggleColumn('charge'));
        }

        if (moveToggle) {
            moveToggle.addEventListener('click', () => this.toggleColumn('move'));
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
        if (this.columnVisibility.charge) count += 1; // CHA
        if (this.columnVisibility.move) count += 1; // MOV
        return count;
    }

    // Check if column is visible
    isColumnVisible(columnType) {
        return this.columnVisibility[columnType] || false;
    }

    // Check if employee has any shifts containing "Charg"
    hasChargeShifts(employee) {
        // Get time interval from localStorage or use 48 as default
        const timeInterval = this.workforceManager.calendarRenderer?.getCachedTimeInterval() || 42;
        
        // Use the configured start date
        const calendarStartDate = new Date(this.workforceManager.currentWeekStart.getFullYear(), this.workforceManager.currentWeekStart.getMonth(), this.workforceManager.currentWeekStart.getDate());
        
        // Generate dates starting from the selected start date
        const weekDates = [];
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            weekDates.push(date);
        }

        // Check each date for this employee
        for (let i = 0; i < timeInterval; i++) {
            const date = weekDates[i];
            const dateString = formatDateString(date);
            const scheduleKey = `${employee.id}_${dateString}`;
            
            // Find the schedule for this employee and date
            const schedule = this.workforceManager.schedules.find(s => s.employeeId === employee.id && s.date === dateString);
            
            if (schedule) {
                const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                const shiftName = shiftType ? shiftType.name : schedule.shiftType || '';
                
                // Check if shift name contains "Charg"
                if (shiftName.includes('Charg') || 
                    shiftName.toUpperCase().includes('CHARGE') || 
                    shiftName.toLowerCase().includes('charge')) {
                    console.log(`🔍 Found charge shift for ${employee.name}: ${shiftName} on ${dateString}`);
                    return true;
                }
            }
        }
        
        return false;
    }

    // Set sort order and trigger re-render
    setSortOrder(sortValue) {
        this.sortOrder = sortValue;
        this.workforceManager.dataManager.saveData('sortOrder', this.sortOrder);
        
        // Clear cache when switching to original sort to ensure fresh data
        if (sortValue === 'original') {
            this.filteredEmployeesCache = null;
            this.lastFilterState = null;
        }
        
        this.applyCalendarFilters(); // This will trigger re-render
    }

    // Get sorted employees (applies after filtering)
    getSortedEmployees(employees) {
        if (!employees || employees.length === 0) return employees;
        
        const sortOrder = this.sortOrder || 'original';
        console.log('🔄 Sorting employees by:', sortOrder, 'Total employees:', employees.length);
        
        let sortedEmployees;
        switch(sortOrder) {
            case 'name-asc':
                sortedEmployees = [...employees].sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-desc':
                sortedEmployees = [...employees].sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'group-asc':
                sortedEmployees = [...employees].sort((a, b) => {
                    const priorityA = a.priority || '';
                    const priorityB = b.priority || '';
                    
                    // Define priority order: A, B, C, then empty/none
                    const priorityOrder = { 'A': 1, 'B': 2, 'C': 3, '': 4 };
                    const orderA = priorityOrder[priorityA] || 4;
                    const orderB = priorityOrder[priorityB] || 4;
                    
                    if (orderA !== orderB) {
                        return orderA - orderB;
                    }
                    // If same priority, sort by name
                    return a.name.localeCompare(b.name);
                });
                break;
            case 'group-desc':
                sortedEmployees = [...employees].sort((a, b) => {
                    const priorityA = a.priority || '';
                    const priorityB = b.priority || '';
                    
                    // Define priority order: empty/none, C, B, A
                    const priorityOrder = { 'A': 4, 'B': 3, 'C': 2, '': 1 };
                    const orderA = priorityOrder[priorityA] || 1;
                    const orderB = priorityOrder[priorityB] || 1;
                    
                    if (orderA !== orderB) {
                        return orderA - orderB;
                    }
                    // If same priority, sort by name
                    return a.name.localeCompare(b.name);
                });
                break;
            case 'shift-asc':
                sortedEmployees = [...employees].sort((a, b) => {
                    const shiftA = a.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(a);
                    const shiftB = b.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(b);
                    // Day shifts first, then Night shifts
                    if (shiftA === 'Day' && shiftB === 'Night') return -1;
                    if (shiftA === 'Night' && shiftB === 'Day') return 1;
                    return shiftA.localeCompare(shiftB);
                });
                break;
            case 'shift-desc':
                sortedEmployees = [...employees].sort((a, b) => {
                    const shiftA = a.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(a);
                    const shiftB = b.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(b);
                    // Night shifts first, then Day shifts
                    if (shiftA === 'Night' && shiftB === 'Day') return -1;
                    if (shiftA === 'Day' && shiftB === 'Night') return 1;
                    return shiftB.localeCompare(shiftA);
                });
                break;
            case 'original':
            default:
                // For original order, we need to preserve the order from the data file
                // Sort by orderIndex to maintain the original import order
                console.log('🔍 Original order - first 5 employees before sorting:', employees.slice(0, 5).map(e => e.name));
                sortedEmployees = [...employees].sort((a, b) => {
                    // Sort by orderIndex if available, otherwise by name for consistency
                    if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
                        return a.orderIndex - b.orderIndex;
                    }
                    // Fallback to name sorting if orderIndex is missing
                    return a.name.localeCompare(b.name);
                });
                console.log('🔍 Original order - first 5 employees after sorting:', sortedEmployees.slice(0, 5).map(e => e.name));
        }
        
        // Debug: Log first few sorted employee names
        if (sortedEmployees.length > 0) {
            if (sortOrder.startsWith('group')) {
                const namesWithPriority = sortedEmployees.slice(0, 5).map(emp => `${emp.name}(${emp.priority || 'None'})`).join(', ');
                console.log('📋 Sorted employee names with priority (first 5):', namesWithPriority);
            } else {
                const names = sortedEmployees.slice(0, 5).map(emp => emp.name).join(', ');
                console.log('📋 Sorted employee names (first 5):', names);
            }
        }
        
        return sortedEmployees;
    }
}

// Export the class
window.FilterManager = FilterManager;
