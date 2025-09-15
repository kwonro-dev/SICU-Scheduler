// Workforce Schedule Manager Application
class WorkforceScheduleManager {
    constructor() {
        console.log('🚀 WorkforceScheduleManager constructor called');

        this.employees = this.loadData('employees') || [];
        this.shiftTypes = this.loadData('shiftTypes') || [];
        this.jobRoles = this.loadData('jobRoles') || [];
        this.schedules = this.loadData('schedules') || [];

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

        console.log('Loaded data:');
        console.log('- Employees:', this.employees.length);
        console.log('- Shift Types:', this.shiftTypes.length);
        console.log('- Job Roles:', this.jobRoles.length);
        console.log('- Schedules:', this.schedules.length);

        // Commented out automatic sample data loading - only load when button is pressed
        // if (this.employees.length === 0 && this.shiftTypes.length === 0) {
        //     console.log('No data found, creating sample data...');
        //     this.createSampleData();
        // }

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

    // Initialize all event listeners
    initializeEventListeners() {
        // Navigation tabs
        document.getElementById('calendarTab').addEventListener('click', () => this.switchView('calendar'));
        document.getElementById('balanceTab').addEventListener('click', () => this.switchView('balance'));
        document.getElementById('usersTab').addEventListener('click', () => this.switchView('users'));
        document.getElementById('shiftsTab').addEventListener('click', () => this.switchView('shifts'));
        document.getElementById('rolesTab').addEventListener('click', () => this.switchView('roles'));
        document.getElementById('importTab').addEventListener('click', () => this.switchView('import'));

        // Navigation buttons removed - using date picker instead
        document.getElementById('resetDataBtn').addEventListener('click', () => this.resetAllData());

        // Add buttons (modal manager will be initialized later)
        // Button handlers will be set up after modalManager initialization

        // Forms (modal manager will be initialized later)
        // Modal controls and form handlers will be set up after modalManager initialization
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
                this.handleXLSXImport(e);
            });
        } else {
            console.error('XLSX input element not found');
        }

        console.log('File handlers bound, XLSX input found:', !!xlsxInput);


        // Time interval selector
        const timeIntervalSelect = document.getElementById('timeInterval');
        if (timeIntervalSelect) {
            console.log('✅ Found time interval selector');
            console.log('Current options:', Array.from(timeIntervalSelect.options).map(opt => opt.value));

            // Set initial value from localStorage
            const savedInterval = localStorage.getItem('timeInterval');
            if (savedInterval) {
                timeIntervalSelect.value = savedInterval;
                console.log('📝 Set time interval selector to saved value:', savedInterval);
            } else {
                console.log('📝 No saved interval, using default');
            }

            timeIntervalSelect.addEventListener('change', (event) => {
                const newInterval = parseInt(event.target.value);
                console.log('🔄 Time interval selector changed to:', newInterval, 'days');
                localStorage.setItem('timeInterval', newInterval);
                console.log('💾 Saved to localStorage');
                this.renderScheduleMatrix();
                console.log('🔄 Calendar re-rendered with new interval');
            });
            console.log('✅ Time interval selector event listener attached');
        } else {
            console.error('❌ Time interval selector not found');
        }

        // Calendar start date selector
        const startDateInput = document.getElementById('calendarStartDate');
        if (startDateInput) {
            console.log('✅ Found calendar start date input');

            // Set initial value from localStorage
            const savedStartDate = localStorage.getItem('calendarStartDate');
            if (savedStartDate) {
                startDateInput.value = savedStartDate;
                console.log('📅 Set start date input to saved value:', savedStartDate);
            } else {
                // Set to current start date
                startDateInput.value = this.currentWeekStart.toISOString().split('T')[0];
                console.log('📅 Set start date input to current start date');
            }

            startDateInput.addEventListener('change', (event) => {
                const newStartDate = event.target.value;
                if (newStartDate) {
                    console.log('📅 Start date changed to:', newStartDate);
                    // Create date at local midnight to avoid timezone issues
                    const [year, month, day] = newStartDate.split('-').map(Number);
                    const localDate = new Date(year, month - 1, day);
                    console.log('📅 Local date object:', localDate.toISOString().split('T')[0]);

                    localStorage.setItem('calendarStartDate', newStartDate);
                    this.currentWeekStart = localDate;
                    console.log('💾 Saved start date to localStorage');
                    this.renderScheduleMatrix();
                    console.log('🔄 Calendar re-rendered with new start date');
                }
            });
            console.log('✅ Calendar start date event listener attached');
        } else {
            console.error('❌ Calendar start date input not found');
        }

    }


    // Switch between views
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
            case 'calendar': this.renderScheduleMatrix(); break;
            case 'balance': this.renderBalanceView(); break;
            case 'users': this.renderUsersView(); break;
            case 'shifts': this.renderShiftsView(); break;
            case 'roles': this.renderRolesView(); break;
            case 'import': this.renderImportView(); break;
        }
    }

    // Render import view
    renderImportView() {
        const importContent = document.getElementById('importContent');
        if (!importContent) return;

        // The import view HTML is already in the page, so we just need to make sure it's visible
        // The view switching will handle showing/hiding the correct view
    }

    // Render balance view with some content
    renderBalanceView() {
        const balanceContent = document.getElementById('balanceContent');
        if (!balanceContent) return;

        let html = '<div class="balance-stats">';

        // Calculate some basic stats
        const totalEmployees = this.employees.length;
        const totalShifts = this.shiftTypes.length;
        const totalSchedules = this.schedules.length;

        if (totalEmployees === 0) {
            html += `
                <div class="empty-state">
                    <i class="fas fa-balance-scale"></i>
                    <h3>No Data Available</h3>
                    <p>Import employee and schedule data to see balance analysis.</p>
                </div>
            `;
        } else {
            html += `
                <div class="stat-card">
                    <h3>Total Employees</h3>
                    <div class="stat-value">${totalEmployees}</div>
                    <div class="stat-change">Active workforce</div>
                </div>
                <div class="stat-card">
                    <h3>Shift Types</h3>
                    <div class="stat-value">${totalShifts}</div>
                    <div class="stat-change">Available shifts</div>
                </div>
                <div class="stat-card">
                    <h3>Schedule Entries</h3>
                    <div class="stat-value">${totalSchedules}</div>
                    <div class="stat-change">Total assignments</div>
                </div>
            `;

            // Add some basic balance analysis
            html += `
                <div class="balance-analysis">
                    <h4>Schedule Balance Overview</h4>
                    <p>Your schedule appears to be well-balanced with ${totalEmployees} employees across ${totalShifts} shift types.</p>
                    <div class="analysis-tips">
                        <h5>Tips for Optimal Scheduling:</h5>
                        <ul>
                            <li>Ensure fair distribution of weekend shifts</li>
                            <li>Avoid consecutive night shifts when possible</li>
                            <li>Balance morning and afternoon shifts</li>
                            <li>Consider employee preferences and availability</li>
                        </ul>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        balanceContent.innerHTML = html;
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


    // Analyze staffing levels and return issues
    analyzeStaffingIssues() {
        console.log('=== ANALYZING STAFFING ISSUES ===');

        const issues = [];
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 48;
        const calendarStartDate = new Date(this.currentWeekStart.getFullYear(), this.currentWeekStart.getMonth(), this.currentWeekStart.getDate());

        // Create a schedule lookup map for quick access
        const scheduleMap = new Map();
        this.schedules.forEach(schedule => {
            const key = `${schedule.employeeId}_${schedule.date}`;
            scheduleMap.set(key, schedule);
        });

        // Define optimal staffing levels (you can adjust these based on your needs)
        const optimalStaffing = {
            'morning': 2,    // 2 staff for morning shift
            'afternoon': 2,  // 2 staff for afternoon shift
            'night': 1,      // 1 staff for night shift
            'off': 0         // Off days don't count as staffed
        };

        // Analyze each date
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            // Count staff by shift type for this date
            const shiftCounts = {};
            let totalStaff = 0;

            this.employees.forEach(employee => {
                const scheduleKey = `${employee.id}_${dateString}`;
                const schedule = scheduleMap.get(scheduleKey);

                if (schedule) {
                    const shiftId = schedule.shiftId;
                    if (!shiftCounts[shiftId]) {
                        shiftCounts[shiftId] = 0;
                    }
                    shiftCounts[shiftId]++;
                    totalStaff++;
                }
            });

            // Check for staffing issues
            const issuesForDate = [];

            // Check each shift type
            Object.entries(shiftCounts).forEach(([shiftId, count]) => {
                const optimal = optimalStaffing[shiftId] || 0;
                if (optimal > 0) {
                    if (count < optimal) {
                        issuesForDate.push({
                            type: 'under-staffed',
                            shift: shiftId,
                            current: count,
                            optimal: optimal,
                            difference: optimal - count
                        });
                    } else if (count > optimal) {
                        issuesForDate.push({
                            type: 'over-staffed',
                            shift: shiftId,
                            current: count,
                            optimal: optimal,
                            difference: count - optimal
                        });
                    }
                }
            });

            // If we have issues for this date, add them to the main issues array
            if (issuesForDate.length > 0) {
                issues.push({
                    date: dateString,
                    dateObj: date,
                    issues: issuesForDate,
                    totalStaff: totalStaff
                });
            }
        }

        // Sort issues by date
        issues.sort((a, b) => new Date(a.date) - new Date(b.date));

        console.log('Staffing analysis complete:', issues.length, 'days with issues');
        return issues;
    }

    // Update the staffing issues panel
    updateStaffingIssuesPanel() {
        console.log('=== UPDATING STAFFING ISSUES PANEL ===');

        const panel = document.getElementById('staffingIssuesPanel');
        const issuesList = document.getElementById('issuesList');
        const noIssues = document.getElementById('noIssues');

        if (!panel || !issuesList || !noIssues) {
            console.error('Staffing issues panel elements not found');
            return;
        }

        const issues = this.analyzeStaffingIssues();

        if (issues.length === 0) {
            // Show "no issues" message
            issuesList.innerHTML = '';
            noIssues.style.display = 'block';
            panel.classList.remove('has-issues');
        } else {
            // Show issues
            noIssues.style.display = 'none';

            const issuesHTML = issues.map(issue => {
                const dateFormatted = issue.dateObj.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                });

                const issueDetails = issue.issues.map(issueDetail => {
                    const shiftName = this.shiftTypes.find(s => s.id === issueDetail.shift)?.name || issueDetail.shift;
                    const issueType = issueDetail.type === 'under-staffed' ? 'Under-staffed' : 'Over-staffed';
                    const icon = issueDetail.type === 'under-staffed' ? 'fas fa-user-minus' : 'fas fa-user-plus';

                    return `
                        <div class="issue-item ${issueDetail.type}">
                            <div class="issue-date">
                                <i class="${icon}"></i>
                                ${dateFormatted} - ${shiftName}
                            </div>
                            <div class="issue-details">
                                <strong>${issueType}:</strong> ${issueDetail.current} staff assigned
                                (optimal: ${issueDetail.optimal})
                                ${Math.abs(issueDetail.difference) > 1 ?
                                    ` - ${Math.abs(issueDetail.difference)} ${issueDetail.type === 'under-staffed' ? 'short' : 'extra'}` :
                                    ` - ${Math.abs(issueDetail.difference)} ${issueDetail.type === 'under-staffed' ? 'short' : 'extra'}`
                                }
                            </div>
                        </div>
                    `;
                }).join('');

                return issueDetails;
            }).join('');

            issuesList.innerHTML = issuesHTML;
            panel.classList.add('has-issues');

            // If panel is collapsed and has issues, it will show the indicator
            console.log('Panel has issues - indicator will show when collapsed');
        }

        // Show the panel if we're on the calendar view (but keep it collapsed by default)
        const calendarView = document.getElementById('calendarView');
        if (calendarView && calendarView.classList.contains('active')) {
            panel.style.display = 'block';
            // Ensure it starts collapsed
            if (!panel.classList.contains('collapsed')) {
                panel.classList.add('collapsed');
                const icon = document.querySelector('#togglePanel i');
                if (icon) {
                    icon.className = 'fas fa-chevron-up';
                }
            }
        }
    }

    // Render the schedule matrix (calendar view)
    renderScheduleMatrix() {
        console.log('=== RENDERING CALENDAR MATRIX ===');

        const matrixContainer = document.getElementById('scheduleMatrix');

        console.log('Current data state:');
        console.log('- Employees:', this.employees.length, this.employees);
        console.log('- Shift Types:', this.shiftTypes.length, this.shiftTypes);
        console.log('- Job Roles:', this.jobRoles.length, this.jobRoles);
        console.log('- Schedules:', this.schedules.length, this.schedules);

        if (!matrixContainer) {
            console.error('Schedule matrix element not found');
            return;
        }

        // Get time interval from localStorage or use 48 as default
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 48;
        console.log('📅 Using time interval:', timeInterval, 'days');

        // Use the configured start date (from localStorage or default)
        // Create a new date object to avoid reference issues
        const calendarStartDate = new Date(this.currentWeekStart.getFullYear(), this.currentWeekStart.getMonth(), this.currentWeekStart.getDate());
        console.log('📅 Calendar start date:', `${calendarStartDate.getFullYear()}-${String(calendarStartDate.getMonth() + 1).padStart(2, '0')}-${String(calendarStartDate.getDate()).padStart(2, '0')}`);

        // Date range display removed - using date picker instead

        // Generate dates starting from the selected start date (same as sample data)
        const weekDates = [];
        console.log('Generating', timeInterval, 'dates starting from:', `${calendarStartDate.getFullYear()}-${String(calendarStartDate.getMonth() + 1).padStart(2, '0')}-${String(calendarStartDate.getDate()).padStart(2, '0')}`);
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            weekDates.push(date);
        }

        // Create schedule lookup map for quick access
        const scheduleMap = new Map();
        this.schedules.forEach(schedule => {
            const key = `${schedule.employeeId}_${schedule.date}`;
            scheduleMap.set(key, schedule);
        });
        console.log('Schedule map created with', scheduleMap.size, 'entries');

        // Create matrix HTML - EMPLOYEES AS ROWS, DATES AS COLUMNS
        console.log('=== GENERATING CALENDAR MATRIX ===');
        console.log('Structure: Employees = Rows, Dates = Columns');

        // Generate header row with date columns
        let matrixHTML = `
            <div class="matrix-cell header-cell" style="background: #f8fafc !important; border-bottom: 2px solid #e2e8f0 !important;">Employee Name</div>
            <div class="matrix-cell header-cell" style="background: #f8fafc !important; border-bottom: 2px solid #e2e8f0 !important;">Job Type</div>
            ${weekDates.map((date, index) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const headerStyle = index === 0 ? 'background: #f8fafc !important; border-bottom: 2px solid #e2e8f0 !important;' : '';
                console.log(`Header ${index} style: ${headerStyle}`);
                return `<div class="matrix-cell header-cell date-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}" style="${headerStyle}">
                    ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>`;
            }).join('')}
            <div class="matrix-cell header-cell count-header count-header-fri" style="background: #f0fdf4 !important; border-bottom: 2px solid #22c55e !important;">Fri</div>
            <div class="matrix-cell header-cell count-header count-header-sat" style="background: #fef7ff !important; border-bottom: 2px solid #a855f7 !important;">Sat</div>
            <div class="matrix-cell header-cell count-header count-header-sun" style="background: #fff7ed !important; border-bottom: 2px solid #f97316 !important;">Sun</div>
            <div class="matrix-cell header-cell count-header count-header-vac" style="background: #fef3c7 !important; border-bottom: 2px solid #f59e0b !important;">Vac</div>
            <div class="matrix-cell header-cell count-header count-header-req" style="background: #dbeafe !important; border-bottom: 2px solid #3b82f6 !important;">Req</div>
        `;

        console.log('Header generated with', weekDates.length + 7, 'columns');

        // Add employee rows (each employee gets their own row with all date columns)
        console.log('=== GENERATING EMPLOYEE ROWS ===');

        // Filter employees based on current filter settings
        const filteredEmployees = this.employees.filter(employee => this.filterManager.shouldShowEmployee(employee));
        console.log('Filtered employees to display:', filteredEmployees.length, 'out of', this.employees.length);

        filteredEmployees.forEach((employee, empIndex) => {
            const role = this.jobRoles.find(r => r.id === employee.roleId);
            const roleName = role ? role.name : 'No Role';
            const shiftType = employee.shiftType || this.determineEmployeeShiftType(employee);
            const shiftBadgeClass = shiftType === 'Night' ? 'night-shift-badge' : 'day-shift-badge';
            const roleBadgeClass = this.getRoleBadgeClass(roleName);
            console.log(`Employee ${empIndex + 1}: ${employee.name} (${roleName}) - ${shiftType}`);

            // Calculate counts for this employee
            let friCount = 0;
            let satCount = 0;
            let sunCount = 0;
            let vacCount = 0;
            let reqCount = 0;

            weekDates.forEach((date) => {
                const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const scheduleKey = `${employee.id}_${dateString}`;
                const schedule = scheduleMap.get(scheduleKey);

                if (schedule) {
                    const shiftType = this.shiftTypes.find(s => s.id === schedule.shiftId);
                    const shiftName = shiftType ? shiftType.name : schedule.shiftType || '';

                    // Count shifts for Friday, Saturday, Sunday that do NOT contain "R" or "C "
                    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
                    const isWeekendDay = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0; // Friday, Saturday, Sunday
                    const isNotRorC = !shiftName.includes('R') && !shiftName.includes('C ');
                    
                    if (isWeekendDay && isNotRorC && shiftName && shiftName !== 'Off') {
                        if (dayOfWeek === 5) { // Friday
                            friCount++;
                        } else if (dayOfWeek === 6) { // Saturday
                            satCount++;
                        } else if (dayOfWeek === 0) { // Sunday
                            sunCount++;
                        }
                    }

                    // Count shifts containing "C " (with space) for Vac
                    if (shiftName.includes('C ')) {
                        vacCount++;
                    }
                    // Count shifts containing "R12" or "R 12" for Req
                    if (shiftName.includes('R12') || shiftName.includes('R 12')) {
                        reqCount++;
                    }
                }
            });

            // Employee name cell
            matrixHTML += `<div class="matrix-cell employee-name">${employee.name}</div>`;

            // Job role cell with badges
            matrixHTML += `<div class="matrix-cell job-role">
                <span class="role-badge ${roleBadgeClass}">${roleName}</span>
                <span class="shift-type-badge ${shiftBadgeClass}">${shiftType}</span>
            </div>`;

            // Add shift cells for each date
            weekDates.forEach((date, i) => {
                const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const scheduleKey = `${employee.id}_${dateString}`;
                const schedule = scheduleMap.get(scheduleKey);

                const isToday = date.toDateString() === new Date().toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                let shiftName = '';
                let shiftColor = '#f3f4f6';

                if (schedule) {
                    const shiftType = this.shiftTypes.find(s => s.id === schedule.shiftId);
                    if (shiftType) {
                        shiftName = shiftType.name;
                        shiftColor = shiftType.color || '#3b82f6';
                    } else {
                        shiftName = schedule.shiftType || 'Unknown';
                        shiftColor = '#ff6b6b';
                    }
                }

                // Debug first column colors
                if (i === 0 && empIndex < 3) {
                    console.log(`First column debug - Employee ${empIndex}, Day ${i}: shift="${shiftName}", color="${shiftColor}"`);
                }

                const isOffShift = shiftName === 'Off' || shiftName === '';
                const shiftCellId = `shift-${employee.id}-${dateString}`;
                matrixHTML += `<div id="${shiftCellId}" class="matrix-cell shift-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isOffShift ? 'off-shift' : ''}" style="background-color: ${shiftColor} !important;" data-employee-id="${employee.id}" data-date="${dateString}" data-shift-id="${schedule ? schedule.shiftId : ''}">
                    ${shiftName}
                </div>`;
            });

            // Add count cells for this employee
            matrixHTML += `<div class="matrix-cell count-cell count-cell-fri" style="background: #f0fdf4 !important;">${friCount}</div>`;
            matrixHTML += `<div class="matrix-cell count-cell count-cell-sat" style="background: #fef7ff !important;">${satCount}</div>`;
            matrixHTML += `<div class="matrix-cell count-cell count-cell-sun" style="background: #fff7ed !important;">${sunCount}</div>`;
            matrixHTML += `<div class="matrix-cell count-cell count-cell-vac" style="background: #fef3c7 !important;">${vacCount}</div>`;
            matrixHTML += `<div class="matrix-cell count-cell count-cell-req" style="background: #dbeafe !important;">${reqCount}</div>`;
        });

        // Add empty state if no employees
        if (this.employees.length === 0) {
            matrixHTML += `
                <div class="matrix-cell empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px; border: none;">
                    <i class="fas fa-users" style="font-size: 48px; color: #cbd5e0; margin-bottom: 16px;"></i>
                    <h3 style="color: #718096; margin: 0; font-size: 18px; font-weight: 500;">No Employees Found</h3>
                </div>
            `;
        }

        matrixContainer.innerHTML = matrixHTML;

        // Update CSS grid template to match the actual number of columns
        const baseColumns = 2; // Employee name + Job type
        const dateColumns = timeInterval; // Date columns
        const countColumns = this.filterManager.getVisibleCountColumns(); // Count columns based on visibility
        const totalColumns = baseColumns + dateColumns + countColumns;
        
        // Build grid template dynamically based on visible columns
        let gridTemplate = `130px 120px repeat(${timeInterval}, 50px)`; // Base columns + date columns
        
        // Add count column widths based on visibility
        if (this.filterManager.isColumnVisible('weekend')) {
            gridTemplate += ' 40px 40px 40px'; // Fri, Sat, Sun
        }
        if (this.filterManager.isColumnVisible('vacation')) {
            gridTemplate += ' 40px'; // Vac
        }
        if (this.filterManager.isColumnVisible('required')) {
            gridTemplate += ' 40px'; // Req
        }
        
        matrixContainer.style.gridTemplateColumns = gridTemplate;
        matrixContainer.style.width = 'max-content'; // Ensure container can expand
        matrixContainer.style.minWidth = '100%'; // Ensure at least container width
        console.log('🎨 Updated CSS grid template to:', gridTemplate);
        console.log('📏 Grid will have', totalColumns, 'columns (base:', baseColumns, 'dates:', dateColumns, 'count:', countColumns, ')');

        console.log('Calendar rendered successfully with', this.employees.length, 'employees and', weekDates.length, 'days');

        // Render the worker count summary below the calendar
        this.renderWorkerCountSummary();

        // Bind drag scroll functionality after rendering
        setTimeout(() => this.uiManager.bindDragScroll(), 100);

        // Update staffing issues panel
        this.updateStaffingIssuesPanel();

        // Update column visibility based on toggle states
        this.filterManager.updateColumnVisibility();

        // Bind right-click events to shift cells for editing
        this.uiManager.bindShiftCellEvents();
    }




    // Render users management view
    renderUsersView() {
        const usersContent = document.getElementById('usersContent');
        if (!usersContent) return;

        let html = '<div class="data-list">';

        if (this.employees.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>No Employees</h3>
                    <p>Import employee data or add new employees manually.</p>
                </div>
            `;
        } else {
            html += '<h4>Imported Employees</h4>';
            this.employees.forEach(employee => {
                const role = this.jobRoles.find(r => r.id === employee.roleId);
                const roleName = role ? role.name : 'No Role';
                const shiftType = employee.shiftType || this.determineEmployeeShiftType(employee);
                const shiftBadgeClass = shiftType === 'Night' ? 'night-shift-badge' : 'day-shift-badge';
                const roleBadgeClass = this.getRoleBadgeClass(roleName);

                html += `
                    <div class="data-item">
                        <div class="data-info">
                            <strong>${employee.name}</strong>
                            <span class="data-meta">${employee.email}</span>
                            <div class="badge-container">
                                <span class="role-badge ${roleBadgeClass}">${roleName}</span>
                                <span class="shift-type-badge ${shiftBadgeClass}">${shiftType}</span>
                            </div>
                        </div>
                        <div class="data-actions">
                            <button class="btn btn-sm btn-secondary" onclick="workforceManager?.modalManager?.editEmployee('${employee.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="workforceManager.deleteEmployee('${employee.id}')">
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

    // Render shifts management view
    renderShiftsView() {
        const shiftsContent = document.getElementById('shiftsContent');
        if (!shiftsContent) return;

        let html = '<div class="data-list">';

        if (this.shiftTypes.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="fas fa-clock"></i>
                    <h3>No Shift Types</h3>
                    <p>Import shift data or add new shift types manually.</p>
                </div>
            `;
        } else {
            html += '<h4>Imported Shift Types</h4>';
            this.shiftTypes.forEach(shiftType => {
                const shiftColor = shiftType.color || '#3b82f6'; // Default to blue if no color set
                const darkerColor = ScheduleUtils.getDarkerColor(shiftColor);

                html += `
                    <div class="data-item">
                        <div class="data-info">
                            <div class="shift-header">
                                <strong>${shiftType.name}</strong>
                                <span class="shift-color-swatch" title="Shift Color: ${shiftColor.toUpperCase()}" style="background: linear-gradient(135deg, ${shiftColor} 0%, ${darkerColor} 100%); border-color: ${darkerColor};"></span>
                            </div>
                            <span class="data-meta">${shiftType.startTime || 'Not set'} - ${shiftType.endTime || 'Not set'}</span>
                            <span class="data-meta">${shiftType.description || 'No description'}</span>
                        </div>
                        <div class="data-actions">
                            <button class="btn btn-sm btn-secondary" onclick="workforceManager?.modalManager?.editShiftType('${shiftType.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="workforceManager.deleteShiftType('${shiftType.id}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        shiftsContent.innerHTML = html;
    }

    // Render roles management view
    renderRolesView() {
        const rolesContent = document.getElementById('rolesContent');
        if (!rolesContent) return;

        let html = '<div class="data-list">';

        if (this.jobRoles.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="fas fa-user-tag"></i>
                    <h3>No Job Roles</h3>
                    <p>Import job role data or add new roles manually.</p>
                </div>
            `;
        } else {
            html += '<h4>Imported Job Roles</h4>';
            this.jobRoles.forEach(role => {
                const employeeCount = this.employees.filter(e => e.roleId === role.id).length;
                const roleColor = role.color || '#3b82f6'; // Default to blue if no color set
                // Color class not needed since we're using inline styles

                html += `
                    <div class="data-item">
                        <div class="data-info">
                            <div class="role-header">
                                <strong>${role.name}</strong>
                                <span class="role-color-swatch" title="Role Color: ${roleColor.toUpperCase()}" style="background: linear-gradient(135deg, ${roleColor} 0%, ${ScheduleUtils.getDarkerColor(roleColor)} 100%); border-color: ${ScheduleUtils.getDarkerColor(roleColor)};"></span>
                            </div>
                            <span class="data-meta">${role.description || 'No description'}</span>
                            <span class="data-meta">${employeeCount} employees</span>
                        </div>
                        <div class="data-actions">
                            <button class="btn btn-sm btn-secondary" onclick="workforceManager?.modalManager?.editJobRole('${role.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="workforceManager.deleteJobRole('${role.id}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        rolesContent.innerHTML = html;
    }

    // Navigate to previous/next time period - COMMENTED OUT (using date picker instead)
    /*
    navigateWeek(direction) {
        console.log('🔄 NAVIGATE WEEK CALLED:', direction);
        console.log('Current start date before navigation:', this.currentWeekStart);

        // Get current time interval
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 48;
        console.log('Current time interval:', timeInterval);

        // Calculate new start date by navigating by the time interval
        const newStartDate = new Date(this.currentWeekStart);
        newStartDate.setDate(this.currentWeekStart.getDate() + (direction * timeInterval));

        // Update both the instance variable and localStorage
        this.currentWeekStart = newStartDate;
        localStorage.setItem('calendarStartDate', newStartDate.toISOString().split('T')[0]);

        console.log('✅ New start date calculated and saved:', this.currentWeekStart);

        // Re-render the calendar
        console.log('🔄 Re-rendering calendar...');
        this.renderScheduleMatrix();
        console.log('✅ Navigation complete');
    }
    */



    // XLSX Import Function
    async handleXLSXImport(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const progressDiv = document.getElementById('xlsxProgress');
        const progressFill = document.getElementById('xlsxProgressFill');
        const progressText = document.getElementById('xlsxProgressText');

        progressDiv.style.display = 'block';
        progressText.textContent = 'Loading XLSX file...';
        progressFill.style.width = '20%';

        try {
            // Read the file as ArrayBuffer for XLSX processing
            const arrayBuffer = await DataProcessor.readFileAsArrayBuffer(file);

            progressText.textContent = 'Parsing XLSX data...';
            progressFill.style.width = '40%';

            // Check if XLSX library is available
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library not loaded. Please check if the SheetJS library is properly included.');
            }

            // Parse XLSX using SheetJS
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            // Get the first worksheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to CSV format
            const csvData = XLSX.utils.sheet_to_csv(worksheet);

            progressText.textContent = 'Converting to CSV format...';
            progressFill.style.width = '60%';

            // Store the raw CSV data for debugging display
            this.rawCsvData = csvData;
            this.xlsxFileName = file.name;

            progressText.textContent = 'Conversion complete!';
            progressFill.style.width = '100%';

            // Show CSV preview
            setTimeout(() => {
                progressDiv.style.display = 'none';
                this.showCsvPreview(csvData, file.name);
            }, 500);

        } catch (error) {
            console.error('XLSX import error:', error);
            progressText.textContent = 'Import failed: ' + error.message;
            progressFill.style.backgroundColor = '#ef4444';
            setTimeout(() => {
                progressDiv.style.display = 'none';
                document.getElementById('dataPreview').innerHTML = '<p style="color: red;">Import failed. Please check your file format.</p>';
            }, 2000);
        }
    }

    // Show CSV preview before import
    showCsvPreview(csvData, fileName) {
        const dataPreview = document.getElementById('dataPreview');

        if (!dataPreview) {
            console.error('dataPreview element not found!');
            return;
        }

        // First clean content within quotes, then save 8th row, remove first 8 rows, then remove blank columns
        const lines = csvData.trim().split('\n');

        // First clean content within quotes on the entire data (including headers)
        const fullCsvWithCleanedContent = this.cleanCsvNewlines(csvData);

        // Now split the cleaned data and save the 8th row as metadata
        const cleanedLines = fullCsvWithCleanedContent.trim().split('\n');
        let rawMetadataRow = cleanedLines[7] || '';

        // Process the 8th row: remove blank entries and add two blank placeholders at the front
        this.xlsxMetadataRow = this.processMetadataRow(rawMetadataRow);

        // Remove first 8 header rows from the cleaned data
        const dataLines = cleanedLines.slice(8); // Remove first 8 header rows
        const csvWithoutHeaders = dataLines.join('\n');

        // Now remove columns that have all blank data from the remaining data (not entire file)
        const fullyCleanedCsv = this.removeColumnsWithAllBlankData(csvWithoutHeaders);

        // Get statistics for display
        const originalLines = csvData.trim().split('\n');
        const fullCleanedLines = fullCsvWithCleanedContent.trim().split('\n');

        // Split cleaned CSV into lines for display
        const allLines = fullyCleanedCsv.trim().split('\n');

        // Get column count from data after headers removed vs final cleaned data
        const afterHeadersColumns = dataLines.length > 0 ? DataProcessor.parseCsvRow(dataLines[0]).length : 0;
        const finalColumns = allLines.length > 0 ? DataProcessor.parseCsvRow(allLines[0]).length : 0;
        const totalLines = allLines.length;
        const originalChars = csvData.length;
        const cleanedChars = fullyCleanedCsv.length;

        const contentCleaned = (originalChars !== fullCsvWithCleanedContent.length);
        const columnsRemoved = afterHeadersColumns - finalColumns;
        const headersRemoved = 8; // Always removing first 8 rows now

        // Headers have already been removed, so allLines contains only data rows
        const processedLines = allLines.length;

        // Store the cleaned CSV data for import processing
        this.cleanedCsvData = fullyCleanedCsv;

        // Create preview with saved 8th row as first line, then first 9 data lines and last 5 data lines
        let previewContent = '';
        const maxPreviewLines = 15;

        // Add the saved 8th row (metadata) as the first line if it exists
        if (this.xlsxMetadataRow && this.xlsxMetadataRow.trim()) {
            previewContent = this.xlsxMetadataRow + '\n';
            const remainingPreviewLines = maxPreviewLines - 1;

            if (allLines.length <= remainingPreviewLines) {
                previewContent += allLines.join('\n');
            } else {
                const firstLines = allLines.slice(0, remainingPreviewLines - 1);
                const lastLines = allLines.slice(-5);
                previewContent += firstLines.join('\n') + '\n...\n' + lastLines.join('\n');
            }
        } else {
            // No metadata row, show regular preview
            if (allLines.length <= maxPreviewLines) {
                previewContent = allLines.join('\n');
            } else {
                const firstLines = allLines.slice(0, 10);
                const lastLines = allLines.slice(-5);
                previewContent = firstLines.join('\n') + '\n...\n' + lastLines.join('\n');
            }
        }

        const htmlContent = `
            <div class="csv-preview-container">
                <div class="csv-preview-header">
                    <h4>CSV Preview</h4>
                    <div class="csv-file-info">
                        <strong>File:</strong> ${fileName}<br>
                        <strong>Original Lines:</strong> ${originalLines.length}<br>
                        <strong>Data Lines (after removing ${headersRemoved} headers):</strong> ${processedLines}<br>
                        <strong>Columns (after headers/final):</strong> ${afterHeadersColumns} / ${finalColumns}<br>
                        <strong>Characters (original/cleaned):</strong> ${originalChars.toLocaleString()} / ${cleanedChars.toLocaleString()}<br>
                    </div>
                </div>

                <div class="csv-content-preview">
                    <h5>Data Preview:</h5>
                    <pre class="csv-text">${ScheduleUtils.escapeHtml(previewContent)}</pre>
                </div>

                <div class="csv-preview-actions">
                    <div class="csv-action-buttons">
                        <button class="btn btn-secondary" id="cancelCsvPreview">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                        <button class="btn btn-primary" id="continueImport">
                            <i class="fas fa-arrow-right"></i> Continue Import
                        </button>
                    </div>
                </div>
            </div>
        `;

        dataPreview.innerHTML = htmlContent;

        // Add event listeners for the buttons
        setTimeout(() => {
            const cancelBtn = document.getElementById('cancelCsvPreview');
            const continueBtn = document.getElementById('continueImport');

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    dataPreview.innerHTML = '<p>Import cancelled. Upload another file to try again.</p>';
                    // Clear the stored data
                    this.rawCsvData = null;
                    this.cleanedCsvData = null;
                    this.xlsxFileName = null;
                    this.xlsxMetadataRow = null;
                });
            }

            if (continueBtn) {
                continueBtn.addEventListener('click', () => {
                    this.processCsvImport();
                });
            }
        }, 100);
    }

    // Process the CSV import after user confirms
    processCsvImport() {
        if (!this.rawCsvData) {
            alert('No CSV data available. Please upload a file first.');
            return;
        }

        const progressDiv = document.getElementById('xlsxProgress');
        const progressFill = document.getElementById('xlsxProgressFill');
        const progressText = document.getElementById('xlsxProgressText');

        progressDiv.style.display = 'block';
        progressText.textContent = 'Processing CSV data...';
        progressFill.style.width = '20%';

        try {
            // Use the cleaned CSV data (content and empty cells already cleaned)
            let csvDataToProcess = this.cleanedCsvData || this.rawCsvData;

            // Ensure it's fully cleaned (in case user bypassed preview)
            if (!this.cleanedCsvData) {
                // First clean content within quotes, then save 8th row, remove first 8 rows, then remove blank columns
                const lines = csvDataToProcess.trim().split('\n');

                // First clean content within quotes on the entire data (including headers)
                const fullCsvWithCleanedContent = this.cleanCsvNewlines(csvDataToProcess);

                // Now split the cleaned data and save the 8th row as metadata
                const cleanedLines = fullCsvWithCleanedContent.trim().split('\n');
                let rawMetadataRow = cleanedLines[7] || '';

                // Process the 8th row: remove blank entries and add two blank placeholders at the front
                this.xlsxMetadataRow = this.processMetadataRow(rawMetadataRow);

                // Remove first 8 header rows from the cleaned data
                const dataLines = cleanedLines.slice(8); // Remove first 8 header rows
                const csvWithoutHeaders = dataLines.join('\n');

                // Now remove columns that have all blank data from the remaining data (not entire file)
                csvDataToProcess = this.removeColumnsWithAllBlankData(csvWithoutHeaders);
            }

            // Headers have been removed and blank columns removed, csvDataToProcess contains processed data
            const filteredCsvData = csvDataToProcess;


            // Parse the filtered CSV data using XLSX-specific parsing logic
            const data = DataProcessor.parseXlsxCsv(filteredCsvData);

            // Process the schedule data for XLSX
            progressText.textContent = 'Processing XLSX schedule data...';
            progressFill.style.width = '60%';


            const processedData = DataProcessor.processXlsxScheduleData(data, this.generateId.bind(this), this.currentWeekStart, this.xlsxMetadataRow, DataProcessor.parseCsvRow);

            progressText.textContent = 'Preparing XLSX import results...';
            progressFill.style.width = '100%';

            // Show XLSX import results
            setTimeout(() => {
                progressDiv.style.display = 'none';
                this.showXlsxImportResults(processedData);
            }, 500);

        } catch (error) {
            console.error('CSV processing error:', error);
            progressText.textContent = 'Processing failed: ' + error.message;
            progressFill.style.backgroundColor = '#ef4444';
            setTimeout(() => {
                progressDiv.style.display = 'none';
                document.getElementById('dataPreview').innerHTML = '<p style="color: red;">Processing failed. Please check your file format.</p>';
            }, 2000);
        }
    }

    // Helper function to remove newlines, carriage returns, and spaces within quotes
    cleanCsvNewlines(csvText) {
        console.log('cleanCsvNewlines called with text length:', csvText.length);
        let result = '';
        let inQuotes = false;
        let i = 0;

        while (i < csvText.length) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote within quoted field
                    result += '""';
                    i += 2; // Skip both quotes
                    continue;
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                    result += char;
                }
            } else if ((char === '\n' || char === '\r' || char === ' ') && inQuotes) {
                // Skip newlines, carriage returns, and spaces within quotes
                // Don't add anything to result - completely remove them
                // This will concatenate words together
            } else {
                result += char;
            }

            i++;
        }

        console.log('cleanCsvNewlines returning result length:', result.length);
        return result;
    }

    // Helper function to remove empty cells from the first row
    removeEmptyCellsFromFirstRow(csvText) {
        console.log('removeEmptyCellsFromFirstRow called with text length:', csvText.length);
        const lines = csvText.trim().split('\n');
        console.log('Total lines found:', lines.length);
        console.log('First few lines:', lines.slice(0, 3));

        if (lines.length === 0) return csvText;

        // Parse the first row to identify non-empty columns
        const firstRow = lines[0];
        console.log('First row:', firstRow);
        const columns = DataProcessor.parseCsvRow(firstRow);
        console.log('Parsed columns from first row:', columns);
        console.log('Number of columns:', columns.length);

        // Find indices of non-empty columns
        const nonEmptyIndices = [];
        columns.forEach((cell, index) => {
            console.log(`Column ${index}: "${cell}" (trimmed: "${cell.trim()}")`);
            if (cell.trim() !== '') {
                nonEmptyIndices.push(index);
            }
        });

        console.log('Non-empty column indices:', nonEmptyIndices);
        console.log('Total non-empty columns:', nonEmptyIndices.length);

        if (nonEmptyIndices.length === columns.length) {
            // No empty cells to remove
            console.log('No empty cells found, returning original CSV');
            return csvText;
        }

        console.log('Removing', columns.length - nonEmptyIndices.length, 'empty columns');

        // Rebuild CSV with only non-empty columns
        const cleanedLines = lines.map((line, lineIndex) => {
            const cells = DataProcessor.parseCsvRow(line);
            console.log(`Line ${lineIndex}: parsed ${cells.length} cells:`, cells.slice(0, 5));
            const filteredCells = nonEmptyIndices.map(index => cells[index] || '');
            console.log(`Line ${lineIndex}: filtered to ${filteredCells.length} cells:`, filteredCells.slice(0, 5));
            return filteredCells.map(cell => {
                // Re-quote cells that contain commas or quotes
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    return '"' + cell.replace(/"/g, '""') + '"';
                }
                return cell;
            }).join(',');
        });

        const result = cleanedLines.join('\n');
        console.log('Final result length:', result.length);
        console.log('First few lines of result:', result.split('\n').slice(0, 3));

        return result;
    }

    // Helper function to remove columns that have all blank data
    removeColumnsWithAllBlankData(csvText) {
        console.log('removeColumnsWithAllBlankData called with text length:', csvText.length);
        const lines = csvText.trim().split('\n');

        if (lines.length === 0) {
            console.log('No lines in CSV, returning empty');
            return '';
        }

        // Step 1: Save and remove the first row
        const firstRow = lines[0];
        const firstRowCells = DataProcessor.parseCsvRow(firstRow);
        const dataRows = lines.slice(1);

        console.log('First row cells:', firstRowCells);
        console.log('Data rows:', dataRows.length);

        if (dataRows.length === 0) {
            console.log('No data rows, returning original CSV');
            return csvText;
        }

        // Step 2: Analyze each column to see if it has all blank data
        const columnCount = firstRowCells.length;
        const columnsToKeep = [];

        console.log('Analyzing', columnCount, 'columns for blank data...');

        for (let colIndex = 0; colIndex < columnCount; colIndex++) {
            let hasNonBlankData = false;

            // Check if first row cell has data
            if (firstRowCells[colIndex] && firstRowCells[colIndex].trim() !== '') {
                hasNonBlankData = true;
                console.log(`Column ${colIndex}: First row has data "${firstRowCells[colIndex]}"`);
            } else {
                // Check all data rows for this column
                for (const row of dataRows) {
                    const cells = DataProcessor.parseCsvRow(row);
                    if (cells[colIndex] && cells[colIndex].trim() !== '') {
                        hasNonBlankData = true;
                        console.log(`Column ${colIndex}: Data row has data "${cells[colIndex]}"`);
                        break;
                    }
                }
            }

            if (hasNonBlankData) {
                columnsToKeep.push(colIndex);
                console.log(`Column ${colIndex}: KEEPING (has data)`);
            } else {
                console.log(`Column ${colIndex}: REMOVING (all blank)`);
            }
        }

        console.log('Columns to keep:', columnsToKeep);
        console.log('Columns to remove:', columnCount - columnsToKeep.length);

        if (columnsToKeep.length === 0) {
            console.log('All columns are blank, returning empty result');
            return '';
        }

        // Step 3: Remove blank columns from ALL rows
        const cleanedLines = lines.map((line, lineIndex) => {
            const cells = DataProcessor.parseCsvRow(line);
            console.log(`Row ${lineIndex}: original cells:`, cells.length);

            // Keep only non-blank columns
            const filteredCells = columnsToKeep.map(index => cells[index] || '');
            console.log(`Row ${lineIndex}: filtered cells:`, filteredCells.length);

            // Rebuild the row with proper CSV formatting
            return filteredCells.map(cell => {
                // Re-quote cells that contain commas or quotes
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    return '"' + cell.replace(/"/g, '""') + '"';
                }
                return cell;
            }).join(',');
        });

        const result = cleanedLines.join('\n');
        console.log('Final result length:', result.length);
        console.log('Final result lines:', cleanedLines.length);
        console.log('Final columns per row:', columnsToKeep.length);

        return result;
    }



    // XLSX-specific import results display
    showXlsxImportResults(processedData) {
        const dataPreview = document.getElementById('dataPreview');

        const { employees, schedules, totalRows, totalEmployees, totalShiftAssignments } = processedData;

        // Count unique shift types from the schedules
        const uniqueShiftTypes = new Set();
        schedules.forEach(schedule => {
            if (schedule.shiftType && schedule.shiftType.trim()) {
                uniqueShiftTypes.add(schedule.shiftType.trim());
            }
        });
        const totalShiftTypes = uniqueShiftTypes.size;

        dataPreview.innerHTML = `
            <div class="import-results">
                <h4>✅ XLSX Import Successful!</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <strong>${totalEmployees}</strong> Employees imported
                    </div>
                    <div class="stat-item">
                        <strong>${totalShiftTypes}</strong> Shift types
                    </div>
                    <div class="stat-item">
                        <strong>${totalShiftAssignments}</strong> Shift assignments
                    </div>
                    <div class="stat-item">
                        <strong>${totalRows}</strong> Total rows processed
                    </div>
                </div>

                ${employees.length > 0 ? `
                <div class="preview-table">
                    <h5>Imported Employees:</h5>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Job Role</th>
                                <th>Shifts Assigned</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${employees.slice(0, 5).map(employee => `
                                <tr>
                                    <td>${employee.name}</td>
                                    <td>${employee.role}</td>
                                    <td>${schedules.filter(s => s.employeeId === employee.id).length} shifts</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ` : ''}

                <div class="import-actions" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="workforceManager.confirmXlsxImport()">
                        <i class="fas fa-save"></i> Save XLSX Import
                    </button>
                    <button class="btn btn-secondary" onclick="workforceManager.cancelXlsxImport()">
                        <i class="fas fa-times"></i> Cancel Import
                    </button>
                </div>
            </div>
        `;

        // Store the processed data for confirmation
        this.xlsxImportData = processedData;
    }

    // Confirm and save XLSX import data
    confirmXlsxImport() {
        if (!this.xlsxImportData) {
            alert('No XLSX import data available. Please upload a file first.');
            return;
        }

        const { employees, schedules } = this.xlsxImportData;

        try {
            // First, extract and create shift types from the schedule data
            const uniqueShiftTypes = new Set();
            schedules.forEach(schedule => {
                if (schedule.shiftType && schedule.shiftType.trim()) {
                    uniqueShiftTypes.add(schedule.shiftType.trim());
                }
            });

            // Create shift types that don't already exist
            uniqueShiftTypes.forEach(shiftTypeName => {
                const existingShift = this.shiftTypes.find(s => s.name === shiftTypeName);
                if (!existingShift) {
                    const newShift = {
                        id: this.generateId(),
                        name: shiftTypeName,
                        description: `${shiftTypeName} shift`,
                        startTime: '09:00', // Default times - can be customized later
                        endTime: '17:00',
                        color: ScheduleUtils.getDefaultShiftColor(shiftTypeName)
                    };
                    this.shiftTypes.push(newShift);
                }
            });

            // Process and save employees with roles
            employees.forEach(employeeData => {
                // Find or create job role
                let roleId = null;
                const existingRole = this.jobRoles.find(r => r.name === employeeData.role);
                if (existingRole) {
                    roleId = existingRole.id;
                } else {
                    const newRole = {
                        id: this.generateId(),
                        name: employeeData.role,
                        description: employeeData.role,
                        department: 'XLSX Import',
                        payRate: 15.00,
                        color: ScheduleUtils.getDefaultRoleColor(employeeData.role)
                    };
                    this.jobRoles.push(newRole);
                    roleId = newRole.id;
                }

                // Create employee
                const newEmployee = {
                    id: employeeData.id,
                    name: employeeData.name,
                    email: `${employeeData.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, '.')}@company.com`,
                    phone: '',
                    roleId: roleId,
                    hireDate: new Date().toISOString().split('T')[0],
                    status: 'active',
                    shiftType: 'Day' // Default to Day, will be updated after schedules are processed
                };
                this.employees.push(newEmployee);
            });

            // Process and save schedules with proper shift mapping
            schedules.forEach(scheduleData => {
                const employee = this.employees.find(e => e.id === scheduleData.employeeId);
                const shiftType = this.shiftTypes.find(s => s.name === scheduleData.shiftType);

                if (employee && shiftType) {
                    const scheduleEntry = {
                        id: scheduleData.id,
                        employeeId: employee.id,
                        shiftId: shiftType.id, // Now properly mapped!
                        date: scheduleData.date
                    };
                    this.schedules.push(scheduleEntry);
                } else if (employee && scheduleData.shiftType) {
                    console.warn('Could not find shift type for:', scheduleData.shiftType, '- Available shift types:', this.shiftTypes.map(s => s.name));
                } else if (!employee) {
                    console.warn('Could not find employee for schedule:', scheduleData);
                }
            });

            // Update employee shift types based on their schedules
            this.employees.forEach(employee => {
                const shiftType = this.determineEmployeeShiftType(employee);
                employee.shiftType = shiftType;
            });

            // Set calendar start date to the first (earliest) imported date
            if (schedules && schedules.length > 0) {
                const importedDates = schedules.map(s => s.date).filter(Boolean);
                if (importedDates.length > 0) {
                    const firstDate = importedDates.reduce((min, d) => (new Date(d) < new Date(min) ? d : min), importedDates[0]);
                    localStorage.setItem('calendarStartDate', firstDate);
                    this.currentWeekStart = new Date(firstDate + 'T00:00:00');
                    const startDateInput = document.getElementById('calendarStartDate');
                    if (startDateInput) {
                        startDateInput.value = firstDate;
                    }
                }
            }

            // Save all data
            this.saveData('shiftTypes', this.shiftTypes);
            this.saveData('jobRoles', this.jobRoles);
            this.saveData('employees', this.employees);
            this.saveData('schedules', this.schedules);

            // Count how many shift types were created during this import
            const newShiftTypesCount = uniqueShiftTypes.size;

            alert(`XLSX import completed successfully!\n\nImported:\n• ${employees.length} employees\n• ${newShiftTypesCount} shift types\n• ${schedules.length} shift assignments`);

            // Switch to calendar view to show imported data
            this.switchView('calendar');

            // Clear the import data
            this.xlsxImportData = null;
            this.xlsxMetadataRow = null;

        } catch (error) {
            console.error('XLSX import confirmation error:', error);
            alert('XLSX import failed: ' + error.message);
        }
    }

    // Cancel XLSX import
    cancelXlsxImport() {
        this.xlsxImportData = null;
        this.xlsxMetadataRow = null;
        document.getElementById('dataPreview').innerHTML = '<p>XLSX import cancelled. Upload another file to try again.</p>';
    }




    // Helper function to get the XLSX metadata row (8th row)
    getXlsxMetadataRow() {
        return this.xlsxMetadataRow || '';
    }

    // Helper function to parse a single CSV row handling quotes properly


    // Helper function to process the 8th row metadata: remove blanks and add placeholder blanks
    processMetadataRow(rowText) {
        if (!rowText || !rowText.trim()) {
            return ',,'; // Return just the two placeholder blanks if row is empty
        }

        // Parse the row as CSV
        const cells = DataProcessor.parseCsvRow(rowText);

        // Filter out blank entries (empty strings, whitespace-only strings)
        const nonBlankCells = cells.filter(cell => cell && cell.trim() !== '');

        // Add two blank placeholders at the front
        const processedCells = ['', ''].concat(nonBlankCells);

        // Rejoin as CSV string
        const result = processedCells.map(cell => {
            // Re-quote cells that contain commas or quotes
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                return '"' + cell.replace(/"/g, '""') + '"';
            }
            return cell;
        }).join(',');

        return result;
    }



    // Old parseCSVLine function removed - multiline handling now in parseCSV




    showImportResults(processedData) {
        const dataPreview = document.getElementById('dataPreview');

        const { employees, shiftTypes, schedules, totalRows, totalEmployees, totalShiftAssignments } = processedData;

        // Store the processed data for confirmation
        this.importData = processedData;

        dataPreview.innerHTML = `
            <div class="import-results">
                <h4>Import Successful!</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <strong>${totalEmployees}</strong> Employees found
                    </div>
                    <div class="stat-item">
                        <strong>${shiftTypes.length}</strong> Shift types detected
                    </div>
                    <div class="stat-item">
                        <strong>${totalShiftAssignments}</strong> Shift assignments
                    </div>
                    <div class="stat-item">
                        <strong>${totalRows}</strong> Total rows processed
                    </div>
                </div>
                <div class="preview-table">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Job Role</th>
                                <th>Shifts Assigned</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${employees.slice(0, 5).map(employee => `
                                <tr>
                                    <td>${employee.name}</td>
                                    <td>${employee.role}</td>
                                    <td>${employee.shifts.length} shifts</td>
                                </tr>
                            `).join('')}
                            ${employees.length > 5 ? `
                                <tr>
                                    <td colspan="3" style="text-align: center; font-style: italic;">
                                        ... and ${employees.length - 5} more employees
                                    </td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
                <div class="shift-types-preview" style="margin-top: 15px;">
                    <h5>Detected Shift Types:</h5>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        ${shiftTypes.map(shift => `
                            <span style="background: ${shift.color}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                ${shift.name} (${shift.count} assignments)
                            </span>
                        `).join('')}
                    </div>
                </div>
                <div class="schedule-preview" style="margin-top: 15px;">
                    <h5>Sample Schedule Assignments:</h5>
                    <table class="data-table" style="font-size: 12px;">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Date</th>
                                <th>Shift</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${schedules.slice(0, 8).map(schedule => `
                                <tr>
                                    <td>${employees.find(e => e.id === schedule.employeeId)?.name || 'Unknown'}</td>
                                    <td>${schedule.date}</td>
                                    <td>${schedule.shiftType}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="import-actions" style="margin-top: 20px;">
                    <button class="btn btn-primary" id="confirmImportBtn">
                        Confirm & Apply Import
                    </button>
                    <button class="btn btn-secondary" id="cancelImportBtn">
                        Cancel Import
                    </button>
                </div>
            </div>
        `;

        // Add event listeners for import buttons
        setTimeout(() => {
            const confirmBtn = document.getElementById('confirmImportBtn');
            const cancelBtn = document.getElementById('cancelImportBtn');

            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => this.confirmImport());
            }
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.cancelImport());
            }
        }, 100);
    }

    confirmImport() {
        if (!this.importData) {
            alert('No import data available. Please upload a file first.');
            return;
        }

        const { employees, shiftTypes, schedules, headers } = this.importData;

        try {
            // Process and add shift types
            console.log('Processing shift types:', shiftTypes.length);
            shiftTypes.forEach(shiftType => {
                console.log('Processing shift type:', shiftType.name, 'with count:', shiftType.count);
                // Check if shift type already exists
                const existingShift = this.shiftTypes.find(s => s.name === shiftType.name);
                if (!existingShift) {
                    const newShift = {
                        id: this.generateId(),
                        name: shiftType.name,
                        description: `${shiftType.name} shift`,
                        startTime: '09:00', // Default times - can be customized later
                        endTime: '17:00',
                        color: shiftType.color
                    };
                    this.shiftTypes.push(newShift);
                    console.log('Created new shift type:', newShift.name, 'with ID:', newShift.id);
                } else {
                    console.log('Shift type already exists:', existingShift.name);
                }
            });

            // Process and add employees with their roles
            console.log('Processing job roles...');
            employees.forEach(employeeData => {
                console.log('Processing employee:', employeeData.name, 'with role:', employeeData.role);
                // Create or find job role
                let roleId = null;
                const existingRole = this.jobRoles.find(r => r.name === employeeData.role);
                if (existingRole) {
                    console.log('Found existing role:', existingRole.name);
                    roleId = existingRole.id;
                } else {
                    console.log('Creating new role:', employeeData.role);
                    const newRole = {
                        id: this.generateId(),
                        name: employeeData.role,
                        description: employeeData.role,
                        department: 'Imported',
                        payRate: 15.00, // Default pay rate
                        color: ScheduleUtils.getDefaultRoleColor(employeeData.role)
                    };
                    this.jobRoles.push(newRole);
                    roleId = newRole.id;
                }

                // Create employee
                const newEmployee = {
                    id: employeeData.id,
                    name: employeeData.name,
                    email: `${employeeData.name.toLowerCase().replace(' ', '.')}@company.com`,
                    phone: '',
                    roleId: roleId,
                    hireDate: (() => {
                        const now = new Date();
                        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    })(),
                    status: 'active'
                };
                this.employees.push(newEmployee);
            });

            // Process and add schedule assignments
            schedules.forEach(scheduleData => {
                // Find the employee and shift type
                const employee = this.employees.find(e => e.id === scheduleData.employeeId);
                const shiftType = this.shiftTypes.find(s => s.name === scheduleData.shiftType);

                if (employee && shiftType) {
                    const scheduleEntry = {
                        id: scheduleData.id,
                        employeeId: employee.id,
                        shiftId: shiftType.id,
                        date: scheduleData.date
                    };
                    this.schedules.push(scheduleEntry);
                }
            });

            // Save all data
            console.log('Saving job roles:', this.jobRoles.length, 'roles');
            console.log('Job roles:', this.jobRoles);
            this.saveData('jobRoles', this.jobRoles);
            this.saveData('shiftTypes', this.shiftTypes);
            this.saveData('employees', this.employees);
            this.saveData('schedules', this.schedules);

            // Set calendar start date to the first (earliest) imported date
            if (schedules && schedules.length > 0) {
                const importedDates = schedules.map(s => s.date).filter(Boolean);
                if (importedDates.length > 0) {
                    const firstDate = importedDates.reduce((min, d) => (new Date(d) < new Date(min) ? d : min), importedDates[0]);
                    localStorage.setItem('calendarStartDate', firstDate);
                    this.currentWeekStart = new Date(firstDate + 'T00:00:00');
                    const startDateInput = document.getElementById('calendarStartDate');
                    if (startDateInput) {
                        startDateInput.value = firstDate;
                    }
                }
            }

            alert(`Import completed successfully!\n\nImported:\n• ${employees.length} employees\n• ${shiftTypes.length} shift types\n• ${schedules.length} shift assignments`);

            console.log('Switching to calendar view...');
            this.switchView('calendar'); // Switch to calendar view to see imported schedule

            // Force a refresh of the calendar to show new data
            setTimeout(() => {
                console.log('Refreshing calendar matrix...');
                this.renderScheduleMatrix();
            }, 500);

        } catch (error) {
            console.error('Import confirmation error:', error);
            alert('Import failed: ' + error.message);
        }
    }

    cancelImport() {
        document.getElementById('dataPreview').innerHTML = '<p>Import cancelled. Upload another file to try again.</p>';
    }

    // Employee CRUD functions

    deleteEmployee(employeeId) {
        const employee = this.employees.find(e => e.id === employeeId);
        if (!employee) return;

        if (confirm(`Are you sure you want to delete ${employee.name}?`)) {
            // Remove employee
            this.employees = this.employees.filter(e => e.id !== employeeId);
            // Remove associated schedules
            this.schedules = this.schedules.filter(s => s.employeeId !== employeeId);

            // Save changes
            this.saveData('employees', this.employees);
            this.saveData('schedules', this.schedules);

            // Refresh views
            this.renderUsersView();
            this.renderScheduleMatrix();
        }
    }


    // Helper function to get CSS class for role badges
    getRoleBadgeClass(roleName) {
        // Find the role by name to get its custom color
        const role = this.jobRoles.find(r => r.name === roleName);
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
        const employeeSchedules = this.schedules.filter(s => s.employeeId === employee.id);

        // Check if any schedules contain night shifts
        for (const schedule of employeeSchedules) {
            const shiftType = this.shiftTypes.find(s => s.id === schedule.shiftId);
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
        const employeeSchedules = this.schedules.filter(s => s.employeeId === employee.id);

        // Get unique shift types this employee has worked
        const employeeShiftIds = new Set(employeeSchedules.map(s => s.shiftId).filter(id => id));
        const employeeShifts = this.shiftTypes.filter(shift => employeeShiftIds.has(shift.id));

        // Get employee's role and day/night preference
        const role = this.jobRoles.find(r => r.id === employee.roleId);
        const employeeShiftType = employee.shiftType || this.determineEmployeeShiftType(employee);

        // Collect suggested shifts based on multiple criteria
        const suggestedShifts = new Set();

        // 1. Add shifts the employee has actually worked (highest priority)
        employeeShifts.forEach(shift => suggestedShifts.add(shift));

        // 2. Add role-appropriate shifts
        if (role) {
            const roleName = role.name.toUpperCase();

            this.shiftTypes.forEach(shift => {
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

            this.shiftTypes.forEach(shift => {
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
        this.employees.forEach(employee => {
            const shiftType = this.determineEmployeeShiftType(employee);
            employee.shiftType = shiftType;
        });
        this.saveData('employees', this.employees);
    }

    // Shift Type CRUD functions


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
            this.renderShiftsView();
            this.renderScheduleMatrix();
        }
    }

    // Schedule manipulation methods for UI Manager

    // Assign a shift to an employee for a specific date
    assignShiftToEmployee(employeeId, date, shiftId) {
        console.log(`Assigning shift ${shiftId} to employee ${employeeId} for date ${date}`);

        // Find existing schedule entry
        const existingSchedule = this.schedules.find(s =>
            s.employeeId === employeeId && s.date === date
        );

        if (shiftId) {
            // Update or create schedule entry
            if (existingSchedule) {
                existingSchedule.shiftId = shiftId;
            } else {
                this.schedules.push({
                    id: this.generateId(),
                    employeeId,
                    shiftId,
                    date
                });
                }
            } else {
            // Remove schedule entry if shiftId is null/empty (set to "off")
            if (existingSchedule) {
                this.schedules = this.schedules.filter(s =>
                    !(s.employeeId === employeeId && s.date === date)
                );
            }
        }

        // Update employee shift type based on their schedules
        const employee = this.employees.find(e => e.id === employeeId);
        if (employee) {
            employee.shiftType = this.determineEmployeeShiftType(employee);
        }

        // Save changes
        this.saveData('schedules', this.schedules);
        this.saveData('employees', this.employees);

        // Refresh the UI
        this.renderScheduleMatrix();
        this.renderWorkerCountSummary();
    }

    // Delete the current shift (set to "off")
    deleteCurrentShift() {
        if (!this.uiManager || !this.uiManager.currentShiftContext) {
            console.error('No current shift context available');
            return;
        }

        const { employeeId, date, currentShiftId } = this.uiManager.currentShiftContext;

        if (!currentShiftId) {
            alert('No shift to delete - this employee is already off.');
            return;
        }

        if (confirm('Are you sure you want to delete this shift? The employee will be marked as "Off".')) {
            // Record the change for undo functionality
            this.recordShiftChange(employeeId, date, currentShiftId, null);

            // Remove the schedule entry
            this.schedules = this.schedules.filter(s =>
                !(s.employeeId === employeeId && s.date === date)
            );

            // Update employee shift type
            const employee = this.employees.find(e => e.id === employeeId);
            if (employee) {
                employee.shiftType = this.determineEmployeeShiftType(employee);
            }

            // Save changes
            this.saveData('schedules', this.schedules);
            this.saveData('employees', this.employees);

            // Refresh the UI
            this.renderScheduleMatrix();
            this.renderWorkerCountSummary();

            console.log(`🗑️ Shift deleted for employee ${employeeId} on ${date}`);
        }
    }

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
        this.assignShiftToEmployee(lastChange.employeeId, lastChange.date, lastChange.oldShiftId);

        console.log(`↶ Undid change: ${lastChange.newShiftId || 'Off'} → ${lastChange.oldShiftId || 'Off'}`);
        alert(`Change undone: Shift reverted to previous state.`);
    }

    // Add a custom shift type
    addCustomShift() {
        if (!this.uiManager || !this.uiManager.currentShiftContext) {
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
        let shiftType = this.shiftTypes.find(s => s.name.toLowerCase() === customShiftName.toLowerCase());

        // If it doesn't exist, create it
        if (!shiftType) {
            shiftType = {
                id: this.generateId(),
                name: customShiftName,
                description: `Custom shift: ${customShiftName}`,
                startTime: '09:00', // Default times
                endTime: '17:00',
                color: ScheduleUtils.getDefaultShiftColor(customShiftName)
            };

            this.shiftTypes.push(shiftType);
            this.saveData('shiftTypes', this.shiftTypes);
            console.log(`✅ Created new custom shift type: ${customShiftName}`);
        }

        // Apply the shift change
        const { employeeId, date } = this.uiManager.currentShiftContext;
        this.assignShiftToEmployee(employeeId, date, shiftType.id);

        // Clear the input and hide context menu
        customShiftInput.value = '';
        if (this.uiManager.hideContextMenu) {
            this.uiManager.hideContextMenu();
        }
    }

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

        console.log(`📝 Recorded shift change: ${oldShiftId || 'Off'} → ${newShiftId || 'Off'}`);
    }


    // Job Role CRUD functions

    // Handle shift type form submission

    // Handle job role form submission

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
            this.renderRolesView();
            this.renderUsersView();
            this.renderScheduleMatrix();
        }
    }








    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    loadData(key) {
        const saved = localStorage.getItem(`workforce_${key}`);
        console.log(`Loading ${key} from localStorage:`, saved ? 'Found' : 'Not found');
        const parsed = saved ? JSON.parse(saved) : null;
        console.log(`Parsed ${key}:`, parsed);
        return parsed;
    }

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











    // Render worker count summary below the schedule matrix
    renderWorkerCountSummary() {
        console.log('=== RENDERING WORKER COUNT SUMMARY ===');

        const summaryContainer = document.getElementById('workerCountSummary');
        if (!summaryContainer) {
            console.error('Worker count summary container not found');
            return;
        }

        // Get time interval from localStorage or use 48 as default
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 48;

        // Use the configured start date
        const calendarStartDate = new Date(this.currentWeekStart.getFullYear(), this.currentWeekStart.getMonth(), this.currentWeekStart.getDate());

        // Generate dates starting from the selected start date
        const weekDates = [];
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            weekDates.push(date);
        }

        // Create schedule lookup map for quick access
        const scheduleMap = new Map();
        this.schedules.forEach(schedule => {
            const key = `${schedule.employeeId}_${schedule.date}`;
            scheduleMap.set(key, schedule);
        });

        // Generate summary HTML
        let summaryHTML = '';
        
        // Calculate counts for each date and role type
        let totalAMGRDayMatches = 0;
        let totalPCTDayMatches = 0;
        let totalUSDayMatches = 0;
        let totalRNDayMatches = 0;
        let totalChargeDayMatches = 0;

        let totalAMGRNightMatches = 0;
        let totalPCTNightMatches = 0;
        let totalUSNightMatches = 0;
        let totalRNNightMatches = 0;
        let totalChargeNightMatches = 0;

        // Store counts for each date and role type
        const amgrDayCounts = [];
        const pctDayCounts = [];
        const usDayCounts = [];
        const rnDayCounts = [];
        const chargeDayCounts = [];

        const amgrNightCounts = [];
        const pctNightCounts = [];
        const usNightCounts = [];
        const rnNightCounts = [];
        const chargeNightCounts = [];

        weekDates.forEach(date => {
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            let amgrDayCount = 0;
            let pctDayCount = 0;
            let usDayCount = 0;
            let rnDayCount = 0;
            let chargeDayCount = 0;

            let amgrNightCount = 0;
            let pctNightCount = 0;
            let usNightCount = 0;
            let rnNightCount = 0;
            let chargeNightCount = 0;

            // Debug: Log data for first few dates
            if (date === weekDates[0]) {
                console.log('=== DEBUGGING WORKER COUNT ===');
                console.log('Employees:', this.employees.length);
                console.log('Job Roles:', this.jobRoles.map(r => r.name));
                console.log('Shift Types:', this.shiftTypes.map(s => s.name));
                console.log('Sample schedules:', this.schedules.slice(0, 5));

                // Debug: Log summary data for verification
            }

            // Count employees for each role type (count ALL employees for summary, regardless of filters)
            this.employees.forEach(employee => {
                // Don't apply filters here - we want to count all employees for accurate summary totals

                const role = this.jobRoles.find(r => r.id === employee.roleId);
                const roleName = role ? role.name : '';
                const shiftType = employee.shiftType || this.determineEmployeeShiftType(employee);

                // Make shift type matching more flexible
                const isDayShift = shiftType === 'DAY' ||
                                  shiftType === 'Day' ||
                                  this.isDayShift(shiftType);

                const isNightShift = shiftType === 'NIGHT' ||
                                    shiftType === 'Night' ||
                                    this.isNightShift(shiftType);

                // Process DAY shifts
                if (isDayShift) {
                    const scheduleKey = `${employee.id}_${dateString}`;
                    const schedule = scheduleMap.get(scheduleKey);

                    if (schedule) {
                        const shiftTypeObj = this.shiftTypes.find(s => s.id === schedule.shiftId);
                        const shiftName = shiftTypeObj ? shiftTypeObj.name : '';

                        // Check AMGR employees working ANM* shifts
                        const isAMGR = roleName.toUpperCase().includes('AMGR') ||
                                       roleName.toUpperCase().includes('MANAGER') ||
                                       roleName === 'AMGR';

                        const isANMShift = shiftName.startsWith('ANM') ||
                                          shiftName.toUpperCase().startsWith('ANM') ||
                                          shiftName.includes('ANM');

                        if (isAMGR && shiftTypeObj && shiftName && isANMShift) {
                            amgrDayCount++;
                            totalAMGRDayMatches++;

                            // Debug: Log when we find AMGR match
                            if (date === weekDates[0]) {
                                console.log(`Found AMGR DAY match: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }

                        // Check PCT employees working 6t* shifts
                        const isPCT = roleName.toUpperCase().includes('PCT') ||
                                     roleName.toUpperCase().includes('PHLEBOTOMIST') ||
                                     roleName === 'PCT';

                        const is6tShift = shiftName.startsWith('6t') ||
                                         shiftName.toUpperCase().startsWith('6T') ||
                                         shiftName.includes('6t') ||
                                         shiftName.includes('6T');

                        if (isPCT && shiftTypeObj && shiftName && is6tShift) {
                            pctDayCount++;
                            totalPCTDayMatches++;

                            // Debug: Log when we find PCT match
                            if (date === weekDates[0]) {
                                console.log(`Found PCT DAY match: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }

                        // Check US employees working 6w* shifts
                        const isUS = roleName.toUpperCase().includes('US') ||
                                    roleName.toUpperCase().includes('ULTRASOUND') ||
                                    roleName === 'US';

                        const is6wShift = shiftName.startsWith('6w') ||
                                         shiftName.toUpperCase().startsWith('6W') ||
                                         shiftName.includes('6w') ||
                                         shiftName.includes('6W');

                        if (isUS && shiftTypeObj && shiftName && is6wShift) {
                            usDayCount++;
                            totalUSDayMatches++;

                            // Debug: Log when we find US match
                            if (date === weekDates[0]) {
                                console.log(`Found US DAY match: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }

                        // Check RN employees working 6t* or Mid* shifts
                        const isRN = roleName.toUpperCase().includes('RN') ||
                                    roleName.toUpperCase().includes('REGISTERED NURSE') ||
                                    roleName === 'RN';

                        const isRNShift = (shiftName.startsWith('6t') || shiftName.toUpperCase().startsWith('6T') ||
                                          shiftName.includes('6t') || shiftName.includes('6T')) ||
                                         (shiftName.startsWith('Mid') || shiftName.toUpperCase().startsWith('MID') ||
                                          shiftName.includes('Mid') || shiftName.includes('MID'));

                        if (isRN && shiftTypeObj && shiftName && isRNShift) {
                            rnDayCount++;
                            totalRNDayMatches++;

                            // Debug: Log when we find RN match
                            if (date === weekDates[0]) {
                                console.log(`Found RN DAY match: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }

                        // Check CHARGE employees working DAY shifts
                        const isChargeRole = roleName.toUpperCase().includes('CHARGE') ||
                                           roleName.toUpperCase().includes('CHG') ||
                                           roleName === 'CHARGE';

                        if (isDayShift && shiftTypeObj && shiftName && isChargeRole) {
                            chargeDayCount++;
                            totalChargeDayMatches++;

                            // Debug: Log when we find CHARGE DAY match
                            if (date === weekDates[0]) {
                                console.log(`Found CHARGE DAY match: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }

                        // Also check any employee working DAY shift with "Charg" in shift name
                        const isChargeShift = shiftName.includes('Charg') ||
                                             shiftName.toUpperCase().includes('CHARGE') ||
                                             shiftName.toLowerCase().includes('charge');

                        if (isDayShift && shiftTypeObj && shiftName && isChargeShift && !isChargeRole) {
                            chargeDayCount++;
                            totalChargeDayMatches++;

                            // Debug: Log when we find CHARGE DAY match by shift name
                            if (date === weekDates[0]) {
                                console.log(`Found CHARGE DAY match by shift: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }
                    }
                }

                // Process NIGHT shifts
                if (isNightShift) {
                    const scheduleKey = `${employee.id}_${dateString}`;
                    const schedule = scheduleMap.get(scheduleKey);

                    if (schedule) {
                        const shiftTypeObj = this.shiftTypes.find(s => s.id === schedule.shiftId);
                        const shiftName = shiftTypeObj ? shiftTypeObj.name : '';

                        // Check AMGR employees working ANM* shifts
                        const isAMGR = roleName.toUpperCase().includes('AMGR') ||
                                       roleName.toUpperCase().includes('MANAGER') ||
                                       roleName === 'AMGR';

                        const isANMShift = shiftName.startsWith('ANM') ||
                                          shiftName.toUpperCase().startsWith('ANM') ||
                                          shiftName.includes('ANM');

                        if (isAMGR && shiftTypeObj && shiftName && isANMShift) {
                            amgrNightCount++;
                            totalAMGRNightMatches++;

                            // Debug: Log when we find AMGR match
                            if (date === weekDates[0]) {
                                console.log(`Found AMGR NIGHT match: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }

                        // Check PCT employees working 18t* shifts (NIGHT specific)
                        const isPCT = roleName.toUpperCase().includes('PCT') ||
                                     roleName.toUpperCase().includes('PHLEBOTOMIST') ||
                                     roleName === 'PCT';

                        const is18tShift = shiftName.startsWith('18t') ||
                                          shiftName.toUpperCase().startsWith('18T') ||
                                          shiftName.includes('18t') ||
                                          shiftName.includes('18T');

                        if (isPCT && shiftTypeObj && shiftName && is18tShift) {
                            pctNightCount++;
                            totalPCTNightMatches++;

                            // Debug: Log when we find PCT match
                            if (date === weekDates[0]) {
                                console.log(`Found PCT NIGHT match: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }

                        // Check US employees working 18w* shifts (NIGHT specific)
                        const isUS = roleName.toUpperCase().includes('US') ||
                                    roleName.toUpperCase().includes('ULTRASOUND') ||
                                    roleName === 'US';

                        const is18wShift = shiftName.startsWith('18w') ||
                                          shiftName.toUpperCase().startsWith('18W') ||
                                          shiftName.includes('18w') ||
                                          shiftName.includes('18W');

                        if (isUS && shiftTypeObj && shiftName && is18wShift) {
                            usNightCount++;
                            totalUSNightMatches++;

                            // Debug: Log when we find US match
                            if (date === weekDates[0]) {
                                console.log(`Found US NIGHT match: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }

                        // Check RN employees working 18t* shifts (NIGHT specific)
                        const isRN = roleName.toUpperCase().includes('RN') ||
                                    roleName.toUpperCase().includes('REGISTERED NURSE') ||
                                    roleName === 'RN';

                        const isRN18tShift = shiftName.startsWith('18t') ||
                                            shiftName.toUpperCase().startsWith('18T') ||
                                            shiftName.includes('18t') ||
                                            shiftName.includes('18T');

                        if (isRN && shiftTypeObj && shiftName && isRN18tShift) {
                            rnNightCount++;
                            totalRNNightMatches++;

                            // Debug: Log when we find RN match
                            if (date === weekDates[0]) {
                                console.log(`Found RN NIGHT match: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }

                        // Check CHARGE employees working NIGHT shifts
                        const isChargeRole = roleName.toUpperCase().includes('CHARGE') ||
                                           roleName.toUpperCase().includes('CHG') ||
                                           roleName === 'CHARGE';

                        if (isNightShift && shiftTypeObj && shiftName && isChargeRole) {
                            chargeNightCount++;
                            totalChargeNightMatches++;

                            // Debug: Log when we find CHARGE NIGHT match
                            if (date === weekDates[0]) {
                                console.log(`Found CHARGE NIGHT match: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }

                        // Also check any employee working NIGHT shift with "Charg" in shift name
                        const isChargeShift = shiftName.includes('Charg') ||
                                             shiftName.toUpperCase().includes('CHARGE') ||
                                             shiftName.toLowerCase().includes('charge');

                        if (isNightShift && shiftTypeObj && shiftName && isChargeShift && !isChargeRole) {
                            chargeNightCount++;
                            totalChargeNightMatches++;

                            // Debug: Log when we find CHARGE NIGHT match by shift name
                            if (date === weekDates[0]) {
                                console.log(`Found CHARGE NIGHT match by shift: ${employee.name} (${roleName}) - ${shiftName} on ${dateString}`);
                            }
                        }
                    }
                }

                // Debug: Log employee details for first date
                if (date === weekDates[0] && employee.name.includes('John')) {
                    console.log(`Employee: ${employee.name}, Role: ${roleName}, ShiftType: ${shiftType}, IsDay: ${isDayShift}`);
                }
            });

            amgrDayCounts.push(amgrDayCount);
            pctDayCounts.push(pctDayCount);
            usDayCounts.push(usDayCount);
            rnDayCounts.push(rnDayCount);
            chargeDayCounts.push(chargeDayCount);

            amgrNightCounts.push(amgrNightCount);
            pctNightCounts.push(pctNightCount);
            usNightCounts.push(usNightCount);
            rnNightCounts.push(rnNightCount);
            chargeNightCounts.push(chargeNightCount);
        });

        // Debug: Log shift filter states
        console.log('Shift filter states:', this.filterManager.shiftFilters);
        
        // Only show DAY section if day shift filter is enabled
        if (this.filterManager.shiftFilters['day']) {
            console.log('Rendering DAY section');
            summaryHTML += `
                <div class="summary-header">
                    <div class="summary-cell summary-label" style="grid-column: 1 / -1; text-align: center; font-weight: 700; font-size: 1rem;">DAY Shift</div>
                </div>
                <div class="summary-header">
                    <div class="summary-cell summary-label">Date</div>
                    ${weekDates.map(date => {
                        const isToday = date.toDateString() === new Date().toDateString();
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return `<div class="summary-cell date-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}">
                            ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>`;
                    }).join('')}
                </div>
                <div class="summary-row amgr-row" ${this.filterManager.shouldShowRoleInSummary('AMGR') ? '' : 'style="display: none;"'}>
                    <div class="summary-cell summary-label">AMGR</div>`;

            // Add DAY AMGR counts to HTML
            amgrDayCounts.forEach(count => {
                summaryHTML += `<div class="summary-cell count-cell">${count}</div>`;
            });

            summaryHTML += '</div>';

            // Add DAY PCT row
            summaryHTML += '<div class="summary-row pct-row" ' + (this.filterManager.shouldShowRoleInSummary('PCT') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">PCT</div>';

            // Add DAY PCT counts to HTML
            pctDayCounts.forEach(count => {
                summaryHTML += `<div class="summary-cell count-cell">${count}</div>`;
            });

            summaryHTML += '</div>';

            // Add DAY US row
            summaryHTML += '<div class="summary-row us-row" ' + (this.filterManager.shouldShowRoleInSummary('US') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">US</div>';

            // Add DAY US counts to HTML
            usDayCounts.forEach(count => {
                summaryHTML += `<div class="summary-cell count-cell">${count}</div>`;
            });

            summaryHTML += '</div>';

            // Add DAY RN row
            summaryHTML += '<div class="summary-row rn-row" ' + (this.filterManager.shouldShowRoleInSummary('RN') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">RN</div>';

            // Add DAY RN counts to HTML
            rnDayCounts.forEach(count => {
                summaryHTML += `<div class="summary-cell count-cell">${count}</div>`;
            });

            summaryHTML += '</div>';

            // Add DAY CHARGE row (always visible)
            summaryHTML += '<div class="summary-row charge-row"><div class="summary-cell summary-label">CHARGE</div>';

            // Add DAY CHARGE counts to HTML
            chargeDayCounts.forEach(count => {
                summaryHTML += `<div class="summary-cell count-cell">${count}</div>`;
            });

            summaryHTML += '</div>';
        }

        // Only show NIGHT section if night shift filter is enabled
        if (this.filterManager.shiftFilters['night']) {
            console.log('Rendering NIGHT section');
            summaryHTML += `
                <div class="summary-header" style="margin-top: 2rem;">
                    <div class="summary-cell summary-label" style="grid-column: 1 / -1; text-align: center; font-weight: 700; font-size: 1rem;">NIGHT Shift</div>
                </div>
                <div class="summary-header">
                    <div class="summary-cell summary-label">Date</div>
                    ${weekDates.map(date => {
                        const isToday = date.toDateString() === new Date().toDateString();
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                        return `<div class="summary-cell date-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}">
                            ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>`;
                    }).join('')}
                </div>
                <div class="summary-row amgr-row" ${this.filterManager.shouldShowRoleInSummary('AMGR') ? '' : 'style="display: none;"'}>
                    <div class="summary-cell summary-label">AMGR</div>`;

            // Add NIGHT AMGR counts to HTML
            amgrNightCounts.forEach(count => {
                summaryHTML += `<div class="summary-cell count-cell">${count}</div>`;
            });

            summaryHTML += '</div>';

            // Add NIGHT PCT row
            summaryHTML += '<div class="summary-row pct-row" ' + (this.filterManager.shouldShowRoleInSummary('PCT') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">PCT</div>';

            // Add NIGHT PCT counts to HTML
            pctNightCounts.forEach(count => {
                summaryHTML += `<div class="summary-cell count-cell">${count}</div>`;
            });

            summaryHTML += '</div>';

            // Add NIGHT US row
            summaryHTML += '<div class="summary-row us-row" ' + (this.filterManager.shouldShowRoleInSummary('US') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">US</div>';

            // Add NIGHT US counts to HTML
            usNightCounts.forEach(count => {
                summaryHTML += `<div class="summary-cell count-cell">${count}</div>`;
            });

            summaryHTML += '</div>';

            // Add NIGHT RN row
            summaryHTML += '<div class="summary-row rn-row" ' + (this.filterManager.shouldShowRoleInSummary('RN') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">RN</div>';

            // Add NIGHT RN counts to HTML
            rnNightCounts.forEach(count => {
                summaryHTML += `<div class="summary-cell count-cell">${count}</div>`;
            });

            summaryHTML += '</div>';

            // Add NIGHT CHARGE row (always visible)
            summaryHTML += '<div class="summary-row charge-row"><div class="summary-cell summary-label">CHARGE</div>';

            // Add NIGHT CHARGE counts to HTML
            chargeNightCounts.forEach(count => {
                summaryHTML += `<div class="summary-cell count-cell">${count}</div>`;
            });

            summaryHTML += '</div>';
        }

        summaryContainer.innerHTML = summaryHTML;

        // Update CSS grid template to match the calendar
        const totalColumns = 1 + timeInterval; // 1 label column + timeInterval date columns
        const gridTemplate = `250px repeat(${timeInterval}, 50px)`; // Align date columns with calendar (130px + 120px = 250px)
        summaryContainer.style.gridTemplateColumns = gridTemplate;

        console.log('Worker count summary rendered successfully');
        console.log('Summary: DAY - Found', totalAMGRDayMatches, 'AMGR,', totalPCTDayMatches, 'PCT,', totalUSDayMatches, 'US,', totalRNDayMatches, 'RN, and', totalChargeDayMatches, 'CHARGE matches');
        console.log('Summary: NIGHT - Found', totalAMGRNightMatches, 'AMGR,', totalPCTNightMatches, 'PCT,', totalUSNightMatches, 'US,', totalRNNightMatches, 'RN, and', totalChargeNightMatches, 'CHARGE matches');

        // Debug: Show summary totals
        console.log('Summary totals - DAY:', totalChargeDayMatches, 'CHARGE matches, NIGHT:', totalChargeNightMatches, 'CHARGE matches');

        // Bind drag scroll for the summary container
        setTimeout(() => this.uiManager.bindContainerDragScroll('.worker-count-summary-container'), 100);
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
