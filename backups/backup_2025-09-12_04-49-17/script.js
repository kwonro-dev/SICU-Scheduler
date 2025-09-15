// Workforce Schedule Manager Application
/**
 * Main application class that manages the workforce scheduling system
 * Coordinates between all modules and handles data persistence
 */
class WorkforceScheduleManager {
    /**
     * Initialize the Workforce Schedule Manager application
     * Sets up all modules, loads data, and initializes the UI
     */
    constructor() {
        console.log('🚀 WorkforceScheduleManager constructor called');

        this.employees = this.loadData('employees') || [];
        this.shiftTypes = this.loadData('shiftTypes') || [];
        this.jobRoles = this.loadData('jobRoles') || [];
        this.schedules = this.loadData('schedules') || [];

        // Clean up employee data by removing deprecated fields
        this.cleanEmployeeData();

        // Initialize change tracking
        this.shiftChanges = this.loadData('shiftChanges') || [];
        this.changeHistory = this.loadData('changeHistory') || [];

        // Initialize filter manager
        this.filterManager = new FilterManager(this);

        // Initialize currentWeekStart from localStorage or default to Monday of current week
        const savedStartDate = localStorage.getItem('calendarStartDate');
        if (savedStartDate) {
            // Create date at local midnight to avoid timezone issues
            const [year, month, day] = savedStartDate.split('-').map(Number);
            this.currentWeekStart = new Date(year, month - 1, day);
            console.log('📅 Loaded saved start date:', savedStartDate, '->', `${this.currentWeekStart.getFullYear()}-${String(this.currentWeekStart.getMonth() + 1).padStart(2, '0')}-${String(this.currentWeekStart.getDate()).padStart(2, '0')}`);
        } else {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Monday of current week
            this.currentWeekStart = startDate;
            console.log('📅 Using default start date (Monday):', `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`);
        }
        this.editingId = null;

        console.log('📅 Initial currentWeekStart:', this.currentWeekStart);

        // Update custom role badge styles
        this.updateRoleBadgeStyles();

        // Initialize role filters
        this.filterManager.updateRoleFilters();

        // Initialize modal manager
        this.modalManager = new ModalManager(this);

        // Initialize UI manager
        if (typeof UIManager === 'undefined') {
            throw new Error('UIManager class is not available! Check if uiManager.js is loaded properly.');
        }

        try {
            this.uiManager = new UIManager(this);
        } catch (error) {
            console.error('Error creating UIManager instance:', error);
            throw error;
        }

        // Initialize Import manager
        if (typeof ImportManager === 'undefined') {
            throw new Error('ImportManager class is not available! Check if importManager.js is loaded properly.');
        }

        try {
            console.log('Creating ImportManager instance...');
            this.importManager = new ImportManager(this);
            console.log('ImportManager created successfully:', this.importManager);
        } catch (error) {
            console.error('Error creating ImportManager instance:', error);
            throw error;
        }

        // Initialize Employee manager
        if (typeof EmployeeManager === 'undefined') {
            throw new Error('EmployeeManager class is not available! Check if EmployeeManager.js is loaded properly.');
        }

        try {
            console.log('Creating EmployeeManager instance...');
            this.employeeManager = new EmployeeManager(this);
            console.log('EmployeeManager created successfully:', this.employeeManager);
        } catch (error) {
            console.error('Error creating EmployeeManager instance:', error);
            throw error;
        }

        // Initialize Calendar Renderer
        if (typeof CalendarRenderer === 'undefined') {
            throw new Error('CalendarRenderer class is not available! Check if calendarRenderer.js is loaded properly.');
        }

        try {
            console.log('Creating CalendarRenderer instance...');
            this.calendarRenderer = new CalendarRenderer(this);
            console.log('CalendarRenderer created successfully:', this.calendarRenderer);
        } catch (error) {
            console.error('Error creating CalendarRenderer instance:', error);
            throw error;
        }

        // Initialize View Renderer
        if (typeof ViewRenderer === 'undefined') {
            throw new Error('ViewRenderer class is not available! Check if viewRenderer.js is loaded properly.');
        }

        try {
            console.log('Creating ViewRenderer instance...');
            this.viewRenderer = new ViewRenderer(this);
            console.log('ViewRenderer created successfully:', this.viewRenderer);
        } catch (error) {
            console.error('Error creating ViewRenderer instance:', error);
            throw error;
        }

        // Initialize event listeners AFTER uiManager is set
        this.initializeEventListeners();

        // Ensure calendar view is active by default (since calendar tab starts active)
        // This must be called AFTER uiManager is initialized
        this.switchView('calendar');

        // Set up modal controls now that modalManager is initialized
        this.modalManager.setupModalControls();

        // Add button handlers
        document.getElementById('addUserBtn').addEventListener('click', () => this.modalManager.openEmployeeModal());
        document.getElementById('addShiftBtn').addEventListener('click', () => this.modalManager.openShiftModal());
        document.getElementById('addRoleBtn').addEventListener('click', () => this.modalManager.openRoleModal());

        // Form handlers
        document.getElementById('employeeForm').addEventListener('submit', (e) => this.modalManager.handleEmployeeSubmit(e));
        document.getElementById('shiftForm').addEventListener('submit', (e) => this.modalManager.handleShiftSubmit(e));
        document.getElementById('roleForm').addEventListener('submit', (e) => this.modalManager.handleRoleSubmit(e));
    }

