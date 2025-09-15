// Calendar Renderer Module
// Handles rendering of calendar view and worker count summary

class CalendarRenderer {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.lastUpdateTime = 0;
        this.updateDebounceDelay = 100; // 100ms debounce
        
        // Bind issue filter events when calendar renderer is created
        setTimeout(() => {
            this.bindIssueFilterEvents();
        }, 100);
    }

    // Analyze staffing levels and return issues using rule engine
    analyzeStaffingIssues() {
        // Use rule engine if available, otherwise fall back to basic analysis
        if (this.workforceManager.ruleEngine && this.workforceManager.ruleEngine.getRules().length > 0) {
            return this.analyzeStaffingIssuesWithRules();
        } else {
            return this.analyzeStaffingIssuesBasic();
        }
    }

    // Analyze staffing issues using custom rules
    analyzeStaffingIssuesWithRules() {
        const violations = this.workforceManager.ruleEngine.evaluateRules();
        
        // Debug logging removed to clean up console
        
        // Group violations by date
        const issuesByDate = new Map();
        
        violations.forEach(violation => {
            const dateKey = violation.date;
            
            if (!issuesByDate.has(dateKey)) {
                issuesByDate.set(dateKey, {
                    date: violation.date,
                    dateObj: violation.dateObj,
                    issues: [],
                    totalStaff: 0
                });
            }
            
            // Convert rule violation to staffing issue format
            // Handle both old format (nested violation) and new format (flat structure)
            const issue = {
                type: this.mapViolationType(violation),
                rule: violation.ruleName,
                message: violation.message || (violation.violation && violation.violation.message) || 'Rule violation',
                severity: violation.severity || 'error', // Default to 'error' if no severity specified
                current: violation.actualValue || (violation.violation && violation.violation.actualValue) || 0,
                expected: violation.expectedValue || (violation.violation && violation.violation.expectedValue) || 0,
                difference: Math.abs((violation.actualValue || (violation.violation && violation.violation.actualValue) || 0) - 
                                   (violation.expectedValue || (violation.violation && violation.violation.expectedValue) || 0))
            };
            
            // Add employee info if available
            if (violation.employeeName) {
                issue.employee = violation.employeeName;
            }
            
            issuesByDate.get(dateKey).issues.push(issue);
        });
        
        // Calculate total staff for each date (optimized - create scheduleMap once)
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        const calendarStartDate = new Date(this.workforceManager.currentWeekStart.getFullYear(), this.workforceManager.currentWeekStart.getMonth(), this.workforceManager.currentWeekStart.getDate());
        
        // Create scheduleMap once for all dates
        const scheduleMap = new Map();
        this.workforceManager.schedules.forEach(schedule => {
            const key = `${schedule.employeeId}_${schedule.date}`;
            scheduleMap.set(key, schedule);
        });
        
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            const dateString = formatDateString(date);
            
            if (issuesByDate.has(dateString)) {
                let totalStaff = 0;
                this.workforceManager.employees.forEach(employee => {
                    const scheduleKey = `${employee.id}_${dateString}`;
                    if (scheduleMap.has(scheduleKey)) {
                        totalStaff++;
                    }
                });
                
                issuesByDate.get(dateString).totalStaff = totalStaff;
            }
        }
        
        const issues = Array.from(issuesByDate.values());
        issues.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Debug logging removed to clean up console
        
        return issues;
    }

    // Map rule violation to staffing issue type
    mapViolationType(violation) {
        // Handle both old format (nested violation) and new format (flat structure)
        const actualValue = violation.actualValue || (violation.violation && violation.violation.actualValue) || 0;
        const expectedValue = violation.expectedValue || (violation.violation && violation.violation.expectedValue) || 0;
        
        if (actualValue < expectedValue) {
            return 'under-staffed';
        } else if (actualValue > expectedValue) {
            return 'over-staffed';
        } else {
            return 'rule-violation';
        }
    }

    // Get icon for severity level
    getSeverityIcon(severity) {
        switch (severity) {
            case 'error':
                return 'fas fa-exclamation-circle';
            case 'warning':
                return 'fas fa-exclamation-triangle';
            case 'info':
                return 'fas fa-info-circle';
            default:
                return 'fas fa-question-circle';
        }
    }

    // Fallback basic staffing analysis (original logic)
    analyzeStaffingIssuesBasic() {
        
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
        
        // Get active filters
        const activeFilters = this.getActiveIssueFilters();
        
        // Filter issues based on active filters
        const filteredIssues = this.filterIssuesBySeverity(issues, activeFilters);


        if (filteredIssues.length === 0) {
            // Show "no issues" message
            issuesList.innerHTML = '';
            if (issues.length === 0) {
                noIssues.innerHTML = '<i class="fas fa-check-circle"></i><p>All shifts are properly staffed!</p>';
            } else {
                noIssues.innerHTML = '<i class="fas fa-filter"></i><p>No issues match the selected filters.</p>';
            }
            noIssues.style.display = 'block';
            // Remove has-issues class when no issues are displayed (green by default via CSS)
            panel.classList.remove('has-issues');
        } else {
            // Show issues
            noIssues.style.display = 'none';
            // Add has-issues class when issues are displayed
            panel.classList.add('has-issues');

            const issuesHTML = filteredIssues.map(issue => {
                // Handle cases where dateObj might be undefined or null
                let dateFormatted;
                
                if (issue.dateObj && typeof issue.dateObj.toLocaleDateString === 'function') {
                    dateFormatted = issue.dateObj.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    });
                } else if (issue.date === 'Period') {
                    // For period-based violations, show "Period"
                    dateFormatted = 'Period';
                } else {
                    // Fallback to date string or current date
                    const dateStr = issue.date || new Date().toISOString().split('T')[0];
                    const fallbackDate = new Date(dateStr);
                    dateFormatted = fallbackDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                    });
                }

                const issueDetails = issue.issues.map(issueDetail => {
                    // Handle rule-based issues
                    if (issueDetail.rule) {
                        const severityIcon = this.getSeverityIcon(issueDetail.severity);
                        const severityClass = `severity-${issueDetail.severity}`;
                        
                        return `
                            <div class="issue-item rule-violation ${severityClass}">
                                <div class="issue-header">
                                    <i class="${severityIcon}"></i>
                                    <span class="issue-date">${dateFormatted}</span>
                                    <span class="rule-name">${issueDetail.rule}</span>
                                    <span class="severity-badge ${severityClass}">${issueDetail.severity.toUpperCase()}</span>
                                </div>
                                <div class="issue-details">
                                    ${issueDetail.message}
                                </div>
                            </div>
                        `;
                    }
                    
                    // Handle basic staffing issues (fallback)
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

        // Show the panel if we're on the calendar view
        const calendarView = document.getElementById('calendarView');
        if (calendarView && calendarView.classList.contains('active')) {
            panel.style.display = 'block';
        }
    }

    // Get active issue filters from the UI
    getActiveIssueFilters() {
        const filters = [];
        const errorBtn = document.getElementById('filterErrors');
        const warningBtn = document.getElementById('filterWarnings');
        const infoBtn = document.getElementById('filterInfo');
        
        // Debug logging removed to clean up console
        
        if (errorBtn && errorBtn.classList.contains('active')) {
            filters.push('error');
        }
        if (warningBtn && warningBtn.classList.contains('active')) {
            filters.push('warning');
        }
        if (infoBtn && infoBtn.classList.contains('active')) {
            filters.push('info');
        }
        
        return filters;
    }

    // Filter issues by severity level
    filterIssuesBySeverity(issues, activeFilters) {
        // First, filter out any dates that have no issues at all
        const issuesWithContent = issues.filter(issue => issue.issues && issue.issues.length > 0);

        if (activeFilters.length === 0) {
            return []; // Show no issues when no filters are active
        }
        
        // Filter individual issues within each date, not the dates themselves
        const filtered = issuesWithContent.map(issue => {
            const filteredIssues = issue.issues.filter(issueDetail => {
                const severity = issueDetail.severity || 'info';
                return activeFilters.includes(severity);
            });
            
            // Return the date with only the filtered issues
            return {
                ...issue,
                issues: filteredIssues
            };
        }).filter(issue => issue.issues.length > 0); // Only keep dates that have filtered issues
        
        return filtered;
    }

    // Bind issue filter button events
    bindIssueFilterEvents() {
        const errorBtn = document.getElementById('filterErrors');
        const warningBtn = document.getElementById('filterWarnings');
        const infoBtn = document.getElementById('filterInfo');
        
        if (errorBtn) {
            errorBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                event.stopImmediatePropagation();
                event.preventDefault();
                
                errorBtn.classList.toggle('active');
                this.updateStaffingIssuesPanel();
            }, true); // Use capture phase
        }
        
        if (warningBtn) {
            warningBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                event.stopImmediatePropagation();
                event.preventDefault();
                warningBtn.classList.toggle('active');
                this.updateStaffingIssuesPanel();
            }, true); // Use capture phase
        }
        
        if (infoBtn) {
            infoBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                event.stopImmediatePropagation();
                event.preventDefault();
                infoBtn.classList.toggle('active');
                this.updateStaffingIssuesPanel();
            }, true); // Use capture phase
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

        console.log('🎨 CalendarRenderer.renderScheduleMatrix called', {
            user: this.workforceManager.authManager?.user?.email,
            isAdmin: this.workforceManager.authManager?.adminEmails?.has(this.workforceManager.authManager?.user?.email?.toLowerCase()),
            employeesCount: this.workforceManager.employees.length,
            schedulesCount: this.workforceManager.schedules.length,
            matrixContainerExists: !!matrixContainer
        });

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
        // Use cached snapshot to avoid repeated loading
        let snapshot = null;
        if (this.workforceManager.snapshotManager) {
            try {
                // Check if we already have a cached snapshot from recent operations
                if (this.workforceManager.snapshotManager.cache.has(this.workforceManager.snapshotManager.snapshotKey)) {
                    snapshot = this.workforceManager.snapshotManager.cache.get(this.workforceManager.snapshotManager.snapshotKey);
                } else {
                    snapshot = this.workforceManager.snapshotManager.loadSnapshotSync();
                }
            } catch (error) {
                console.error('❌ Error loading snapshot synchronously:', error);
                snapshot = null;
            }
        }

        // If no snapshot exists but we have schedules, create one for change tracking
        if (!snapshot && this.workforceManager.schedules.length > 0 && this.workforceManager.snapshotManager) {
            try {
                // Create snapshot synchronously for immediate use
                const newSnapshot = {
                    createdAt: new Date().toISOString(),
                    employees: JSON.parse(JSON.stringify(this.workforceManager.employees || [])),
                    shiftTypes: JSON.parse(JSON.stringify(this.workforceManager.shiftTypes || [])),
                    jobRoles: JSON.parse(JSON.stringify(this.workforceManager.jobRoles || [])),
                    schedules: JSON.parse(JSON.stringify(this.workforceManager.schedules || [])),
                    currentWeekStart: this.workforceManager.currentWeekStart ? 
                        this.workforceManager.currentWeekStart.toISOString().split('T')[0] : null
                };
                localStorage.setItem('workforce_schedule_snapshot_v1', JSON.stringify(newSnapshot));
                snapshot = newSnapshot;
            } catch (error) {
                console.error('❌ Failed to create snapshot for change tracking:', error);
            }
        }

        if (!snapshot) {
            console.warn('⚠️ No snapshot available for change tracking');
        }

        // Pre-calculate move counts and shift differences for all employees (major performance optimization)
        const employeeMoveCounts = new Map();
        const employeeShiftDifferences = new Map();
        
        if (snapshot && snapshot.schedules && snapshot.schedules.length > 0) {
            const preCalcStart = performance.now();
            
            // Pre-calculate snapshot lookup map for faster comparisons
            const snapshotMap = new Map();
            snapshot.schedules.forEach(schedule => {
                const key = `${schedule.employeeId}_${schedule.date}`;
                snapshotMap.set(key, schedule);
            });
            
            this.workforceManager.employees.forEach(employee => {
                employeeMoveCounts.set(employee.id, this.calculateMoveCountUltraOptimized(employee, weekDates, scheduleMap, snapshotMap));
                const differences = this.calculateShiftDifferencesUltraOptimized(employee, weekDates, scheduleMap, snapshotMap);
                employeeShiftDifferences.set(employee.id, differences);
            });
            
        }

        // Pre-calculate worker count summary data (major performance optimization)
        const workerCountData = this.preCalculateWorkerCounts(weekDates, scheduleMap);
        
        // Store the summary data for rule engine access
        this.workerCountData = workerCountData;
        this.currentWeekDates = weekDates;

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
        const filteredEmployees = this.workforceManager.filterManager.getSortedEmployees(
            this.workforceManager.employees.filter(employee => this.workforceManager.filterManager.shouldShowEmployee(employee))
        );

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

            // Add shift cells for each date (another expensive loop - 48 dates per employee)
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
                } else if (isWeekend) {
                    // For weekend empty cells, use a subtle weekend color
                    shiftColor = 'rgba(255,255,255,0.95)';
                }


                const isOffShift = shiftName === 'Off' || shiftName === '';
                const shiftCellId = `shift-${employee.id}-${dateString}`;
                
                // Check for shift differences and apply appropriate class
                const differenceType = shiftDifferences.get(dateString);
                const differenceClass = differenceType ? `shift-${differenceType}` : '';
                
                // Build the class list
                const classList = `matrix-cell shift-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isSaturday ? 'saturday' : ''} ${isOffShift ? 'off-shift' : ''} ${differenceClass}`.trim();
                
                // Always use inline background color to preserve shift colors
                const inlineStyle = `style="background-color: ${shiftColor};"`;
                
                matrixHTML += `<div id="${shiftCellId}" class="${classList}" ${inlineStyle} data-employee-id="${employee.id}" data-date="${dateString}" data-shift-id="${schedule ? schedule.shiftId : ''}">
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

        // Render the worker count summary below the calendar (use pre-calculated data)
        this.renderWorkerCountSummaryWithData(weekDates, workerCountData);

        // Note: Drag scroll functionality is bound once during initialization, no need to rebind after every render

        // Update staffing issues panel
        this.updateStaffingIssuesPanel();

        // Update column visibility based on toggle states
        setTimeout(() => {
            this.workforceManager.filterManager.updateColumnVisibility();
        }, 50);

        // Bind right-click events to shift cells for editing
        this.workforceManager.uiManager.bindShiftCellEvents();
        
    }

    // Pre-calculate worker count data for all dates and role types (major performance optimization)
    preCalculateWorkerCounts(weekDates, scheduleMap) {
        const data = {
            amgrDayCounts: [],
            pctDayCounts: [],
            usDayCounts: [],
            rnDayCounts: [],
            chargeDayCounts: [],
            midDayCounts: [],
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
            totalMIDDayMatches: 0,
            totalAMGRNightMatches: 0,
            totalPCTNightMatches: 0,
            totalUSNightMatches: 0,
            totalRNNightMatches: 0,
            totalChargeNightMatches: 0
        };

        // Initialize arrays for each date
        weekDates.forEach(() => {
            data.amgrDayCounts.push(0);
            data.pctDayCounts.push(0);
            data.usDayCounts.push(0);
            data.rnDayCounts.push(0);
            data.chargeDayCounts.push(0);
            data.midDayCounts.push(0);
            data.amgrNightCounts.push(0);
            data.pctNightCounts.push(0);
            data.usNightCounts.push(0);
            data.rnNightCounts.push(0);
            data.chargeNightCounts.push(0);
        });

        // Process each employee once and calculate counts for all dates
        let processedEmployees = 0;
        let dayShiftEmployees = 0;
        let nightShiftEmployees = 0;
        
        this.workforceManager.employees.forEach(employee => {
            const role = this.workforceManager.jobRoles.find(r => r.id === employee.roleId);
            const roleName = role ? role.name : '';
            const shiftType = employee.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(employee);

            const isDayShift = shiftType === 'DAY' || shiftType === 'Day' || this.workforceManager.employeeManager.isDayShift(shiftType);
            const isNightShift = shiftType === 'NIGHT' || shiftType === 'Night' || this.workforceManager.employeeManager.isNightShift(shiftType);
            
            processedEmployees++;
            if (isDayShift) dayShiftEmployees++;
            if (isNightShift) nightShiftEmployees++;

            // Process each date for this employee
            weekDates.forEach((date, dateIndex) => {
                const dateString = formatDateString(date);
                const scheduleKey = `${employee.id}_${dateString}`;
                const schedule = scheduleMap.get(scheduleKey);

                if (schedule) {
                    const shiftTypeObj = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                    const shiftName = shiftTypeObj ? shiftTypeObj.name : '';

                    // Day shift processing - use original specific patterns
                    if (isDayShift) {
                        // Check AMGR employees working ANM* shifts
                        const isAMGR = roleName.toUpperCase().includes('AMGR') || roleName.toUpperCase().includes('MANAGER') || roleName === 'AMGR';
                        const isANMShift = shiftName.startsWith('ANM') || shiftName.toUpperCase().startsWith('ANM') || shiftName.includes('ANM');
                        
                        if (isAMGR && shiftName && isANMShift) {
                            data.amgrDayCounts[dateIndex]++;
                            data.totalAMGRDayMatches++;
                        }

                        // Check PCT employees working 6t* shifts
                        const isPCT = roleName.toUpperCase().includes('PCT') || roleName.toUpperCase().includes('PHLEBOTOMIST') || roleName === 'PCT';
                        const is6tShift = shiftName.startsWith('6t') || shiftName.toUpperCase().startsWith('6T') || shiftName.includes('6t') || shiftName.includes('6T');
                        
                        if (isPCT && shiftName && is6tShift) {
                            data.pctDayCounts[dateIndex]++;
                            data.totalPCTDayMatches++;
                        }

                        // Check US employees working 6w* shifts
                        const isUS = roleName.toUpperCase().includes('US') || roleName.toUpperCase().includes('ULTRASOUND') || roleName === 'US';
                        const is6wShift = shiftName.startsWith('6w') || shiftName.toUpperCase().startsWith('6W') || shiftName.includes('6w') || shiftName.includes('6W');
                        
                        if (isUS && shiftName && is6wShift) {
                            data.usDayCounts[dateIndex]++;
                            data.totalUSDayMatches++;
                        }

                        // Check RN employees working 6t* shifts only (Mid shifts now counted separately)
                        const isRN = roleName.toUpperCase().includes('RN') || roleName.toUpperCase().includes('REGISTERED NURSE') || roleName === 'RN';
                        const isRNShift = shiftName.startsWith('6t') || shiftName.toUpperCase().startsWith('6T') || shiftName.includes('6t') || shiftName.includes('6T');

                        if (isRN && shiftName && isRNShift) {
                            data.rnDayCounts[dateIndex]++;
                            data.totalRNDayMatches++;
                        }

                        // Check CHARGE employees working DAY shifts
                        const isChargeRole = roleName.toUpperCase().includes('CHARGE') || roleName.toUpperCase().includes('CHG') || roleName === 'CHARGE';
                        const isChargeShift = shiftName.includes('Charg') || shiftName.toUpperCase().includes('CHARGE') || shiftName.toLowerCase().includes('charge');
                        
                        if (isChargeRole && shiftName) {
                            data.chargeDayCounts[dateIndex]++;
                            data.totalChargeDayMatches++;
                        } else if (isChargeShift && !isChargeRole) {
                            data.chargeDayCounts[dateIndex]++;
                            data.totalChargeDayMatches++;
                        }

                        // Check MID shifts (containing Midsh or Quali)
                        const isMIDShift = shiftName.toUpperCase().includes('MIDSH') || shiftName.toUpperCase().includes('QUALI');
                        
                        if (isMIDShift && shiftName) {
                            data.midDayCounts[dateIndex]++;
                            data.totalMIDDayMatches++;
                        }
                    }

                    // Night shift processing - use original specific patterns
                    if (isNightShift) {
                        // Check AMGR employees working ANM* shifts
                        const isAMGR = roleName.toUpperCase().includes('AMGR') || roleName.toUpperCase().includes('MANAGER') || roleName === 'AMGR';
                        const isANMShift = shiftName.startsWith('ANM') || shiftName.toUpperCase().startsWith('ANM') || shiftName.includes('ANM');
                        
                        if (isAMGR && shiftName && isANMShift) {
                            data.amgrNightCounts[dateIndex]++;
                            data.totalAMGRNightMatches++;
                        }

                        // Check PCT employees working 18t* shifts (NIGHT specific)
                        const isPCT = roleName.toUpperCase().includes('PCT') || roleName.toUpperCase().includes('PHLEBOTOMIST') || roleName === 'PCT';
                        const is18tShift = shiftName.startsWith('18t') || shiftName.toUpperCase().startsWith('18T') || shiftName.includes('18t') || shiftName.includes('18T');
                        
                        if (isPCT && shiftName && is18tShift) {
                            data.pctNightCounts[dateIndex]++;
                            data.totalPCTNightMatches++;
                        }

                        // Check US employees working 18w* shifts (NIGHT specific)
                        const isUS = roleName.toUpperCase().includes('US') || roleName.toUpperCase().includes('ULTRASOUND') || roleName === 'US';
                        const is18wShift = shiftName.startsWith('18w') || shiftName.toUpperCase().startsWith('18W') || shiftName.includes('18w') || shiftName.includes('18W');
                        
                        if (isUS && shiftName && is18wShift) {
                            data.usNightCounts[dateIndex]++;
                            data.totalUSNightMatches++;
                        }

                        // Check RN employees working 18t* shifts (NIGHT specific)
                        const isRN = roleName.toUpperCase().includes('RN') || roleName.toUpperCase().includes('REGISTERED NURSE') || roleName === 'RN';
                        const isRN18tShift = shiftName.startsWith('18t') || shiftName.toUpperCase().startsWith('18T') || shiftName.includes('18t') || shiftName.includes('18T');
                        
                        if (isRN && shiftName && isRN18tShift) {
                            data.rnNightCounts[dateIndex]++;
                            data.totalRNNightMatches++;
                        }

                        // Check CHARGE employees working NIGHT shifts
                        const isChargeRole = roleName.toUpperCase().includes('CHARGE') || roleName.toUpperCase().includes('CHG') || roleName === 'CHARGE';
                        const isChargeShift = shiftName.includes('Charg') || shiftName.toUpperCase().includes('CHARGE') || shiftName.toLowerCase().includes('charge');
                        
                        if (isChargeRole && shiftName) {
                            data.chargeNightCounts[dateIndex]++;
                            data.totalChargeNightMatches++;
                        } else if (isChargeShift && !isChargeRole) {
                            data.chargeNightCounts[dateIndex]++;
                            data.totalChargeNightMatches++;
                        }
                    }
                }
            });
        });

        // Check if schedules are actually in the scheduleMap
        if (scheduleMap.size === 0) {
            console.error('❌ Schedule map is empty! This means no schedules were found.');
        }

        return data;
    }

    // Render worker count summary using pre-calculated data (ultra-fast)
    renderWorkerCountSummaryWithData(weekDates, data) {
        const summaryContainer = document.getElementById('workerCountSummary');
        if (!summaryContainer) {
            console.error('❌ Worker count summary container not found');
            return;
        }

        // Helper function to generate count cells with Saturday borders
        const generateCountCells = (counts) => {
            return counts.map((count, index) => {
                const date = weekDates[index];
                const isSaturday = date.getDay() === 6;
                return `<div class="summary-cell count-cell ${isSaturday ? 'saturday' : ''}">${count}</div>`;
            }).join('');
        };

        // Generate summary HTML using pre-calculated data - PROPER GRID ROWS
        let summaryHTML = '';

        // Check which role types should be shown based on current filters
        const shouldShowRole = (roleName) => {
            // Check if "all-roles" is active
            if (this.workforceManager.filterManager.roleFilters['all-roles']) {
                return true;
            }
            
            // Check if specific role is active
            const role = this.workforceManager.jobRoles.find(r => r.name.toUpperCase() === roleName.toUpperCase());
            if (role && this.workforceManager.filterManager.roleFilters[role.id]) {
                return true;
            }
            
            return false;
        };

        // Only show DAY section if day shift filter is enabled
        if (this.workforceManager.filterManager.shiftFilters['day']) {
            
            // DAY section header
            summaryHTML += `<div class="summary-cell summary-label" style="grid-column: 1 / -1; text-align: center; font-weight: 700; font-size: 1rem; margin-top: 2rem;">DAY Shift</div>`;
            
            // Date header row - complete row
            summaryHTML += `<div class="summary-cell summary-label">Date</div>`;
            weekDates.forEach(date => {
                const isToday = date.toDateString() === new Date().toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isSaturday = date.getDay() === 6;
                summaryHTML += `<div class="summary-cell date-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isSaturday ? 'saturday' : ''}">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>`;
            });
            // Add empty cells for count columns to complete the row
            summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            
            // AMGR row - only show if AMGR role is active
            if (shouldShowRole('AMGR')) {
                summaryHTML += `<div class="summary-cell summary-label">AMGR</div>`;
                summaryHTML += generateCountCells(data.amgrDayCounts);
                // Add empty cells for count columns to complete the row
                summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            }
            
            // PCT row - only show if PCT role is active
            if (shouldShowRole('PCT')) {
                summaryHTML += `<div class="summary-cell summary-label">PCT</div>`;
                summaryHTML += generateCountCells(data.pctDayCounts);
                // Add empty cells for count columns to complete the row
                summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            }
            
            // US row - only show if US role is active
            if (shouldShowRole('US')) {
                summaryHTML += `<div class="summary-cell summary-label">US</div>`;
                summaryHTML += generateCountCells(data.usDayCounts);
                // Add empty cells for count columns to complete the row
                summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            }
            
            // RN row - only show if RN role is active
            if (shouldShowRole('RN')) {
                summaryHTML += `<div class="summary-cell summary-label">RN</div>`;
                summaryHTML += generateCountCells(data.rnDayCounts);
                // Add empty cells for count columns to complete the row
                summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            }
            
            // CHARGE row (always visible - like in old implementation)
            summaryHTML += `<div class="summary-cell summary-label">CHARGE</div>`;
            summaryHTML += generateCountCells(data.chargeDayCounts);
            // Add empty cells for count columns to complete the row
            summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            
            // MID row (always visible - counts shifts containing Midsh or Quali)
            summaryHTML += `<div class="summary-cell summary-label">MID</div>`;
            summaryHTML += generateCountCells(data.midDayCounts);
            // Add empty cells for count columns to complete the row
            summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
        }

        // Only show NIGHT section if night shift filter is enabled
        if (this.workforceManager.filterManager.shiftFilters['night']) {
            
            // NIGHT section header
            summaryHTML += `<div class="summary-cell summary-label" style="grid-column: 1 / -1; text-align: center; font-weight: 700; font-size: 1rem; margin-top: 2rem;">NIGHT Shift</div>`;
            
            // Date header row - complete row
            summaryHTML += `<div class="summary-cell summary-label">Date</div>`;
            weekDates.forEach(date => {
                const isToday = date.toDateString() === new Date().toDateString();
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isSaturday = date.getDay() === 6;
                summaryHTML += `<div class="summary-cell date-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isSaturday ? 'saturday' : ''}">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>`;
            });
            // Add empty cells for count columns to complete the row
            summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            
            // AMGR row - only show if AMGR role is active
            if (shouldShowRole('AMGR')) {
                summaryHTML += `<div class="summary-cell summary-label">AMGR</div>`;
                summaryHTML += generateCountCells(data.amgrNightCounts);
                // Add empty cells for count columns to complete the row
                summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            }
            
            // PCT row - only show if PCT role is active
            if (shouldShowRole('PCT')) {
                summaryHTML += `<div class="summary-cell summary-label">PCT</div>`;
                summaryHTML += generateCountCells(data.pctNightCounts);
                // Add empty cells for count columns to complete the row
                summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            }
            
            // US row - only show if US role is active
            if (shouldShowRole('US')) {
                summaryHTML += `<div class="summary-cell summary-label">US</div>`;
                summaryHTML += generateCountCells(data.usNightCounts);
                // Add empty cells for count columns to complete the row
                summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            }
            
            // RN row - only show if RN role is active
            if (shouldShowRole('RN')) {
                summaryHTML += `<div class="summary-cell summary-label">RN</div>`;
                summaryHTML += generateCountCells(data.rnNightCounts);
                // Add empty cells for count columns to complete the row
                summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
            }
            
            // CHARGE row (always visible - like in old implementation)
            summaryHTML += `<div class="summary-cell summary-label">CHARGE</div>`;
            summaryHTML += generateCountCells(data.chargeNightCounts);
            // Add empty cells for count columns to complete the row
            summaryHTML += '<div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div><div class="summary-cell"></div>';
        }

        summaryContainer.innerHTML = summaryHTML;
        
        // Set up CSS grid template to match the calendar exactly
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        let gridTemplate = `250px repeat(${timeInterval}, 50px)`; // Label column + date columns
        gridTemplate += ' 40px 40px 40px 40px 40px 40px 40px'; // Fri, Sat, Sun, Vac, Req, CHA, MOV columns
        summaryContainer.style.gridTemplateColumns = gridTemplate;
        summaryContainer.style.width = 'max-content'; // Ensure container can expand
        summaryContainer.style.minWidth = '100%'; // Ensure at least container width

        // Bind drag scroll for the summary container
        setTimeout(() => this.workforceManager.uiManager.bindContainerDragScroll('.worker-count-summary-container'), 100);
    }

    // Ultra-optimized version that uses pre-calculated snapshot map (avoids repeated array searches)
    calculateMoveCountUltraOptimized(employee, weekDates, scheduleMap, snapshotMap) {
        let differences = 0;

        weekDates.forEach((date) => {
            const dateString = formatDateString(date);
            
            // Get active schedule
            const activeScheduleKey = `${employee.id}_${dateString}`;
            const activeSchedule = scheduleMap.get(activeScheduleKey);
            const activeShiftId = activeSchedule ? activeSchedule.shiftId : null;
            
            // Get snapshot schedule using pre-calculated map
            const snapshotSchedule = snapshotMap.get(activeScheduleKey);
            const snapshotShiftId = snapshotSchedule ? snapshotSchedule.shiftId : null;
            
            // Count differences
            if (activeShiftId !== snapshotShiftId) {
                differences++;
            }
        });

        // MOV count should be number of different cells / 2 rounded up
        return Math.ceil(differences / 2);
    }

    // Ultra-optimized version that uses pre-calculated snapshot map (avoids repeated array searches)
    calculateShiftDifferencesUltraOptimized(employee, weekDates, scheduleMap, snapshotMap) {
        const differences = new Map();
        
        weekDates.forEach((date) => {
            const dateString = formatDateString(date);
            
            // Get active schedule
            const activeScheduleKey = `${employee.id}_${dateString}`;
            const activeSchedule = scheduleMap.get(activeScheduleKey);
            const activeShiftId = activeSchedule ? activeSchedule.shiftId : null;
            
            // Get snapshot schedule using pre-calculated map
            const snapshotSchedule = snapshotMap.get(activeScheduleKey);
            const snapshotShiftId = snapshotSchedule ? snapshotSchedule.shiftId : null;
            
            // Store difference type
            if (activeShiftId !== snapshotShiftId) {
                if (!activeShiftId && snapshotShiftId) {
                    differences.set(dateString, 'deleted');
                } else if (activeShiftId && !snapshotShiftId) {
                    differences.set(dateString, 'new');
                } else {
                    differences.set(dateString, 'changed');
                }
            }
        });

        return differences;
    }

    /**
     * Get the current week dates for the calendar view
     * @returns {Array<Date>} Array of Date objects for the current week
     */
    getCurrentWeekDates() {
        const weekDates = [];
        const startOfWeek = new Date(this.workforceManager.currentWeekStart);

        // Ensure we start on Monday
        const dayOfWeek = startOfWeek.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday (0) to be end of previous week
        startOfWeek.setDate(startOfWeek.getDate() + mondayOffset);

        // Generate 7 days starting from Monday
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            weekDates.push(date);
        }

        return weekDates;
    }

    /**
     * Toggle shift filtering to show only changed shifts
     */
    toggleShiftFiltering(isFiltering) {
        const matrixContainer = document.getElementById('scheduleMatrix');
        if (!matrixContainer) return;

        if (isFiltering) {
            // Add filtering class to show only changed shifts
            matrixContainer.classList.add('filtering-mode');
        } else {
            // Remove filtering class to show all shifts
            matrixContainer.classList.remove('filtering-mode');
        }
    }
}

// Export the class
window.CalendarRenderer = CalendarRenderer;
