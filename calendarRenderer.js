// Calendar Renderer Module
// Handles rendering of calendar view and worker count summary

class CalendarRenderer {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        // Initialize lock state as instance variable
        this.lockState = this.loadLockState();
        this.lastUpdateTime = 0;
        this.updateDebounceDelay = 100; // 100ms debounce
        
        // Cache for matrix HTML to avoid rebuilding
        this.matrixHTMLCache = null;
        this.lastMatrixState = null;
        
        // Cache for worker count summary
        this.summaryHTMLCache = null;
        this.lastSummaryState = null;
        
        // Cache for time interval to avoid repeated localStorage access
        this.cachedTimeInterval = null;
        this.todayDateString = null;
        
        // PERFORMANCE FIX: Pre-create date formatter (10x faster than toLocaleDateString)
        this.dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
        this.weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        
        // PERFORMANCE FIX: Debounce timeout for staffing issues panel
        this.staffingIssuesTimeout = null;
        
        // Bind issue filter events when calendar renderer is created
        setTimeout(() => {
            this.bindIssueFilterEvents();
        }, 100);
    }
    
    /**
     * Debounced version of updateStaffingIssuesPanel
     * PERFORMANCE FIX: Delays rule evaluation until after render settles
     */
    updateStaffingIssuesPanelDebounced() {
        if (this.staffingIssuesTimeout) {
            clearTimeout(this.staffingIssuesTimeout);
        }
        this.staffingIssuesTimeout = setTimeout(() => {
            this.updateStaffingIssuesPanel();
        }, 150); // Update after render completes
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
        const timeInterval = this.getCachedTimeInterval();
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
        const timeInterval = this.getCachedTimeInterval();
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
                    const shiftName = shiftTypeMap.get(issueDetail.shift)?.name || issueDetail.shift;
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
     * Get cached time interval to avoid repeated localStorage access
     */
    getCachedTimeInterval() {
        if (this.cachedTimeInterval === null) {
            this.cachedTimeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        }
        return this.cachedTimeInterval;
    }

    /**
     * Get cached today's date string to avoid repeated Date object creation
     */
    getCachedTodayDateString() {
        if (!this.todayDateString) {
            this.todayDateString = new Date().toDateString();
        }
        return this.todayDateString;
    }

    /**
     * Check if we can use cached matrix HTML
     * PERFORMANCE FIX: Use direct property comparison instead of JSON.stringify
     */
    canUseCachedMatrix() {
        if (!this.matrixHTMLCache || !this.lastMatrixState) {
            return false;
        }

        const last = this.lastMatrixState;
        const fm = this.workforceManager.filterManager;
        
        // Fast direct comparisons instead of JSON.stringify
        return this.workforceManager.employees.length === last.employeeCount &&
               this.workforceManager.schedules.length === last.scheduleCount &&
               this.workforceManager.currentWeekStart?.getTime() === last.weekStartTime &&
               this.getCachedTimeInterval() === last.timeInterval &&
               (fm ? fm.lastFilterState === last.filterCacheKey : true);
    }

    /**
     * Render the schedule matrix (calendar view)
     * Creates a grid showing employees as rows and dates as columns
     * Includes shift assignments, role badges, and count summaries
     */
    renderScheduleMatrix() {
        const renderStartTime = performance.now();
        const matrixContainer = document.getElementById('scheduleMatrix');

        // Performance logging only in development
        if (window.location.hostname === 'localhost') {
            console.log('🎨 CalendarRenderer.renderScheduleMatrix called', {
                employeesCount: this.workforceManager.employees.length,
                schedulesCount: this.workforceManager.schedules.length
            });
        }

        if (!matrixContainer) {
            console.error('Schedule matrix element not found');
            return;
        }

        // Check if we can use cached matrix HTML
        if (this.canUseCachedMatrix()) {
            matrixContainer.innerHTML = this.matrixHTMLCache;
            // Still need to update summary and other elements
            const todayDateString = this.getCachedTodayDateString();
            this.renderWorkerCountSummaryWithData(this.currentWeekDates, this.workerCountData, todayDateString);
            return;
        }

        // Get time interval from localStorage or use 48 as default (cached)
        const timeInterval = this.getCachedTimeInterval();

        // Use the configured start date (from localStorage or default)
        // Create a new date object to avoid reference issues
        const calendarStartDate = new Date(this.workforceManager.currentWeekStart.getFullYear(), this.workforceManager.currentWeekStart.getMonth(), this.workforceManager.currentWeekStart.getDate());

        // Generate dates starting from the selected start date (same as sample data)
        // OPTIMIZATION: Pre-calculate date info ONCE instead of per-cell
        const weekDates = [];
        const dateInfoCache = []; // Cache date calculations
        
        // PERFORMANCE FIX: Use timestamp comparison instead of slow toDateString()
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();
        
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            weekDates.push(date);
            
            // Pre-calculate everything we need per date (avoids repeated calculations per employee)
            const dayOfWeek = date.getDay();
            // PERFORMANCE FIX: Fast date comparison using year/month/day
            const isToday = date.getFullYear() === todayYear && 
                           date.getMonth() === todayMonth && 
                           date.getDate() === todayDate;
            
            dateInfoCache.push({
                date: date,
                dateString: formatDateString(date),
                dayOfWeek: dayOfWeek,
                isToday: isToday,
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
                isSaturday: dayOfWeek === 6,
                isFriday: dayOfWeek === 5,
                isSunday: dayOfWeek === 0,
                displayString: this.dateFormatter.format(date)
            });
        }

        // Create schedule lookup map for quick access
        const scheduleMap = new Map();
        this.workforceManager.schedules.forEach(schedule => {
            const key = `${schedule.employeeId}_${schedule.date}`;
            scheduleMap.set(key, schedule);
        });

        // Create shift type lookup map for performance optimization
        const shiftTypeMap = new Map();
        this.workforceManager.shiftTypes.forEach(shiftType => {
            shiftTypeMap.set(shiftType.id, shiftType);
        });

        // Create role lookup map for performance optimization
        const roleMap = new Map();
        this.workforceManager.jobRoles.forEach(role => {
            roleMap.set(role.id, role);
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

        // If no snapshot exists but we have schedules, defer snapshot creation to avoid blocking render
        // PERFORMANCE FIX: Create snapshot asynchronously after render completes
        if (!snapshot && this.workforceManager.schedules.length > 0 && this.workforceManager.snapshotManager) {
            // Use setTimeout to defer snapshot creation (non-blocking)
            setTimeout(() => {
                try {
                    const newSnapshot = {
                        createdAt: new Date().toISOString(),
                        employees: this.workforceManager.employees || [],
                        shiftTypes: this.workforceManager.shiftTypes || [],
                        jobRoles: this.workforceManager.jobRoles || [],
                        schedules: this.workforceManager.schedules || [],
                        currentWeekStart: this.workforceManager.currentWeekStart ? 
                            this.workforceManager.currentWeekStart.toISOString().split('T')[0] : null
                    };
                    localStorage.setItem('workforce_schedule_snapshot_v1', JSON.stringify(newSnapshot));
                    // Cache for next render
                    this.workforceManager.snapshotManager.cache.set(
                        this.workforceManager.snapshotManager.snapshotKey, 
                        newSnapshot
                    );
                } catch (error) {
                    console.error('❌ Failed to create snapshot for change tracking:', error);
                }
            }, 0);
            // For this render, we'll proceed without change tracking (MOV column will show 0)
        }

        // Snapshot warning only in development
        if (!snapshot && window.location.hostname === 'localhost') {
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
        // PERFORMANCE FIX: Pass existing maps to avoid recreating them
        const workerCountData = this.preCalculateWorkerCounts(weekDates, scheduleMap, roleMap, shiftTypeMap);
        
        // Store the summary data for rule engine access
        this.workerCountData = workerCountData;
        this.currentWeekDates = weekDates;

        // Create matrix HTML - EMPLOYEES AS ROWS, DATES AS COLUMNS

        // Generate header row with date columns
        // OPTIMIZATION: Use array and join() instead of string += for O(n) performance
        const matrixHTMLParts = [];
        
        matrixHTMLParts.push(`<div class="matrix-cell header-cell" style="background: #f8fafc !important; border-bottom: 2px solid #e2e8f0 !important;">Employee Name</div>`);
        matrixHTMLParts.push(`<div class="matrix-cell header-cell" style="background: #f8fafc !important; border-bottom: 2px solid #e2e8f0 !important;">Job Type</div>`);
        
        // Use pre-calculated dateInfoCache for headers
        for (let i = 0; i < dateInfoCache.length; i++) {
            const info = dateInfoCache[i];
            matrixHTMLParts.push(`<div class="matrix-cell header-cell date-header ${info.isToday ? 'today' : ''} ${info.isWeekend ? 'weekend' : ''} ${info.isSaturday ? 'saturday' : ''}">${info.displayString}</div>`);
        }
        
        matrixHTMLParts.push(`<div class="matrix-cell header-cell count-header count-header-fri" style="background: #f0fdf4 !important; border-bottom: 2px solid #22c55e !important;">Fri</div>`);
        matrixHTMLParts.push(`<div class="matrix-cell header-cell count-header count-header-sat" style="background: #fef7ff !important; border-bottom: 2px solid #a855f7 !important;">Sat</div>`);
        matrixHTMLParts.push(`<div class="matrix-cell header-cell count-header count-header-sun" style="background: #fff7ed !important; border-bottom: 2px solid #f97316 !important;">Sun</div>`);
        matrixHTMLParts.push(`<div class="matrix-cell header-cell count-header count-header-vac" style="background: #fef3c7 !important; border-bottom: 2px solid #f59e0b !important;">Vac</div>`);
        matrixHTMLParts.push(`<div class="matrix-cell header-cell count-header count-header-req" style="background: #dbeafe !important; border-bottom: 2px solid #3b82f6 !important;">Req</div>`);
        matrixHTMLParts.push(`<div class="matrix-cell header-cell count-header count-header-cha" style="background: #fce7f3 !important; border-bottom: 2px solid #ec4899 !important;">CN</div>`);
        matrixHTMLParts.push(`<div class="matrix-cell header-cell count-header count-header-mov" style="background: #f3e8ff !important; border-bottom: 2px solid #a855f7 !important;">MOV</div>`);

        // Add employee rows (each employee gets their own row with all date columns)
        // Use cached filtered employees for better performance
        const filteredEmployees = this.workforceManager.filterManager.getCachedFilteredEmployees();
        
        // Debug: Log the first 5 employees being rendered
        if (window.location.hostname === 'localhost') {
            console.log('🎨 Calendar rendering employees (first 5):', filteredEmployees.slice(0, 5).map(e => e.name));
        }

        const employeeLoopStart = performance.now();
        
        // OPTIMIZATION: Process all employees with merged loops and pre-calculated data
        filteredEmployees.forEach((employee, empIndex) => {
            const role = roleMap.get(employee.roleId);
            const roleName = role ? role.name : 'No Role';
            const empShiftType = employee.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(employee);
            const shiftBadgeClass = empShiftType === 'Night' ? 'night-shift-badge' : 'day-shift-badge';
            const roleBadgeClass = this.workforceManager.employeeManager.getRoleBadgeClass(roleName);

            // Get pre-calculated MOV count and shift differences
            const movCount = employeeMoveCounts.get(employee.id) || 0;
            const shiftDifferences = employeeShiftDifferences.get(employee.id) || new Map();

            // Employee name cell
            matrixHTMLParts.push(`<div class="matrix-cell employee-name">${employee.name}</div>`);

            // Job role cell with badges
            const priority = employee.priority || '';
            const priorityBadge = priority ? `<span class="priority-badge-small priority-${priority.toLowerCase()}">${priority}</span>` : '';
            matrixHTMLParts.push(`<div class="matrix-cell job-role"><div class="job-badges"><span class="role-badge ${roleBadgeClass}">${roleName}</span><span class="shift-type-badge ${shiftBadgeClass}">${empShiftType}</span></div><div class="priority-space">${priorityBadge}</div></div>`);

            // OPTIMIZATION: Single loop through dates - count AND render in one pass
            let friCount = 0, satCount = 0, sunCount = 0, vacCount = 0, reqCount = 0, chaCount = 0;
            
            for (let i = 0; i < dateInfoCache.length; i++) {
                const info = dateInfoCache[i];
                const scheduleKey = `${employee.id}_${info.dateString}`;
                const schedule = scheduleMap.get(scheduleKey);
                
                let shiftName = '';
                let shiftColor = '#f3f4f6';

                if (schedule) {
                    const shiftType = shiftTypeMap.get(schedule.shiftId);
                    if (shiftType) {
                        shiftName = shiftType.name;
                        shiftColor = shiftType.color || '#3b82f6';
                    } else {
                        shiftName = schedule.shiftType || 'Unknown';
                        shiftColor = '#ff6b6b';
                    }
                    
                    // Count while we're already in the loop (avoids second pass)
                    const isNotRorC = !shiftName.includes('R') && !shiftName.includes('C ');
                    if (isNotRorC && shiftName && shiftName !== 'Off') {
                        if (info.isFriday) friCount++;
                        else if (info.isSaturday) satCount++;
                        else if (info.isSunday) sunCount++;
                    }
                    if (shiftName.includes('C ')) vacCount++;
                    if (shiftName.includes('R12') || shiftName.includes('R 12')) reqCount++;
                    if (shiftName.includes('Charg')) chaCount++;
                } else if (info.isWeekend) {
                    shiftColor = 'rgba(255,255,255,0.95)';
                }

                const isOffShift = shiftName === 'Off' || shiftName === '';
                const differenceType = shiftDifferences.get(info.dateString);
                
                // Build class string efficiently
                let cellClass = 'matrix-cell shift-cell';
                if (info.isToday) cellClass += ' today';
                if (info.isWeekend) cellClass += ' weekend';
                if (info.isSaturday) cellClass += ' saturday';
                if (isOffShift) cellClass += ' off-shift';
                if (differenceType) cellClass += ` shift-${differenceType}`;
                
                matrixHTMLParts.push(`<div id="shift-${employee.id}-${info.dateString}" class="${cellClass}" style="--shift-color:${shiftColor};background-color:var(--shift-color);" data-employee-id="${employee.id}" data-date="${info.dateString}" data-shift-id="${schedule ? schedule.shiftId : ''}">${shiftName}</div>`);
            }

            // Add count cells for this employee
            matrixHTMLParts.push(`<div class="matrix-cell count-cell count-cell-fri" style="background: #f0fdf4 !important;">${friCount}</div>`);
            matrixHTMLParts.push(`<div class="matrix-cell count-cell count-cell-sat" style="background: #fef7ff !important;">${satCount}</div>`);
            matrixHTMLParts.push(`<div class="matrix-cell count-cell count-cell-sun" style="background: #fff7ed !important;">${sunCount}</div>`);
            matrixHTMLParts.push(`<div class="matrix-cell count-cell count-cell-vac" style="background: #fef3c7 !important;">${vacCount}</div>`);
            matrixHTMLParts.push(`<div class="matrix-cell count-cell count-cell-req" style="background: #dbeafe !important;">${reqCount}</div>`);
            matrixHTMLParts.push(`<div class="matrix-cell count-cell count-cell-cha" style="background: #fce7f3 !important;">${chaCount}</div>`);
            matrixHTMLParts.push(`<div class="matrix-cell count-cell count-cell-mov" style="background: #f3e8ff !important;">${movCount}</div>`);
        });

        // Add empty state if no employees
        if (this.workforceManager.employees.length === 0) {
            matrixHTMLParts.push(`
                <div class="matrix-cell empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px; border: none;">
                    <i class="fas fa-users" style="font-size: 48px; color: #cbd5e0; margin-bottom: 16px;"></i>
                    <h3 style="color: #718096; margin: 0; font-size: 18px; font-weight: 500;">No Employees Found</h3>
                </div>
            `);
        }

        // OPTIMIZATION: Join array once at the end (O(n) instead of O(n²) string concatenation)
        const matrixHTML = matrixHTMLParts.join('');
        matrixContainer.innerHTML = matrixHTML;

        // Cache the matrix HTML for future use
        // PERFORMANCE FIX: Store simple object instead of JSON string
        this.matrixHTMLCache = matrixHTML;
        this.lastMatrixState = {
            employeeCount: this.workforceManager.employees.length,
            scheduleCount: this.workforceManager.schedules.length,
            weekStartTime: this.workforceManager.currentWeekStart?.getTime(),
            timeInterval: timeInterval,
            filterCacheKey: this.workforceManager.filterManager?.lastFilterState || null
        };

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
        this.renderWorkerCountSummaryWithData(weekDates, workerCountData, todayDateString);

        // Note: Drag scroll functionality is bound once during initialization, no need to rebind after every render

        // PERFORMANCE FIX: Debounce staffing issues panel update (expensive rule evaluation)
        this.updateStaffingIssuesPanelDebounced();

        // PERFORMANCE FIX: Batch all post-render operations in single requestAnimationFrame
        requestAnimationFrame(() => {
            // Update column visibility based on toggle states
            this.workforceManager.filterManager.updateColumnVisibility();
            // Cleanup any existing global context menu handlers first
            this.workforceManager.uiManager.cleanupGlobalContextMenu();
            // Then bind new events
            this.workforceManager.uiManager.bindShiftCellEvents();
        });
        
    }

    // Pre-calculate worker count data for all dates and role types (major performance optimization)
    // PERFORMANCE FIX: Accept pre-built maps to avoid recreating them
    preCalculateWorkerCounts(weekDates, scheduleMap, roleMap = null, shiftTypeMap = null) {
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

        // Initialize arrays for each date (use Array constructor for speed)
        const dateCount = weekDates.length;
        data.amgrDayCounts = new Array(dateCount).fill(0);
        data.pctDayCounts = new Array(dateCount).fill(0);
        data.usDayCounts = new Array(dateCount).fill(0);
        data.rnDayCounts = new Array(dateCount).fill(0);
        data.chargeDayCounts = new Array(dateCount).fill(0);
        data.midDayCounts = new Array(dateCount).fill(0);
        data.amgrNightCounts = new Array(dateCount).fill(0);
        data.pctNightCounts = new Array(dateCount).fill(0);
        data.usNightCounts = new Array(dateCount).fill(0);
        data.rnNightCounts = new Array(dateCount).fill(0);
        data.chargeNightCounts = new Array(dateCount).fill(0);

        // PERFORMANCE FIX: Use passed-in maps or create if not provided
        if (!roleMap) {
            roleMap = new Map();
            this.workforceManager.jobRoles.forEach(role => {
                roleMap.set(role.id, role);
            });
        }
        
        if (!shiftTypeMap) {
            shiftTypeMap = new Map();
            this.workforceManager.shiftTypes.forEach(shift => {
                shiftTypeMap.set(shift.id, shift);
            });
        }

        // PERFORMANCE FIX: Pre-calculate date strings once
        const dateStrings = weekDates.map(date => formatDateString(date));

        // Process each employee once and calculate counts for all dates
        let processedEmployees = 0;
        let dayShiftEmployees = 0;
        let nightShiftEmployees = 0;
        
        this.workforceManager.employees.forEach(employee => {
            // PERFORMANCE FIX: Use map lookup O(1) instead of .find() O(n)
            const role = roleMap.get(employee.roleId);
            const roleName = role ? role.name : '';
            const shiftType = employee.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(employee);

            const isDayShift = shiftType === 'DAY' || shiftType === 'Day' || this.workforceManager.employeeManager.isDayShift(shiftType);
            const isNightShift = shiftType === 'NIGHT' || shiftType === 'Night' || this.workforceManager.employeeManager.isNightShift(shiftType);
            
            processedEmployees++;
            if (isDayShift) dayShiftEmployees++;
            if (isNightShift) nightShiftEmployees++;

            // Process each date for this employee
            for (let dateIndex = 0; dateIndex < dateCount; dateIndex++) {
                const dateString = dateStrings[dateIndex];
                const scheduleKey = `${employee.id}_${dateString}`;
                const schedule = scheduleMap.get(scheduleKey);

                if (schedule) {
                    // PERFORMANCE FIX: Use map lookup O(1) instead of .find() O(n)
                    const shiftTypeObj = shiftTypeMap.get(schedule.shiftId);
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
            }
        });

        // Check if schedules are actually in the scheduleMap
        if (scheduleMap.size === 0) {
            console.error('❌ Schedule map is empty! This means no schedules were found.');
        }

        return data;
    }

    // Render worker count summary using pre-calculated data (ultra-fast)
    renderWorkerCountSummaryWithData(weekDates, data, todayDateString = null) {
        const summaryContainer = document.getElementById('workerCountSummary');
        if (!summaryContainer) {
            console.error('❌ Worker count summary container not found');
            return;
        }

        // Use provided todayDateString or get cached one
        if (!todayDateString) {
            todayDateString = this.getCachedTodayDateString();
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

        // Create role name lookup map for performance
        const roleNameMap = new Map();
        this.workforceManager.jobRoles.forEach(role => {
            roleNameMap.set(role.name.toUpperCase(), role);
        });

        // Check which role types should be shown based on current filters
        const shouldShowRole = (roleName) => {
            // Check if "all-roles" is active
            if (this.workforceManager.filterManager.roleFilters['all-roles']) {
                return true;
            }
            
            // Check if specific role is active
            const role = roleNameMap.get(roleName.toUpperCase());
            if (role && this.workforceManager.filterManager.roleFilters[role.id]) {
                return true;
            }
            
            return false;
        };

        // Only show DAY section if day shift filter is enabled
        if (this.workforceManager.filterManager.shiftFilters['day']) {
            
            // DAY section header
            summaryHTML += `<div class="summary-cell summary-label" style="grid-column: 1 / -1; text-align: left; font-weight: 700; font-size: 1rem; margin-top: 2rem; padding-left: 1rem; position: relative;">
                <button class="shift-lock-btn" data-shift-type="day" title="Lock/Unlock Day Shift Editing">
                    <i class="fas fa-lock-open"></i>
                </button>
                <button class="shift-verify-btn" data-shift-type="day" title="Verify Day Shift Data">
                    ✓
                </button>
                <span style="margin-left: 7rem;">DAY Shift</span>
            </div>`;
            
            // Date header row - complete row
            summaryHTML += `<div class="summary-cell summary-label">Date</div>`;
            weekDates.forEach(date => {
                const isToday = date.toDateString() === todayDateString;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isSaturday = date.getDay() === 6;
                summaryHTML += `<div class="summary-cell date-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isSaturday ? 'saturday' : ''}">${this.dateFormatter.format(date)}</div>`;
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
            summaryHTML += `<div class="summary-cell summary-label" style="grid-column: 1 / -1; text-align: left; font-weight: 700; font-size: 1rem; margin-top: 2rem; padding-left: 1rem; position: relative;">
                <button class="shift-lock-btn" data-shift-type="night" title="Lock/Unlock Night Shift Editing">
                    <i class="fas fa-lock-open"></i>
                </button>
                <button class="shift-verify-btn" data-shift-type="night" title="Verify Night Shift Data">
                    ✓
                </button>
                <span style="margin-left: 7rem;">NIGHT Shift</span>
            </div>`;
            
            // Date header row - complete row
            summaryHTML += `<div class="summary-cell summary-label">Date</div>`;
            weekDates.forEach(date => {
                const isToday = date.toDateString() === todayDateString;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isSaturday = date.getDay() === 6;
                summaryHTML += `<div class="summary-cell date-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isSaturday ? 'saturday' : ''}">${this.dateFormatter.format(date)}</div>`;
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
        
        // Bind lock and verify button events
        this.bindShiftButtons();
        
        // Update lock button states with a small delay to ensure DOM is ready
        setTimeout(() => {
            // Only reload lock state if it's not already loaded
            if (!this.lockState) {
                this.lockState = this.loadLockState();
            }
            console.log('Loading lock state on render:', this.lockState);
            this.updateShiftLockButtonsWithState(this.lockState);
            
            // Debug: Check if verify buttons exist
            const verifyBtns = document.querySelectorAll('.shift-verify-btn');
            console.log(`🔍 DEBUG: Found ${verifyBtns.length} verify buttons in DOM after render`);
            verifyBtns.forEach((btn, i) => {
                console.log(`🔍 DEBUG: Verify button ${i}:`, btn, 'data-shift-type:', btn.dataset.shiftType);
            });
        }, 50); // Reduced delay for faster response
        
        // Set up CSS grid template to match the calendar exactly
        const timeInterval = this.getCachedTimeInterval();
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

    /**
     * Load lock state from localStorage
     */
    loadLockState() {
        try {
            const stored = localStorage.getItem('shiftLockState');
            return stored ? JSON.parse(stored) : { day: false, night: false };
        } catch (e) {
            console.warn('Error loading lock state:', e);
            return { day: false, night: false };
        }
    }

    /**
     * Save lock state to localStorage and update instance variable
     */
    saveLockState(lockState) {
        this.lockState = { ...lockState };
        try {
            localStorage.setItem('shiftLockState', JSON.stringify(lockState));
            console.log('Saved lock state:', lockState);
        } catch (e) {
            console.warn('Error saving lock state:', e);
        }
    }

    /**
     * Bind events to shift lock and verify buttons
     */
    bindShiftButtons() {
        const lockButtons = document.querySelectorAll('.shift-lock-btn');
        console.log(`Binding events to ${lockButtons.length} lock buttons`);
        
        lockButtons.forEach((button, index) => {
            console.log(`Button ${index}:`, button);
            console.log(`Button dataset:`, button.dataset);
            
            // Remove any existing event listeners by cloning
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            console.log(`Binding click event to button ${index} for ${newButton.dataset.shiftType}`);
            
            // Use mousedown to avoid conflicts with global click handlers
            newButton.addEventListener('mousedown', (e) => {
                console.log(`MOUSEDOWN EVENT on button ${newButton.dataset.shiftType}`);
                // Only respond to left mouse button
                if (e.button === 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log(`Processing lock toggle for ${newButton.dataset.shiftType}`);
                    this.toggleShiftLock(newButton.dataset.shiftType);
                }
            });
        });

        // Use event delegation for verify buttons (more reliable)
        console.log(`🔍 VERIFICATION: Setting up event delegation for verify buttons`);
        
        // Remove any existing delegated listeners
        document.removeEventListener('mousedown', this.verifyButtonMousedownHandler);
        
        // Track processing to prevent double triggers
        this.verificationInProgress = this.verificationInProgress || new Set();
        
        // Use mousedown instead of click since click isn't firing
        this.verifyButtonMousedownHandler = (e) => {
            if (e.target.classList.contains('shift-verify-btn')) {
                // Only respond to left mouse button
                if (e.button === 0) {
                    const shiftType = e.target.dataset.shiftType;
                    
                    // Prevent double processing
                    if (this.verificationInProgress.has(shiftType)) {
                        console.log(`🔍 VERIFY: Already processing ${shiftType}, ignoring`);
                        return;
                    }
                    
                    console.log(`🔍 VERIFY MOUSEDOWN (delegated) for ${shiftType} - PROCESSING`);
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Mark as processing
                    this.verificationInProgress.add(shiftType);
                    
                    // Process and clear flag when done
                    this.initiateShiftVerification(shiftType).finally(() => {
                        this.verificationInProgress.delete(shiftType);
                    });
                } else {
                    console.log(`🔍 VERIFY MOUSEDOWN (delegated) for ${e.target.dataset.shiftType} - IGNORED (button ${e.button})`);
                }
            }
        };
        
        document.addEventListener('mousedown', this.verifyButtonMousedownHandler);
    }

    /**
     * Toggle lock state for a specific shift type
     */
    toggleShiftLock(shiftType) {
        console.log(`Toggling lock for ${shiftType} shift`);
        
        // Use instance variable for current state
        console.log('Current lock state:', this.lockState);
        
        // Toggle the specific shift type
        this.lockState[shiftType] = !this.lockState[shiftType];
        
        console.log('New lock state:', this.lockState);
        
        // Save the updated state
        this.saveLockState(this.lockState);
        
        // Also save through data manager for cloud sync
        this.workforceManager.dataManager.saveData('shiftLockState', this.lockState);
        
        // Update button appearance with the current state
        this.updateShiftLockButtonsWithState(this.lockState);
        
        // Log the lock/unlock activity
        this.logLockActivity(shiftType, this.lockState[shiftType]);
        
        console.log(`${shiftType} shift editing ${this.lockState[shiftType] ? 'locked' : 'unlocked'}`);
    }

    /**
     * Update lock button appearance based on current state
     */
    updateShiftLockButtons() {
        const lockState = this.workforceManager.dataManager.loadData('shiftLockState') || {
            day: false,
            night: false
        };
        
        this.updateShiftLockButtonsWithState(lockState);
    }

    /**
     * Update lock button appearance with provided state
     */
    updateShiftLockButtonsWithState(lockState) {
        console.log('Updating lock buttons with state:', lockState);
        
        const lockButtons = document.querySelectorAll('.shift-lock-btn');
        console.log(`Found ${lockButtons.length} lock buttons`);
        
        if (lockButtons.length === 0) {
            console.warn('No lock buttons found! Summary may have been re-rendered.');
            return;
        }
        
        lockButtons.forEach(button => {
            const shiftType = button.dataset.shiftType;
            const isLocked = lockState[shiftType];
            
            console.log(`Updating button for ${shiftType}, locked: ${isLocked}`);
            
            const icon = button.querySelector('i');
            console.log(`Before update - icon class: ${icon.className}`);
            
            if (isLocked) {
                button.classList.add('locked');
                // Replace the entire icon element
                icon.outerHTML = '<i class="fas fa-lock"></i>';
                button.title = `Unlock ${shiftType.charAt(0).toUpperCase() + shiftType.slice(1)} Shift Editing`;
                console.log(`Set ${shiftType} button to locked state`);
            } else {
                button.classList.remove('locked');
                // Replace the entire icon element
                icon.outerHTML = '<i class="fas fa-lock-open"></i>';
                button.title = `Lock ${shiftType.charAt(0).toUpperCase() + shiftType.slice(1)} Shift Editing`;
                console.log(`Set ${shiftType} button to unlocked state`);
            }
        });
    }

    /**
     * Check if editing is locked for a specific shift type
     */
    isShiftEditingLocked(shiftType) {
        // Ensure we have current lock state
        if (!this.lockState) {
            this.lockState = this.loadLockState();
        }
        
        console.log(`Checking lock state for ${shiftType}:`, this.lockState);
        return this.lockState[shiftType] || false;
    }

    /**
     * Log shift lock/unlock activity
     */
    async logLockActivity(shiftType, isLocked) {
        try {
            // Ensure activity logger is available
            await this.workforceManager.activityManager.ensureActivityLogger();
            if (this.workforceManager.activityManager.activityLogger) {
                const action = isLocked ? 'lock_shift' : 'unlock_shift';
                const description = `${shiftType.charAt(0).toUpperCase() + shiftType.slice(1)} shift editing ${isLocked ? 'locked' : 'unlocked'}`;
                
                await this.workforceManager.activityManager.activityLogger.logActivity(
                    `${action}_${shiftType}`,
                    'system',
                    `shift_lock_${shiftType}_${Date.now()}`,
                    {
                        shiftType: shiftType.toUpperCase(),
                        action: isLocked ? 'LOCKED' : 'UNLOCKED',
                        description: `${shiftType.toUpperCase()} shift editing ${isLocked ? 'LOCKED' : 'UNLOCKED'}`,
                        timestamp: new Date().toISOString()
                    }
                );
                
                console.log(`📝 Logged ${action} activity for ${shiftType} shift`);
            }
        } catch (error) {
            console.error('❌ Error logging lock activity:', error);
        }
    }

    /**
     * Initiate shift verification process
     */
    async initiateShiftVerification(shiftType) {
        console.log(`🔍 VERIFICATION: Starting verification for ${shiftType} shift`);
        
        // Create file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.xlsx,.xls';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const file = e.target.files[0];
            
            // Immediately disable and hide the input
            fileInput.disabled = true;
            fileInput.style.display = 'none';
            
            if (file) {
                console.log(`File selected for ${shiftType} verification:`, file.name);
                
                // Process the file
                try {
                    await this.processVerificationFile(file, shiftType);
                } finally {
                    // Clean up after processing
                    if (fileInput.parentNode) {
                        document.body.removeChild(fileInput);
                    }
                }
            } else {
                // Clean up if no file selected
                if (fileInput.parentNode) {
                    document.body.removeChild(fileInput);
                }
            }
        });
        
        // Prevent default behavior on the input itself
        fileInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Add to DOM and trigger click
        document.body.appendChild(fileInput);
        fileInput.click();
    }

    /**
     * Process uploaded file for verification
     */
    async processVerificationFile(file, shiftType) {
        try {
            console.log(`Processing verification file for ${shiftType} shift`);
            
            // Show loading indicator
            const loadingMessage = this.showLoadingMessage(`Verifying ${shiftType} shift data...`);
            
            // Use the same Excel parsing logic as import manager
            const workbook = await this.parseExcelFile(file);
            const verificationData = this.extractVerificationData(workbook, shiftType);
            
            // Compare with current calendar data
            const comparisonResult = this.compareShiftData(verificationData, shiftType);
            
            // Hide loading and show results
            this.hideLoadingMessage(loadingMessage);
            this.showVerificationResults(comparisonResult, shiftType);
            
        } catch (error) {
            console.error('❌ Error processing verification file:', error);
            this.hideLoadingMessage();
            await showAlert(`Error processing file: ${error.message}`, 'Verification Error');
        }
    }

    /**
     * Parse Excel file using SheetJS
     */
    async parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    resolve(workbook);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Extract verification data using EXACT import manager workflow
     */
    extractVerificationData(workbook, shiftType) {
        console.log(`🔍 VERIFICATION: Extracting data for ${shiftType} shift`);
        
        // Convert workbook to CSV format (same as import manager)
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        
        // EXACT COPY of import manager workflow:
        // 1. Clean content within quotes
        const fullCsvWithCleanedContent = this.cleanCsvNewlines(csvText);
        
        // 2. Split cleaned data and save 8th row as metadata
        const cleanedLines = fullCsvWithCleanedContent.trim().split('\n');
        let rawMetadataRow = cleanedLines[7] || '';
        
        // 3. Process the 8th row metadata (same as import manager)
        const xlsxMetadataRow = this.processMetadataRow(rawMetadataRow);
        console.log('🔍 VERIFICATION: Processed metadata row:', xlsxMetadataRow);
        
        // 4. Remove first 8 header rows from cleaned data
        const dataLines = cleanedLines.slice(8);
        const csvWithoutHeaders = dataLines.join('\n');
        
        // 5. Remove columns that have all blank data
        const fullyCleanedCsv = DataProcessor.removeColumnsWithAllBlankData(csvWithoutHeaders);
        
        // 6. Parse the filtered CSV data using XLSX-specific parsing
        const data = DataProcessor.parseXlsxCsv(fullyCleanedCsv);
        console.log(`🔍 VERIFICATION: Final parsed data: ${data.length} rows`);
        console.log('🔍 VERIFICATION: First 5 rows:', data.slice(0, 5));
        
        // 7. Process using the EXACT same function as import manager
        const processedData = DataProcessor.processXlsxScheduleData(
            data, 
            generateId, 
            this.workforceManager.currentWeekStart, 
            xlsxMetadataRow, 
            DataProcessor.parseCsvRow
        );
        
        console.log(`🔍 VERIFICATION: Processed ${processedData.schedules.length} schedules`);
        
        // 8. Filter for shift type and convert to verification format
        const verificationSchedules = processedData.schedules.map(schedule => {
            const employee = processedData.employees.find(emp => emp.id === schedule.employeeId);
            return {
                employeeName: employee?.name || 'Unknown',
                date: schedule.date,
                shiftName: schedule.shiftType
            };
        });
        
        // Filter for specific shift type
        const filteredSchedules = this.filterSchedulesByShiftType(verificationSchedules, shiftType);
        console.log(`🔍 VERIFICATION: Filtered ${filteredSchedules.length} schedules for ${shiftType} shift`);
        
        return filteredSchedules;
    }

    /**
     * Process metadata row (same as import manager)
     */
    processMetadataRow(rawMetadataRow) {
        const cells = DataProcessor.parseCsvRow(rawMetadataRow);
        const filtered = cells.filter(cell => cell && cell.trim() !== '');
        const result = ['', ''].concat(filtered);
        return result.join(',');
    }

    /**
     * Parse date from Excel header using the same logic as import manager
     */
    parseDateFromHeader(dateHeader) {
        // Use the exact same logic as DataProcessor.parseDayColumn
        return DataProcessor.parseDayColumn(dateHeader, this.workforceManager.currentWeekStart);
    }

    /**
     * Clean CSV data by removing newlines, carriage returns, and spaces within quotes
     * Same logic as import manager
     */
    cleanCsvNewlines(csvText) {
        let result = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < csvText.length) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Handle escaped quotes ("")
                    result += '""';
                    i += 2;
                    continue;
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                    result += char;
                }
            } else if ((char === '\n' || char === '\r' || char === ' ') && inQuotes) {
                // Skip newlines, carriage returns, and spaces within quotes
                // Don't add anything to result - completely remove them
            } else {
                result += char;
            }
            i++;
        }
        
        return result;
    }

    /**
     * Check if a value looks like a job role (helper for name reconstruction)
     */
    isJobRole(value) {
        if (!value) return false;
        
        // Check against known job roles in the system
        const knownRoles = this.workforceManager.jobRoles.map(role => role.name.toLowerCase());
        const lowerValue = value.toLowerCase();
        
        // Direct match
        if (knownRoles.includes(lowerValue)) {
            return true;
        }
        
        // Common job role patterns
        const jobRolePatterns = [
            /^(rn|lpn|cna|pct|us|amgr|mgr|cn|charge)$/i,
            /nurse/i,
            /manager/i,
            /assistant/i,
            /tech/i,
            /aide/i
        ];
        
        return jobRolePatterns.some(pattern => pattern.test(value));
    }

    /**
     * Filter schedules by shift type based on employee classification
     */
    filterSchedulesByShiftType(schedules, shiftType) {
        console.log(`🔍 VERIFICATION: Filtering ${schedules.length} schedules for ${shiftType} shift type`);
        
        const filtered = schedules.filter(schedule => {
            // Find the employee for this schedule
            const employee = this.workforceManager.employees.find(emp => emp.name === schedule.employeeName);
            if (!employee) {
                return false;
            }
            
            // Check if employee belongs to the specified shift type
            const employeeShiftType = this.workforceManager.employeeManager.determineEmployeeShiftType(employee);
            return employeeShiftType.toLowerCase() === shiftType.toLowerCase();
        });
        
        console.log(`🔍 VERIFICATION: Filtered result: ${filtered.length} schedules`);
        return filtered;
    }

    /**
     * Compare uploaded data with current calendar data
     */
    compareShiftData(verificationData, shiftType) {
        const currentSchedules = this.getCurrentShiftSchedules(shiftType);
        const discrepancies = [];
        const matches = [];
        
        console.log(`🔍 VERIFICATION: Comparing ${verificationData.length} verification records with ${currentSchedules.length} current schedules`);
        
        // Create a map of current schedules for faster lookup
        const currentScheduleMap = new Map();
        currentSchedules.forEach(schedule => {
            const employee = this.workforceManager.employees.find(emp => emp.id === schedule.employeeId);
            const shiftType = this.workforceManager.shiftTypes.find(shift => shift.id === schedule.shiftId);
            
            if (employee && shiftType) {
                const key = `${employee.name}_${schedule.date}`;
                currentScheduleMap.set(key, {
                    employeeName: employee.name,
                    date: schedule.date,
                    shiftName: shiftType.name,
                    schedule: schedule
                });
            }
        });
        
        console.log(`🔍 VERIFICATION: Created map with ${currentScheduleMap.size} current schedule entries`);
        
        // Compare each verification record with current data
        verificationData.forEach(verificationSchedule => {
            const key = `${verificationSchedule.employeeName}_${verificationSchedule.date}`;
            const currentSchedule = currentScheduleMap.get(key);
            
            if (currentSchedule) {
                // Check if shift assignments match
                if (currentSchedule.shiftName === verificationSchedule.shiftName) {
                    matches.push({
                        employee: verificationSchedule.employeeName,
                        date: verificationSchedule.date,
                        shift: verificationSchedule.shiftName
                    });
                } else {
                    discrepancies.push(`${verificationSchedule.employeeName} on ${verificationSchedule.date}: Expected "${verificationSchedule.shiftName}" but found "${currentSchedule.shiftName}"`);
                }
                
                // Remove from map to track what wasn't in verification file
                currentScheduleMap.delete(key);
            } else {
                discrepancies.push(`${verificationSchedule.employeeName} on ${verificationSchedule.date}: Expected "${verificationSchedule.shiftName}" but no assignment found in calendar`);
            }
        });
        
        // Check for schedules in calendar that weren't in verification file
        currentScheduleMap.forEach((currentSchedule, key) => {
            discrepancies.push(`${currentSchedule.employeeName} on ${currentSchedule.date}: Found "${currentSchedule.shiftName}" in calendar but not in verification file`);
        });
        
        console.log(`🔍 VERIFICATION: Found ${matches.length} matches and ${discrepancies.length} discrepancies`);
        
        return {
            matches: matches.length,
            discrepancies: discrepancies,
            totalVerified: verificationData.length,
            totalCurrent: currentSchedules.length,
            matchDetails: matches
        };
    }

    /**
     * Get current schedules for a specific shift type
     */
    getCurrentShiftSchedules(shiftType) {
        // Filter schedules based on shift type
        return this.workforceManager.schedules.filter(schedule => {
            const employee = this.workforceManager.employees.find(emp => emp.id === schedule.employeeId);
            if (!employee) return false;
            
            const employeeShiftType = this.workforceManager.employeeManager.determineEmployeeShiftType(employee);
            return employeeShiftType.toLowerCase() === shiftType.toLowerCase();
        });
    }

    /**
     * Show verification results in a styled modal
     */
    showVerificationResults(result, shiftType) {
        const shiftName = shiftType.charAt(0).toUpperCase() + shiftType.slice(1);
        
        // Create verification modal
        this.createVerificationModal(result, shiftName);
        
        // Log detailed results to console for debugging
        console.log(`🔍 VERIFICATION COMPLETE: ${shiftName} Shift Results:`, result);
    }

    /**
     * Create styled verification results modal
     */
    createVerificationModal(result, shiftName) {
        // Remove existing modal if any
        const existingModal = document.getElementById('verificationModal');
        if (existingModal) {
            existingModal.remove();
        }

        const isSuccess = result.discrepancies.length === 0;
        const statusIcon = isSuccess ? '✅' : '❌';
        const statusText = isSuccess ? 'PASSED' : 'FAILED';
        const statusClass = isSuccess ? 'success' : 'error';

        const modalHTML = `
            <div id="verificationModal" class="modal active">
                <div class="modal-content verification-modal-content">
                    <div class="modal-header verification-header ${statusClass}">
                        <h2>${statusIcon} ${shiftName} Shift Verification - ${statusText}</h2>
                        <button id="closeVerificationModal" class="btn btn-icon">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-body verification-body">
                        <div class="verification-summary">
                            <h3>📊 Verification Summary</h3>
                            <div class="summary-stats">
                                <div class="stat-item ${isSuccess ? 'success' : ''}">
                                    <span class="stat-label">Matching Schedules:</span>
                                    <span class="stat-value">${result.matches}</span>
                                </div>
                                <div class="stat-item ${result.discrepancies.length > 0 ? 'error' : ''}">
                                    <span class="stat-label">Discrepancies Found:</span>
                                    <span class="stat-value">${result.discrepancies.length}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Records in File:</span>
                                    <span class="stat-value">${result.totalVerified}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Records in Calendar:</span>
                                    <span class="stat-value">${result.totalCurrent}</span>
                                </div>
                            </div>
                        </div>

                        ${isSuccess ? this.createSuccessContent(result, shiftName) : this.createDiscrepancyContent(result)}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Bind close event
        document.getElementById('closeVerificationModal').addEventListener('click', () => {
            document.getElementById('verificationModal').remove();
        });

        // Close on background click
        document.getElementById('verificationModal').addEventListener('click', (e) => {
            if (e.target.id === 'verificationModal') {
                document.getElementById('verificationModal').remove();
            }
        });
    }

    /**
     * Create success content for verification modal
     */
    createSuccessContent(result, shiftName) {
        return `
            <div class="verification-success">
                <div class="success-message">
                    <i class="fas fa-check-circle"></i>
                    <h3>Data matches perfectly!</h3>
                    <p>All ${shiftName} shift assignments in the uploaded file match exactly with the current calendar.</p>
                </div>
            </div>
        `;
    }

    /**
     * Create discrepancy content for verification modal
     */
    createDiscrepancyContent(result) {
        const discrepancyItems = result.discrepancies.slice(0, 20).map(discrepancy => 
            `<div class="discrepancy-item">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${discrepancy}</span>
            </div>`
        ).join('');

        const truncatedNote = result.discrepancies.length > 20 
            ? `<div class="truncated-note">... and ${result.discrepancies.length - 20} more discrepancies.</div>`
            : '';

        return `
            <div class="verification-discrepancies">
                <h3>🔍 Discrepancies Found</h3>
                <div class="discrepancy-list">
                    ${discrepancyItems}
                    ${truncatedNote}
                </div>
            </div>
        `;
    }

    /**
     * Show loading message
     */
    showLoadingMessage(text) {
        const loading = document.createElement('div');
        loading.id = 'verificationLoading';
        loading.className = 'verification-loading';
        loading.innerHTML = `
            <div class="loading-content">
                <i class="fas fa-spinner fa-spin"></i>
                <span>${text}</span>
            </div>
        `;
        document.body.appendChild(loading);
        return loading;
    }

    /**
     * Hide loading message
     */
    hideLoadingMessage(loadingElement) {
        if (loadingElement && loadingElement.parentNode) {
            loadingElement.parentNode.removeChild(loadingElement);
        }
    }

    /**
     * Test function to manually trigger verification (for debugging)
     */
    testVerification(shiftType = 'day') {
        console.log(`🔍 TEST: Manual verification test for ${shiftType}`);
        this.initiateShiftVerification(shiftType);
    }
}

// Export the class
window.CalendarRenderer = CalendarRenderer;
