// Calendar Renderer Module
// Handles rendering of calendar view and worker count summary

class CalendarRenderer {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
    }

    // Analyze staffing levels and return issues
    analyzeStaffingIssues() {

        const issues = [];
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
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
            const dateString = formatDateString(date);

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

        return issues;
    }

    // Update the staffing issues panel
    updateStaffingIssuesPanel() {

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
        const renderStartTime = performance.now();

        const matrixContainer = document.getElementById('scheduleMatrix');


        if (!matrixContainer) {
            console.error('Schedule matrix element not found');
            return;
        }

        // Get time interval from localStorage or use 48 as default
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;

        // Use the configured start date (from localStorage or default)
        // Create a new date object to avoid reference issues
        const calendarStartDate = new Date(this.workforceManager.currentWeekStart.getFullYear(), this.workforceManager.currentWeekStart.getMonth(), this.workforceManager.currentWeekStart.getDate());

        // Generate dates starting from the selected start date (same as sample data)
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

        // Load snapshot once for all employees (major performance optimization)
        const snapshot = this.workforceManager.snapshotManager ? this.workforceManager.snapshotManager.loadSnapshot() : null;

        // Pre-calculate move counts and shift differences for all employees (major performance optimization)
        const employeeMoveCounts = new Map();
        const employeeShiftDifferences = new Map();
        
        if (snapshot) {
            const preCalcStart = performance.now();
            
            this.workforceManager.employees.forEach(employee => {
                employeeMoveCounts.set(employee.id, this.calculateMoveCountOptimized(employee, weekDates, scheduleMap, snapshot));
                employeeShiftDifferences.set(employee.id, this.calculateShiftDifferencesOptimized(employee, weekDates, scheduleMap, snapshot));
            });
            
            const preCalcTime = performance.now() - preCalcStart;
        }

        // Pre-calculate worker count summary data (major performance optimization)
        const workerCountStart = performance.now();
        const workerCountData = this.preCalculateWorkerCounts(weekDates, scheduleMap);
        const workerCountTime = performance.now() - workerCountStart;

        // Create matrix HTML - EMPLOYEES AS ROWS, DATES AS COLUMNS

        // Generate header row with date columns
        let matrixHTML = `
            <div class="matrix-cell header-cell" style="background: #f8fafc !important; border-bottom: 2px solid #e2e8f0 !important;">Employee Name</div>
            <div class="matrix-cell header-cell" style="background: #f8fafc !important; border-bottom: 2px solid #e2e8f0 !important;">Job Type</div>
            ${weekDates.map((date, index) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isSaturday = date.getDay() === 6;
                const headerStyle = '';
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

        // Add employee rows (each employee gets their own row with all date columns)
        // Filter employees based on current filter settings, then sort them
        const filterStart = performance.now();
        const filteredEmployees = this.workforceManager.filterManager.getSortedEmployees(
            this.workforceManager.employees.filter(employee => this.workforceManager.filterManager.shouldShowEmployee(employee))
        );
        const filterTime = performance.now() - filterStart;

        const employeeLoopStart = performance.now();

        filteredEmployees.forEach((employee, empIndex) => {
            const role = this.workforceManager.jobRoles.find(r => r.id === employee.roleId);
            const roleName = role ? role.name : 'No Role';
            const shiftType = employee.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(employee);
            const shiftBadgeClass = shiftType === 'Night' ? 'night-shift-badge' : 'day-shift-badge';
            const roleBadgeClass = this.workforceManager.employeeManager.getRoleBadgeClass(roleName);

            // Calculate counts for this employee
            const countStart = performance.now();
            let friCount = 0;
            let satCount = 0;
            let sunCount = 0;
            let vacCount = 0;
            let reqCount = 0;
            let chaCount = 0;
            let movCount = 0;

            // This is the most expensive loop - 48 dates × 78 employees = 3,744 iterations
            const dateLoopStart = performance.now();
            weekDates.forEach((date) => {
                const dateString = formatDateString(date);
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
                    // MOV count is calculated separately after all other counts
                }
            });

            // Get pre-calculated MOV count and shift differences (major performance optimization)
            movCount = employeeMoveCounts.get(employee.id) || 0;
            const shiftDifferences = employeeShiftDifferences.get(employee.id) || new Map();

            const dateLoopTime = performance.now() - dateLoopStart;
            const countTime = performance.now() - countStart;
            
            // Log timing for first few employees to identify bottlenecks
            if (empIndex < 3) {
                console.log(`⚡ Employee ${empIndex + 1} (${employee.name}): Date loop: ${dateLoopTime.toFixed(2)}ms, Total count: ${countTime.toFixed(2)}ms`);
            }

            // Employee name cell
            const htmlStart = performance.now();
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

            // Add shift cells for each date (another expensive loop - 48 dates per employee)
            const shiftCellStart = performance.now();
            weekDates.forEach((date, i) => {
                const dateString = formatDateString(date);
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
                
                // Check for shift differences and apply appropriate class
                const differenceKey = `${employee.id}_${dateString}`;
                const differenceType = shiftDifferences.get(differenceKey);
                const differenceClass = differenceType ? `shift-${differenceType}` : '';
                
                matrixHTML += `<div id="${shiftCellId}" class="matrix-cell shift-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isSaturday ? 'saturday' : ''} ${isOffShift ? 'off-shift' : ''} ${differenceClass}" style="background-color: ${shiftColor} !important;" data-employee-id="${employee.id}" data-date="${dateString}" data-shift-id="${schedule ? schedule.shiftId : ''}">
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

            const shiftCellTime = performance.now() - shiftCellStart;
            const htmlTime = performance.now() - htmlStart;
            
            // Log detailed timing for first few employees
            if (empIndex < 3) {
                console.log(`⚡ Employee ${empIndex + 1} (${employee.name}): Shift cells: ${shiftCellTime.toFixed(2)}ms, HTML total: ${htmlTime.toFixed(2)}ms`);
            }
        });

        const employeeLoopTime = performance.now() - employeeLoopStart;
        console.log(`⚡ Employee processing loop completed in ${employeeLoopTime.toFixed(2)}ms for ${filteredEmployees.length} employees`);

        // Add empty state if no employees
        if (this.workforceManager.employees.length === 0) {
            matrixHTML += `
                <div class="matrix-cell empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px; border: none;">
                    <i class="fas fa-users" style="font-size: 48px; color: #cbd5e0; margin-bottom: 16px;"></i>
                    <h3 style="color: #718096; margin: 0; font-size: 18px; font-weight: 500;">No Employees Found</h3>
                </div>
            `;
        }

        const domStart = performance.now();
        matrixContainer.innerHTML = matrixHTML;
        const domTime = performance.now() - domStart;
        console.log(`⚡ DOM manipulation completed in ${domTime.toFixed(2)}ms`);

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

        // Render the worker count summary below the calendar (reuse pre-calculated data)
        const workerSummaryStart = performance.now();
        this.renderWorkerCountSummaryOptimized(weekDates, scheduleMap, workerCountData);
        const workerSummaryTime = performance.now() - workerSummaryStart;
        console.log(`⚡ Worker count summary completed in ${workerSummaryTime.toFixed(2)}ms`);

        // Bind drag scroll functionality after rendering
        setTimeout(() => {
            const dragScrollStart = performance.now();
            this.workforceManager.uiManager.bindDragScroll();
            const dragScrollTime = performance.now() - dragScrollStart;
            console.log(`⚡ Drag scroll binding completed in ${dragScrollTime.toFixed(2)}ms`);
        }, 100);

        // Update staffing issues panel
        const staffingStart = performance.now();
        this.updateStaffingIssuesPanel();
        const staffingTime = performance.now() - staffingStart;
        console.log(`⚡ Staffing issues panel completed in ${staffingTime.toFixed(2)}ms`);

        // Update column visibility based on toggle states
        setTimeout(() => {
            const visibilityStart = performance.now();
            this.workforceManager.filterManager.updateColumnVisibility();
            const visibilityTime = performance.now() - visibilityStart;
            console.log(`⚡ Column visibility update completed in ${visibilityTime.toFixed(2)}ms`);
        }, 50);

        // Bind right-click events to shift cells for editing
        const eventsStart = performance.now();
        this.workforceManager.uiManager.bindShiftCellEvents();
        const eventsTime = performance.now() - eventsStart;
        console.log(`⚡ Shift cell events binding completed in ${eventsTime.toFixed(2)}ms`);
        
        const renderTime = performance.now() - renderStartTime;
        console.log(`📅 Calendar matrix rendered in ${renderTime.toFixed(2)}ms`);
    }

    // Original method kept for backward compatibility
    renderWorkerCountSummary() {
        console.log('=== RENDERING WORKER COUNT SUMMARY ===');

        const summaryContainer = document.getElementById('workerCountSummary');
        if (!summaryContainer) {
            console.error('Worker count summary container not found');
            return;
        }

        // Get time interval from localStorage or use 48 as default
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;

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

        // Call the optimized version
        this.renderWorkerCountSummaryOptimized(weekDates, scheduleMap);
    }

    // Pre-calculate worker count data to avoid expensive nested loops during rendering
    preCalculateWorkerCounts(weekDates, scheduleMap) {
        const data = {
            amgrDayCounts: [],
            pctDayCounts: [],
            usDayCounts: [],
            rnDayCounts: [],
            chargeDayCounts: [],
            amgrNightCounts: [],
            pctNightCounts: [],
            usNightCounts: [],
            rnNightCounts: [],
            chargeNightCounts: [],
            totalAMGRDayMatches: 0,
            totalPCTDayMatches: 0,
            totalUSDayMatches: 0,
            totalRNDayMatches: 0,
            totalChargeDayMatches: 0,
            totalAMGRNightMatches: 0,
            totalPCTNightMatches: 0,
            totalUSNightMatches: 0,
            totalRNNightMatches: 0,
            totalChargeNightMatches: 0
        };

        // Pre-calculate all counts in a single pass
        weekDates.forEach(date => {
            const dateString = formatDateString(date);
            
            // Initialize counts for this date
            let amgrDayCount = 0, pctDayCount = 0, usDayCount = 0, rnDayCount = 0, chargeDayCount = 0;
            let amgrNightCount = 0, pctNightCount = 0, usNightCount = 0, rnNightCount = 0, chargeNightCount = 0;

            // Count employees for each role type
            this.workforceManager.employees.forEach(employee => {
                const role = this.workforceManager.jobRoles.find(r => r.id === employee.roleId);
                const roleName = role ? role.name : '';
                const shiftType = employee.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(employee);

                const isDayShift = shiftType === 'DAY' || shiftType === 'Day' || this.workforceManager.employeeManager.isDayShift(shiftType);
                const isNightShift = shiftType === 'NIGHT' || shiftType === 'Night' || this.workforceManager.employeeManager.isNightShift(shiftType);

                if (isDayShift) {
                    const scheduleKey = `${employee.id}_${dateString}`;
                    const schedule = scheduleMap.get(scheduleKey);
                    if (schedule) {
                        const shiftTypeObj = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                        const shiftName = shiftTypeObj ? shiftTypeObj.name : '';

                        const isAMGR = roleName.toUpperCase().includes('AMGR') || roleName.toUpperCase().includes('MANAGER') || roleName === 'AMGR';
                        const isANMShift = shiftName.startsWith('ANM') || shiftName.toUpperCase().startsWith('ANM') || shiftName.includes('ANM');
                        if (isAMGR && isANMShift) { amgrDayCount++; data.totalAMGRDayMatches++; }

                        const isPCT = roleName.toUpperCase().includes('PCT') || roleName === 'PCT';
                        const isPCTShift = shiftName.startsWith('PCT') || shiftName.toUpperCase().startsWith('PCT') || shiftName.includes('PCT');
                        if (isPCT && isPCTShift) { pctDayCount++; data.totalPCTDayMatches++; }

                        const isUS = roleName.toUpperCase().includes('US') || roleName === 'US';
                        const isUSShift = shiftName.startsWith('US') || shiftName.toUpperCase().startsWith('US') || shiftName.includes('US');
                        if (isUS && isUSShift) { usDayCount++; data.totalUSDayMatches++; }

                        const isRN = roleName.toUpperCase().includes('RN') || roleName === 'RN';
                        const isRNShift = shiftName.startsWith('RN') || shiftName.toUpperCase().startsWith('RN') || shiftName.includes('RN');
                        if (isRN && isRNShift) { rnDayCount++; data.totalRNDayMatches++; }

                        const isCharge = roleName.toUpperCase().includes('CHARGE') || roleName === 'CHARGE';
                        const isChargeShift = shiftName.toUpperCase().includes('CHARGE');
                        if (isCharge && isChargeShift) { chargeDayCount++; data.totalChargeDayMatches++; }
                    }
                }

                if (isNightShift) {
                    const scheduleKey = `${employee.id}_${dateString}`;
                    const schedule = scheduleMap.get(scheduleKey);
                    if (schedule) {
                        const shiftTypeObj = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                        const shiftName = shiftTypeObj ? shiftTypeObj.name : '';

                        const isAMGR = roleName.toUpperCase().includes('AMGR') || roleName.toUpperCase().includes('MANAGER') || roleName === 'AMGR';
                        const isANMShift = shiftName.startsWith('ANM') || shiftName.toUpperCase().startsWith('ANM') || shiftName.includes('ANM');
                        if (isAMGR && isANMShift) { amgrNightCount++; data.totalAMGRNightMatches++; }

                        const isPCT = roleName.toUpperCase().includes('PCT') || roleName === 'PCT';
                        const isPCTShift = shiftName.startsWith('PCT') || shiftName.toUpperCase().startsWith('PCT') || shiftName.includes('PCT');
                        if (isPCT && isPCTShift) { pctNightCount++; data.totalPCTNightMatches++; }

                        const isUS = roleName.toUpperCase().includes('US') || roleName === 'US';
                        const isUSShift = shiftName.startsWith('US') || shiftName.toUpperCase().startsWith('US') || shiftName.includes('US');
                        if (isUS && isUSShift) { usNightCount++; data.totalUSNightMatches++; }

                        const isRN = roleName.toUpperCase().includes('RN') || roleName === 'RN';
                        const isRNShift = shiftName.startsWith('RN') || shiftName.toUpperCase().startsWith('RN') || shiftName.includes('RN');
                        if (isRN && isRNShift) { rnNightCount++; data.totalRNNightMatches++; }

                        const isCharge = roleName.toUpperCase().includes('CHARGE') || roleName === 'CHARGE';
                        const isChargeShift = shiftName.toUpperCase().includes('CHARGE');
                        if (isCharge && isChargeShift) { chargeNightCount++; data.totalChargeNightMatches++; }
                    }
                }
            });

            // Store counts for this date
            data.amgrDayCounts.push(amgrDayCount);
            data.pctDayCounts.push(pctDayCount);
            data.usDayCounts.push(usDayCount);
            data.rnDayCounts.push(rnDayCount);
            data.chargeDayCounts.push(chargeDayCount);
            data.amgrNightCounts.push(amgrNightCount);
            data.pctNightCounts.push(pctNightCount);
            data.usNightCounts.push(usNightCount);
            data.rnNightCounts.push(rnNightCount);
            data.chargeNightCounts.push(chargeNightCount);
        });

        return data;
    }

    // Optimized version that reuses pre-calculated data from main calendar
    renderWorkerCountSummaryOptimized(weekDates, scheduleMap, workerCountData) {
        const summaryContainer = document.getElementById('workerCountSummary');
        if (!summaryContainer) {
            console.error('Worker count summary container not found');
            return;
        }

        // Generate summary HTML using pre-calculated data
        let summaryHTML = '';
        
        // Helper function to generate count cells with Saturday borders
        const generateCountCells = (counts) => {
            return counts.map((count, index) => {
                const date = weekDates[index];
                const isSaturday = date.getDay() === 6;
                return `<div class="summary-cell count-cell ${isSaturday ? 'saturday' : ''}">${count}</div>`;
            }).join('');
        };
        
        // Use pre-calculated data instead of expensive calculations
        const {
            amgrDayCounts,
            pctDayCounts,
            usDayCounts,
            rnDayCounts,
            chargeDayCounts,
            amgrNightCounts,
            pctNightCounts,
            usNightCounts,
            rnNightCounts,
            chargeNightCounts,
            totalAMGRDayMatches,
            totalPCTDayMatches,
            totalUSDayMatches,
            totalRNDayMatches,
            totalChargeDayMatches,
            totalAMGRNightMatches,
            totalPCTNightMatches,
            totalUSNightMatches,
            totalRNNightMatches,
            totalChargeNightMatches
        } = workerCountData;

        // Data is already pre-calculated, no need for expensive loops!
        // The pre-calculated data is already available in the workerCountData object

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
                <div class="summary-row">
                    <div class="summary-cell summary-label">AMGR</div>
                    ${generateCountCells(amgrDayCounts)}
                </div>
                <div class="summary-row">
                    <div class="summary-cell summary-label">PCT</div>
                    ${generateCountCells(pctDayCounts)}
                </div>
                <div class="summary-row">
                    <div class="summary-cell summary-label">US</div>
                    ${generateCountCells(usDayCounts)}
                </div>
                <div class="summary-row">
                    <div class="summary-cell summary-label">RN</div>
                    ${generateCountCells(rnDayCounts)}
                </div>
                <div class="summary-row">
                    <div class="summary-cell summary-label">CHARGE</div>
                    ${generateCountCells(chargeDayCounts)}
                </div>
            `;
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
                <div class="summary-row">
                    <div class="summary-cell summary-label">AMGR</div>
                    ${generateCountCells(amgrNightCounts)}
                </div>
                <div class="summary-row">
                    <div class="summary-cell summary-label">PCT</div>
                    ${generateCountCells(pctNightCounts)}
                </div>
                <div class="summary-row">
                    <div class="summary-cell summary-label">US</div>
                    ${generateCountCells(usNightCounts)}
                </div>
                <div class="summary-row">
                    <div class="summary-cell summary-label">RN</div>
                    ${generateCountCells(rnNightCounts)}
                </div>
                <div class="summary-row">
                    <div class="summary-cell summary-label">CHARGE</div>
                    ${generateCountCells(chargeNightCounts)}
                </div>
            `;
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

    // Calculate MOV count by comparing active calendar vs saved snapshot
    calculateMoveCount(employee, weekDates, scheduleMap) {
        // Get saved snapshot
        const snapshot = this.workforceManager.snapshotManager ? this.workforceManager.snapshotManager.loadSnapshot() : null;
        if (!snapshot) {
            return 0; // No snapshot to compare against
        }

        let differences = 0;

        weekDates.forEach((date) => {
            const dateString = formatDateString(date);
            
            // Get active schedule
            const activeScheduleKey = `${employee.id}_${dateString}`;
            const activeSchedule = scheduleMap.get(activeScheduleKey);
            const activeShiftId = activeSchedule ? activeSchedule.shiftId : null;
            
            // Get snapshot schedule
            const snapshotScheduleKey = `${employee.id}_${dateString}`;
            const snapshotSchedule = snapshot.schedules.find(s => s.employeeId === employee.id && s.date === dateString);
            const snapshotShiftId = snapshotSchedule ? snapshotSchedule.shiftId : null;
            
            // Compare and count differences
            if (activeShiftId !== snapshotShiftId) {
                differences++;
            }
        });

        return differences;
    }

    // Calculate shift differences for visual highlighting
    calculateShiftDifferences(employee, weekDates, scheduleMap) {
        const snapshot = this.workforceManager.snapshotManager ? this.workforceManager.snapshotManager.loadSnapshot() : null;
        if (!snapshot) {
            return new Map(); // No snapshot to compare against
        }

        const differences = new Map();
        
        weekDates.forEach((date) => {
            const dateString = formatDateString(date);
            
            // Get active schedule
            const activeScheduleKey = `${employee.id}_${dateString}`;
            const activeSchedule = scheduleMap.get(activeScheduleKey);
            const activeShiftId = activeSchedule ? activeSchedule.shiftId : null;
            
            // Get snapshot schedule
            const snapshotScheduleKey = `${employee.id}_${dateString}`;
            const snapshotSchedule = snapshot.schedules.find(s => s.employeeId === employee.id && s.date === dateString);
            const snapshotShiftId = snapshotSchedule ? snapshotSchedule.shiftId : null;
            
            // Compare and store differences
            if (activeShiftId !== snapshotShiftId) {
                differences.set(`${employee.id}_${dateString}`, 'changed');
            }
        });
        
        return differences;
    }

    // Optimized version that takes snapshot as parameter (avoids repeated snapshot loading)
    calculateMoveCountOptimized(employee, weekDates, scheduleMap, snapshot) {
        if (!snapshot) {
            return 0; // No snapshot to compare against
        }

        let differences = 0;

        weekDates.forEach((date) => {
            const dateString = formatDateString(date);
            
            // Get active schedule
            const activeScheduleKey = `${employee.id}_${dateString}`;
            const activeSchedule = scheduleMap.get(activeScheduleKey);
            const activeShiftId = activeSchedule ? activeSchedule.shiftId : null;
            
            // Get snapshot schedule
            const snapshotScheduleKey = `${employee.id}_${dateString}`;
            const snapshotSchedule = snapshot.schedules.find(s => s.employeeId === employee.id && s.date === dateString);
            const snapshotShiftId = snapshotSchedule ? snapshotSchedule.shiftId : null;
            
            // Compare and count differences
            if (activeShiftId !== snapshotShiftId) {
                differences++;
            }
        });

        return differences;
    }

    // Optimized version that takes snapshot as parameter (avoids repeated snapshot loading)
    calculateShiftDifferencesOptimized(employee, weekDates, scheduleMap, snapshot) {
        if (!snapshot) {
            return new Map(); // No snapshot to compare against
        }

        const differences = new Map();
        
        weekDates.forEach((date) => {
            const dateString = formatDateString(date);
            
            // Get active schedule
            const activeScheduleKey = `${employee.id}_${dateString}`;
            const activeSchedule = scheduleMap.get(activeScheduleKey);
            const activeShiftId = activeSchedule ? activeSchedule.shiftId : null;
            
            // Get snapshot schedule
            const snapshotScheduleKey = `${employee.id}_${dateString}`;
            const snapshotSchedule = snapshot.schedules.find(s => s.employeeId === employee.id && s.date === dateString);
            const snapshotShiftId = snapshotSchedule ? snapshotSchedule.shiftId : null;
            
            // Compare and store differences
            if (activeShiftId !== snapshotShiftId) {
                differences.set(dateString, 'changed');
            }
        });

        return differences;
    }
}

// Export the class
window.CalendarRenderer = CalendarRenderer;