    // Clean up employee data by removing deprecated fields
    cleanEmployeeData() {
        if (this.employees && this.employees.length > 0) {
            this.employees.forEach(employee => {
                // Remove deprecated fields
                delete employee.email;
                delete employee.phone;
                delete employee.hireDate;
                delete employee.status;
            });

            // Save the cleaned data
            this.saveData('employees', this.employees);
            console.log('🧹 Cleaned up employee data - removed email, phone, hireDate, and status fields');
        }
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Navigation tabs
        document.getElementById('calendarTab').addEventListener('click', () => this.switchView('calendar'));
        document.getElementById('balanceTab').addEventListener('click', () => this.switchView('balance'));
        document.getElementById('usersTab').addEventListener('click', () => this.switchView('users'));
        document.getElementById('shiftsTab').addEventListener('click', () => this.switchView('shifts'));
        document.getElementById('rolesTab').addEventListener('click', () => this.switchView('roles'));
        document.getElementById('importTab').addEventListener('click', () => this.switchView('import'));

        document.getElementById('resetDataBtn').addEventListener('click', () => this.resetAllData());
        document.getElementById('scheduleForm').addEventListener('submit', (e) => this.handleScheduleSubmit(e));

        // File import handlers (will be bound after DOM is ready)
        this.bindFileHandlers();

        // Bind drag scroll functionality for calendar
        if (!this.uiManager) {
            console.error('UIManager is not initialized!');
            return;
        }
        this.uiManager.bindDragScroll();

        // Bind staffing issues panel controls
        this.uiManager.bindStaffingPanelControls();

        // Bind calendar filter controls
        this.uiManager.bindCalendarFilters();

        // Bind column toggle controls
        this.filterManager.bindColumnToggles();

        // Bind shift editing functionality
        this.uiManager.bindShiftEditing();
    }

    bindFileHandlers() {
        console.log('Binding file handlers...');

            // XLSX import
        const xlsxInput = document.getElementById('xlsxImportFile');
        if (xlsxInput) {
            console.log('Found XLSX input element');
            xlsxInput.addEventListener('change', (e) => {
                console.log('XLSX file selected:', e.target.files[0]);
                console.log('ImportManager available:', !!this.importManager);
                if (this.importManager && typeof this.importManager.handleXLSXImport === 'function') {
                    console.log('Calling ImportManager.handleXLSXImport');
                    this.importManager.handleXLSXImport(e);
                } else {
                    console.error('ImportManager or handleXLSXImport method not available');
                }
            });
        } else {
            console.error('XLSX input element not found');
        }

        // Time interval selector
        const timeIntervalSelect = document.getElementById('timeInterval');
        if (timeIntervalSelect) {
            // Set initial value from localStorage
            const savedInterval = localStorage.getItem('timeInterval');
            if (savedInterval) {
                timeIntervalSelect.value = savedInterval;
            }

            timeIntervalSelect.addEventListener('change', (event) => {
                const newInterval = parseInt(event.target.value);
                localStorage.setItem('timeInterval', newInterval);
                this.calendarRenderer.renderScheduleMatrix();
            });
        } else {
            console.error('❌ Time interval selector not found');
        }

        // Calendar start date selector
        const startDateInput = document.getElementById('calendarStartDate');
        if (startDateInput) {

            // Set initial value from localStorage
            const savedStartDate = localStorage.getItem('calendarStartDate');
            if (savedStartDate) {
                startDateInput.value = savedStartDate;
            } else {
                // Set to current start date
                startDateInput.value = this.currentWeekStart.toISOString().split('T')[0];
            }

            startDateInput.addEventListener('change', (event) => {
                const newStartDate = event.target.value;
                if (newStartDate) {
                    // Create date at local midnight to avoid timezone issues
                    const [year, month, day] = newStartDate.split('-').map(Number);
                    const localDate = new Date(year, month - 1, day);

                    localStorage.setItem('calendarStartDate', newStartDate);
                    this.currentWeekStart = localDate;
                    this.calendarRenderer.renderScheduleMatrix();
                }
            });
        } else {
            console.error('❌ Calendar start date input not found');
        }

    }


