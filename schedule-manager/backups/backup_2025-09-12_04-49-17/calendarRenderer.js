// Calendar Renderer Module
// Handles rendering of calendar view and worker count summary

class CalendarRenderer {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
    }

    // Analyze staffing levels and return issues
    analyzeStaffingIssues() {
        console.log('=== ANALYZING STAFFING ISSUES ===');

        const issues = [];
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 48;
        const calendarStartDate = new Date(this.workforceManager.currentWeekStart.getFullYear(), this.workforceManager.currentWeekStart.getMonth(), this.workforceManager.currentWeekStart.getDate());

        // Create a schedule lookup map for quick access
        const scheduleMap = new Map();
        this.workforceManager.schedules.forEach(schedule => {
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

            this.workforceManager.employees.forEach(employee => {
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
                    const shiftName = this.workforceManager.shiftTypes.find(s => s.id === issueDetail.shift)?.name || issueDetail.shift;
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

    /**
     * Render the schedule matrix (calendar view)
     * Creates a grid showing employees as rows and dates as columns
     * Includes shift assignments, role badges, and count summaries
     */
    renderScheduleMatrix() {
        console.log('=== RENDERING CALENDAR MATRIX ===');

        const matrixContainer = document.getElementById('scheduleMatrix');

        console.log('Current data state:');
        console.log('- Employees:', this.workforceManager.employees.length, this.workforceManager.employees);
        console.log('- Shift Types:', this.workforceManager.shiftTypes.length, this.workforceManager.shiftTypes);
        console.log('- Job Roles:', this.workforceManager.jobRoles.length, this.workforceManager.jobRoles);
        console.log('- Schedules:', this.workforceManager.schedules.length, this.workforceManager.schedules);

        if (!matrixContainer) {
            console.error('Schedule matrix element not found');
            return;
        }

        // Get time interval from localStorage or use 48 as default
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 48;
        console.log('📅 Using time interval:', timeInterval, 'days');

        // Use the configured start date (from localStorage or default)
        // Create a new date object to avoid reference issues
        const calendarStartDate = new Date(this.workforceManager.currentWeekStart.getFullYear(), this.workforceManager.currentWeekStart.getMonth(), this.workforceManager.currentWeekStart.getDate());
        console.log('📅 Calendar start date:', `${calendarStartDate.getFullYear()}-${String(calendarStartDate.getMonth() + 1).padStart(2, '0')}-${String(calendarStartDate.getDate()).padStart(2, '0')}`);

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
        this.workforceManager.schedules.forEach(schedule => {
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
                const isSaturday = date.getDay() === 6;
                const headerStyle = '';
                console.log(`Header ${index} style: ${headerStyle}`);
                return `<div class="matrix-cell header-cell date-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isSaturday ? 'saturday' : ''}" style="${headerStyle}">
                    ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>`;
            }).join('')}
            <div class="matrix-cell header-cell count-header count-header-fri" style="background: #f0fdf4 !important; border-bottom: 2px solid #22c55e !important;">Fri</div>
            <div class="matrix-cell header-cell count-header count-header-sat" style="background: #fef7ff !important; border-bottom: 2px solid #a855f7 !important;">Sat</div>
            <div class="matrix-cell header-cell count-header count-header-sun" style="background: #fff7ed !important; border-bottom: 2px solid #f97316 !important;">Sun</div>
            <div class="matrix-cell header-cell count-header count-header-vac" style="background: #fef3c7 !important; border-bottom: 2px solid #f59e0b !important;">Vac</div>
            <div class="matrix-cell header-cell count-header count-header-req" style="background: #dbeafe !important; border-bottom: 2px solid #3b82f6 !important;">Req</div>
            <div class="matrix-cell header-cell count-header count-header-cha" style="background: #fce7f3 !important; border-bottom: 2px solid #ec4899 !important;">CN</div>
            <div class="matrix-cell header-cell count-header count-header-mov" style="background: #f3e8ff !important; border-bottom: 2px solid #a855f7 !important;">MOV</div>
        `;

        console.log('Header generated with', weekDates.length + 9, 'columns');

        // Add employee rows (each employee gets their own row with all date columns)
        console.log('=== GENERATING EMPLOYEE ROWS ===');

        // Filter employees based on current filter settings, then sort them
        const filteredEmployees = this.workforceManager.filterManager.getSortedEmployees(
            this.workforceManager.employees.filter(employee => this.workforceManager.filterManager.shouldShowEmployee(employee))
        );
        console.log('Filtered and sorted employees to display:', filteredEmployees.length, 'out of', this.workforceManager.employees.length);

        filteredEmployees.forEach((employee, empIndex) => {
            const role = this.workforceManager.jobRoles.find(r => r.id === employee.roleId);
            const roleName = role ? role.name : 'No Role';
            const shiftType = employee.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(employee);
            const shiftBadgeClass = shiftType === 'Night' ? 'night-shift-badge' : 'day-shift-badge';
            const roleBadgeClass = this.workforceManager.employeeManager.getRoleBadgeClass(roleName);
            console.log(`Employee ${empIndex + 1}: ${employee.name} (${roleName}) - ${shiftType}`);

            // Calculate counts for this employee
            let friCount = 0;
            let satCount = 0;
            let sunCount = 0;
            let vacCount = 0;
            let reqCount = 0;
            let chaCount = 0;
            let movCount = 0;

            weekDates.forEach((date) => {
                const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const scheduleKey = `${employee.id}_${dateString}`;
                const schedule = scheduleMap.get(scheduleKey);

                if (schedule) {
                    const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
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
                    // Count shifts containing "Charg" for CHA
                    if (shiftName.includes('Charg')) {
                        chaCount++;
                    }
                    // Count shifts containing "MOV" or "Move" for MOV
                    if (shiftName.toUpperCase().includes('MOV') || shiftName.toUpperCase().includes('MOVE')) {
                        movCount++;
                    }
                }
            });

            // Employee name cell
            matrixHTML += `<div class="matrix-cell employee-name">${employee.name}</div>`;

            // Job role cell with badges
            const priority = employee.priority || '';
            const priorityBadge = priority ? `<span class="priority-badge-small priority-${priority.toLowerCase()}">${priority}</span>` : '';
            matrixHTML += `<div class="matrix-cell job-role">
                <div class="job-badges">
                    <span class="role-badge ${roleBadgeClass}">${roleName}</span>
                    <span class="shift-type-badge ${shiftBadgeClass}">${shiftType}</span>
                </div>
                <div class="priority-space">${priorityBadge}</div>
            </div>`;

            // Add shift cells for each date
            weekDates.forEach((date, i) => {
                const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const scheduleKey = `${employee.id}_${dateString}`;
                const schedule = scheduleMap.get(scheduleKey);

                const isToday = date.toDateString() === new Date().toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isSaturday = date.getDay() === 6;

                let shiftName = '';
                let shiftColor = '#f3f4f6';

                if (schedule) {
                    const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
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
                matrixHTML += `<div id="${shiftCellId}" class="matrix-cell shift-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isSaturday ? 'saturday' : ''} ${isOffShift ? 'off-shift' : ''}" style="background-color: ${shiftColor} !important;" data-employee-id="${employee.id}" data-date="${dateString}" data-shift-id="${schedule ? schedule.shiftId : ''}">
                    ${shiftName}
                </div>`;
            });

            // Add count cells for this employee
            matrixHTML += `<div class="matrix-cell count-cell count-cell-fri" style="background: #f0fdf4 !important;">${friCount}</div>`;
            matrixHTML += `<div class="matrix-cell count-cell count-cell-sat" style="background: #fef7ff !important;">${satCount}</div>`;
            matrixHTML += `<div class="matrix-cell count-cell count-cell-sun" style="background: #fff7ed !important;">${sunCount}</div>`;
            matrixHTML += `<div class="matrix-cell count-cell count-cell-vac" style="background: #fef3c7 !important;">${vacCount}</div>`;
            matrixHTML += `<div class="matrix-cell count-cell count-cell-req" style="background: #dbeafe !important;">${reqCount}</div>`;
            matrixHTML += `<div class="matrix-cell count-cell count-cell-cha" style="background: #fce7f3 !important;">${chaCount}</div>`;
            matrixHTML += `<div class="matrix-cell count-cell count-cell-mov" style="background: #f3e8ff !important;">${movCount}</div>`;
        });

        // Add empty state if no employees
        if (this.workforceManager.employees.length === 0) {
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
        const totalCountColumns = 7; // Always 7 count columns (Fri, Sat, Sun, Vac, Req, CHA, MOV)
        const visibleCountColumns = this.workforceManager.filterManager.getVisibleCountColumns(); // Count columns based on visibility
        const totalColumns = baseColumns + dateColumns + totalCountColumns;
        
        // Build grid template to match HTML structure exactly (all columns always present)
        let gridTemplate = `130px 120px repeat(${timeInterval}, 50px)`; // Base columns + date columns

        // Always include all count columns in grid template (HTML always has them)
        gridTemplate += ' 40px 40px 40px 40px 40px 40px 40px'; // Fri, Sat, Sun, Vac, Req, CHA, MOV

        matrixContainer.style.gridTemplateColumns = gridTemplate;
        matrixContainer.style.width = 'max-content'; // Ensure container can expand
        matrixContainer.style.minWidth = '100%'; // Ensure at least container width
        console.log('🎨 Updated CSS grid template to:', gridTemplate);
        console.log('📏 Grid will have', totalColumns, 'columns (base:', baseColumns, 'dates:', dateColumns, 'total count:', totalCountColumns, 'visible count:', visibleCountColumns, ')');

        console.log('Calendar rendered successfully with', this.workforceManager.employees.length, 'employees and', weekDates.length, 'days');

        // Render the worker count summary below the calendar
        this.renderWorkerCountSummary();

        // Bind drag scroll functionality after rendering
        setTimeout(() => this.workforceManager.uiManager.bindDragScroll(), 100);

        // Update staffing issues panel
        this.updateStaffingIssuesPanel();

        // Update column visibility based on toggle states
        setTimeout(() => this.workforceManager.filterManager.updateColumnVisibility(), 50);

        // Bind right-click events to shift cells for editing
        this.workforceManager.uiManager.bindShiftCellEvents();
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
        const calendarStartDate = new Date(this.workforceManager.currentWeekStart.getFullYear(), this.workforceManager.currentWeekStart.getMonth(), this.workforceManager.currentWeekStart.getDate());

        // Generate dates starting from the selected start date
        const weekDates = [];
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            weekDates.push(date);
        }

        // Create schedule lookup map for quick access
        const scheduleMap = new Map();
        this.workforceManager.schedules.forEach(schedule => {
            const key = `${schedule.employeeId}_${schedule.date}`;
            scheduleMap.set(key, schedule);
        });

        // Generate summary HTML
        let summaryHTML = '';
        
        // Helper function to generate count cells with Saturday borders
        const generateCountCells = (counts) => {
            return counts.map((count, index) => {
                const date = weekDates[index];
                const isSaturday = date.getDay() === 6;
                return `<div class="summary-cell count-cell ${isSaturday ? 'saturday' : ''}">${count}</div>`;
            }).join('');
        };
        
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
                console.log('Employees:', this.workforceManager.employees.length);
                console.log('Job Roles:', this.workforceManager.jobRoles.map(r => r.name));
                console.log('Shift Types:', this.workforceManager.shiftTypes.map(s => s.name));
                console.log('Sample schedules:', this.workforceManager.schedules.slice(0, 5));

                // Debug: Log summary data for verification
            }

            // Count employees for each role type (count ALL employees for summary, regardless of filters)
            this.workforceManager.employees.forEach(employee => {
                // Don't apply filters here - we want to count all employees for accurate summary totals

                const role = this.workforceManager.jobRoles.find(r => r.id === employee.roleId);
                const roleName = role ? role.name : '';
                const shiftType = employee.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(employee);

                // Make shift type matching more flexible
                const isDayShift = shiftType === 'DAY' ||
                                  shiftType === 'Day' ||
                                  this.workforceManager.employeeManager.isDayShift(shiftType);

                const isNightShift = shiftType === 'NIGHT' ||
                                    shiftType === 'Night' ||
                                    this.workforceManager.employeeManager.isNightShift(shiftType);

                // Process DAY shifts
                if (isDayShift) {
                    const scheduleKey = `${employee.id}_${dateString}`;
                    const schedule = scheduleMap.get(scheduleKey);

                    if (schedule) {
                        const shiftTypeObj = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
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
                        const shiftTypeObj = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
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
        console.log('Shift filter states:', this.workforceManager.filterManager.shiftFilters);
        
        // Only show DAY section if day shift filter is enabled
        if (this.workforceManager.filterManager.shiftFilters['day']) {
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
                        const isSaturday = date.getDay() === 6;
                        return `<div class="summary-cell date-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isSaturday ? 'saturday' : ''}">
                            ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>`;
                    }).join('')}
                </div>
                <div class="summary-row amgr-row" ${this.workforceManager.filterManager.shouldShowRoleInSummary('AMGR') ? '' : 'style="display: none;"'}>
                    <div class="summary-cell summary-label">AMGR</div>`;

            // Add DAY AMGR counts to HTML
            summaryHTML += generateCountCells(amgrDayCounts);

            summaryHTML += '</div>';

            // Add DAY PCT row
            summaryHTML += '<div class="summary-row pct-row" ' + (this.workforceManager.filterManager.shouldShowRoleInSummary('PCT') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">PCT</div>';

            // Add DAY PCT counts to HTML
            summaryHTML += generateCountCells(pctDayCounts);

            summaryHTML += '</div>';

            // Add DAY US row
            summaryHTML += '<div class="summary-row us-row" ' + (this.workforceManager.filterManager.shouldShowRoleInSummary('US') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">US</div>';

            // Add DAY US counts to HTML
            summaryHTML += generateCountCells(usDayCounts);

            summaryHTML += '</div>';

            // Add DAY RN row
            summaryHTML += '<div class="summary-row rn-row" ' + (this.workforceManager.filterManager.shouldShowRoleInSummary('RN') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">RN</div>';

            // Add DAY RN counts to HTML
            summaryHTML += generateCountCells(rnDayCounts);

            summaryHTML += '</div>';

            // Add DAY CHARGE row (always visible)
            summaryHTML += '<div class="summary-row charge-row"><div class="summary-cell summary-label">CHARGE</div>';

            // Add DAY CHARGE counts to HTML
            summaryHTML += generateCountCells(chargeDayCounts);

            summaryHTML += '</div>';
        }

        // Only show NIGHT section if night shift filter is enabled
        if (this.workforceManager.filterManager.shiftFilters['night']) {
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
                        const isSaturday = date.getDay() === 6;
                        return `<div class="summary-cell date-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isSaturday ? 'saturday' : ''}">
                            ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>`;
                    }).join('')}
                </div>
                <div class="summary-row amgr-row" ${this.workforceManager.filterManager.shouldShowRoleInSummary('AMGR') ? '' : 'style="display: none;"'}>
                    <div class="summary-cell summary-label">AMGR</div>`;

            // Add NIGHT AMGR counts to HTML
            summaryHTML += generateCountCells(amgrNightCounts);

            summaryHTML += '</div>';

            // Add NIGHT PCT row
            summaryHTML += '<div class="summary-row pct-row" ' + (this.workforceManager.filterManager.shouldShowRoleInSummary('PCT') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">PCT</div>';

            // Add NIGHT PCT counts to HTML
            summaryHTML += generateCountCells(pctNightCounts);

            summaryHTML += '</div>';

            // Add NIGHT US row
            summaryHTML += '<div class="summary-row us-row" ' + (this.workforceManager.filterManager.shouldShowRoleInSummary('US') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">US</div>';

            // Add NIGHT US counts to HTML
            summaryHTML += generateCountCells(usNightCounts);

            summaryHTML += '</div>';

            // Add NIGHT RN row
            summaryHTML += '<div class="summary-row rn-row" ' + (this.workforceManager.filterManager.shouldShowRoleInSummary('RN') ? '' : 'style="display: none;"') + '><div class="summary-cell summary-label">RN</div>';

            // Add NIGHT RN counts to HTML
            summaryHTML += generateCountCells(rnNightCounts);

            summaryHTML += '</div>';

            // Add NIGHT CHARGE row (always visible)
            summaryHTML += '<div class="summary-row charge-row"><div class="summary-cell summary-label">CHARGE</div>';

            // Add NIGHT CHARGE counts to HTML
            summaryHTML += generateCountCells(chargeNightCounts);

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
        setTimeout(() => this.workforceManager.uiManager.bindContainerDragScroll('.worker-count-summary-container'), 100);
    }
}

// Export the class
window.CalendarRenderer = CalendarRenderer;