    /**
     * Switch between different application views
     * @param {string} view - The view to switch to ('calendar', 'balance', 'users', 'shifts', 'roles', 'import')
     */
    switchView(view) {
        // Remove active class from all nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

        // Add active class to selected nav tab
        const selectedTab = document.getElementById(`${view}Tab`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }

        // Handle calendar view - CSS in HTML handles visibility through active class on container
        const calendarView = document.getElementById('calendarView');
        const staffingPanel = document.getElementById('staffingIssuesPanel');
        if (view === 'calendar') {
            // Show calendar view by adding active class to container
            if (calendarView) {
                calendarView.classList.add('active');
            }
            // Show staffing panel when on calendar view (but only if it hasn't been manually closed)
            if (staffingPanel && staffingPanel.style.display !== 'none') {
                staffingPanel.style.display = 'block';
            }
        } else {
            // Hide calendar view by removing active class from container
            if (calendarView) {
                calendarView.classList.remove('active');
            }
            // Keep staffing panel visible when not on calendar view (it can be positioned anywhere)
            // Don't hide it automatically - let user control its visibility
        }

        // Handle other views normally
        document.querySelectorAll('.view:not(#calendarView)').forEach(v => v.classList.remove('active'));

        // Add active class to selected view (if not calendar)
        if (view !== 'calendar') {
            const selectedView = document.getElementById(`${view}View`);
            if (selectedView) {
                selectedView.classList.add('active');
            }
        }

        this.renderCurrentView();
    }

    // Render the current view
    renderCurrentView() {
        const activeTab = document.querySelector('.nav-tab.active');
        const view = activeTab.id.replace('Tab', '');

        switch (view) {
            case 'calendar': this.calendarRenderer.renderScheduleMatrix(); break;
            case 'balance': this.viewRenderer.renderBalanceView(); break;
            case 'users': this.employeeManager.renderUsersView(); break;
            case 'shifts': this.viewRenderer.renderShiftsView(); break;
            case 'roles': this.viewRenderer.renderRolesView(); break;
            case 'import': this.importManager.renderImportView(); break;
        }
    }


    // Reset all data
    resetAllData() {
        if (confirm('Are you sure you want to reset ALL data? This will delete all employees, shifts, schedules, and job roles.')) {
            // Clear all data arrays
            this.employees = [];
            this.shiftTypes = [];
            this.jobRoles = [];
            this.schedules = [];

            // Clear localStorage
            localStorage.removeItem('workforce_employees');
            localStorage.removeItem('workforce_shiftTypes');
            localStorage.removeItem('workforce_jobRoles');
            localStorage.removeItem('workforce_schedules');

            // Reset to initial state - Monday of current week
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Monday of current week
            this.currentWeekStart = startDate;

            // Refresh all views
            this.renderCurrentView();

            alert('All data has been reset successfully!');
        }
    }














    deleteShiftType(shiftTypeId) {
        const shiftType = this.shiftTypes.find(s => s.id === shiftTypeId);
        if (!shiftType) return;

        if (confirm(`Are you sure you want to delete the "${shiftType.name}" shift type? This will affect all associated schedules.`)) {
            // Remove shift type
            this.shiftTypes = this.shiftTypes.filter(s => s.id !== shiftTypeId);
            // Remove associated schedules
            this.schedules = this.schedules.filter(s => s.shiftId !== shiftTypeId);

            // Save changes
            this.saveData('shiftTypes', this.shiftTypes);
            this.saveData('schedules', this.schedules);

            // Refresh views
            this.viewRenderer.renderShiftsView();
            this.calendarRenderer.renderScheduleMatrix();
        }
    }

    // Schedule manipulation methods for UI Manager

    // Assign a shift to an employee for a specific date


    // Undo the last shift change
    undoLastChange() {
        if (!this.changeHistory || this.changeHistory.length === 0) {
            alert('No changes to undo.');
            return;
        }

        // Find the most recent non-undone change
        const lastChange = [...this.changeHistory].reverse().find(change => !change.undone);

        if (!lastChange) {
            alert('No changes to undo.');
            return;
        }

        // Mark as undone
        lastChange.undone = true;
        this.saveData('changeHistory', this.changeHistory);

        // Revert the change
        this.employeeManager.assignShiftToEmployee(lastChange.employeeId, lastChange.date, lastChange.oldShiftId);

        console.log(`↶ Undid change: ${lastChange.newShiftId || 'Off'} → ${lastChange.oldShiftId || 'Off'}`);
        alert(`Change undone: Shift reverted to previous state.`);
    }

    // Add a custom shift type

    // Record a shift change for undo functionality
    recordShiftChange(employeeId, date, oldShiftId, newShiftId) {
        if (!this.changeHistory) {
            this.changeHistory = [];
        }

        const changeRecord = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            employeeId,
            date,
            oldShiftId,
            newShiftId,
            undone: false
        };

        this.changeHistory.push(changeRecord);

        // Keep only last 50 changes
        if (this.changeHistory.length > 50) {
            this.changeHistory = this.changeHistory.slice(-50);
        }

        // Save to localStorage
        this.saveData('changeHistory', this.changeHistory);

    }


    // Job Role CRUD functions

    // Update custom role badge styles dynamically
    updateRoleBadgeStyles() {
        // Remove existing custom styles
        const existingStyle = document.getElementById('custom-role-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create new styles for custom role colors
        let customStyles = '';

        this.jobRoles.forEach(role => {
            if (role.color) {
                const colorClass = `custom-role-badge-${role.color.replace('#', '')}`;
                const darkerColor = ScheduleUtils.getDarkerColor(role.color);

                customStyles += `
                    .${colorClass} {
                        background: linear-gradient(135deg, ${role.color} 0%, ${darkerColor} 100%);
                        border: 1px solid ${darkerColor};
                    }
                `;
            }
        });

        if (customStyles) {
            const styleElement = document.createElement('style');
            styleElement.id = 'custom-role-styles';
            styleElement.textContent = customStyles;
            document.head.appendChild(styleElement);
        }
    }



    deleteJobRole(roleId) {
        const role = this.jobRoles.find(r => r.id === roleId);
        if (!role) return;

        const employeeCount = this.employees.filter(e => e.roleId === roleId).length;

        if (confirm(`Are you sure you want to delete the "${role.name}" role? This will affect ${employeeCount} employees.`)) {
            // Remove job role
            this.jobRoles = this.jobRoles.filter(r => r.id !== roleId);
            // Update employees to have no role
            this.employees.forEach(employee => {
                if (employee.roleId === roleId) {
                    employee.roleId = null;
                }
            });

            // Save changes
            this.saveData('jobRoles', this.jobRoles);
            this.saveData('employees', this.employees);

            // Update role filters to remove the deleted role
            this.filterManager.updateRoleFilters();

            // Refresh views
            this.viewRenderer.renderRolesView();
            this.employeeManager.renderUsersView();
            this.calendarRenderer.renderScheduleMatrix();
        }
    }








    /**
     * Generate a unique identifier using timestamp and random string
     * @returns {string} Unique ID in base36 format
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Load data from localStorage
     * @param {string} key - The key to load data for
     * @returns {*} The parsed data or null if not found
     */
    loadData(key) {
        const saved = localStorage.getItem(`workforce_${key}`);
        console.log(`Loading ${key} from localStorage:`, saved ? 'Found' : 'Not found');
        const parsed = saved ? JSON.parse(saved) : null;
        console.log(`Parsed ${key}:`, parsed);
        return parsed;
    }

    /**
     * Save data to localStorage
     * @param {string} key - The key to save data under
     * @param {*} data - The data to save (will be JSON stringified)
     */
    saveData(key, data) {
        console.log(`Saving ${key} to localStorage:`, data);
        localStorage.setItem(`workforce_${key}`, JSON.stringify(data));
        console.log(`Saved ${key}, verifying:`, this.loadData(key));
    }

    // Export functions
    exportData(type) {
        let data, filename;

        switch (type) {
            case 'employees':
                data = this.employees;
                filename = 'employees.csv';
                break;
            case 'shifts':
                data = this.shiftTypes;
                filename = 'shifts.csv';
                break;
            case 'schedules':
                data = this.schedules;
                filename = 'schedules.csv';
                break;
        }

        if (data && data.length > 0) {
            const csv = DataProcessor.convertToCSV(data);
            DataProcessor.downloadCSV(csv, filename);
        }
    }
}

// Initialize the application when DOM is loaded
let workforceManager;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Workforce Schedule Manager...');

    workforceManager = new WorkforceScheduleManager();

    // Make workforceManager globally available for HTML event handlers
    window.workforceManager = workforceManager;

    // Bind file handlers after DOM is fully loaded
    setTimeout(() => {
        workforceManager.bindFileHandlers();
    }, 100);
});
