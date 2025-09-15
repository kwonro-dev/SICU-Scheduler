// Rule Engine Module for Workforce Schedule Manager
/**
 * Handles user-generated rules for staffing validation
 * Supports both simple and complex rule evaluation
 */

class RuleEngine {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.rules = [];
        this.ruleTemplates = this.initializeRuleTemplates();
        this.evaluationCache = new Map();
        this.lastEvaluationTime = 0;
        this.cacheTimeout = 1000; // 1 second cache timeout
    }

    /**
     * Initialize pre-built rule templates for common scenarios
     */
    initializeRuleTemplates() {
        return [
            {
                id: 'template_charge_nurse_daily',
                name: 'Daily Charge Nurse Requirement',
                description: 'Every day should have exactly 1 charge nurse',
                category: 'basic',
                rule: {
                    name: 'Daily Charge Nurse',
                    conditions: [
                        {
                            type: 'count_by_role',
                            role: 'charge_nurse',
                            operator: 'equals',
                            value: 1,
                            severity: 'error'
                        }
                    ]
                }
            },
            {
                id: 'template_charge_nurse_range',
                name: 'Charge Nurse Range (0-2)',
                description: 'Charge nurse count should be 0-2, with warnings for 0 or 2+',
                category: 'range',
                rule: {
                    name: 'Charge Nurse Range',
                    conditions: [
                        {
                            type: 'count_by_role',
                            role: 'charge_nurse',
                            operator: 'less_than',
                            value: 1,
                            severity: 'error',
                            message: 'No charge nurse scheduled'
                        },
                        {
                            type: 'count_by_role',
                            role: 'charge_nurse',
                            operator: 'greater_than',
                            value: 2,
                            severity: 'warning',
                            message: 'Too many charge nurses scheduled'
                        }
                    ]
                }
            },
            {
                id: 'template_shift_coverage',
                name: 'Shift Coverage Requirements',
                description: 'Each shift needs minimum staff levels',
                category: 'coverage',
                rule: {
                    name: 'Shift Coverage',
                    conditions: [
                        {
                            type: 'count_by_shift',
                            shift: 'morning',
                            operator: 'greater_than_or_equal',
                            value: 2,
                            severity: 'error'
                        },
                        {
                            type: 'count_by_shift',
                            shift: 'afternoon',
                            operator: 'greater_than_or_equal',
                            value: 2,
                            severity: 'error'
                        },
                        {
                            type: 'count_by_shift',
                            shift: 'night',
                            operator: 'greater_than_or_equal',
                            value: 1,
                            severity: 'error'
                        }
                    ]
                }
            },
            {
                id: 'template_weekend_manager',
                name: 'Weekend Manager Requirement',
                description: 'Weekends need at least one manager on duty',
                category: 'weekend',
                rule: {
                    name: 'Weekend Manager',
                    conditions: [
                        {
                            type: 'count_by_role',
                            role: 'manager',
                            operator: 'greater_than_or_equal',
                            value: 1,
                            severity: 'warning',
                            dayFilter: ['saturday', 'sunday']
                        }
                    ]
                }
            },
            {
                id: 'template_rn_monday_advanced',
                name: 'RN Monday Day Staffing (Advanced)',
                description: 'Advanced JSON rule for RN staffing on Mondays',
                category: 'advanced',
                rule: {
                    name: 'RN Monday Day Staffing',
                    json: {
                        type: 'rn_day_count',
                        operator: 'less_than',
                        value: 8,
                        severity: 'error',
                        message: 'Insufficient RN staffing on Monday - need at least 8 RN staff during day shift',
                        dayFilter: 'monday'
                    }
                }
            },
            {
                id: 'template_charge_nurse_advanced',
                name: 'Charge Nurse Advanced Rule',
                description: 'Advanced JSON rule for charge nurse requirements',
                category: 'advanced',
                rule: {
                    name: 'Charge Nurse Advanced',
                    json: {
                        type: 'charge_day_count',
                        operator: 'less_than',
                        value: 1,
                        severity: 'error',
                        message: 'No charge nurse scheduled for day shift',
                        dayFilter: 'weekdays'
                    }
                }
            }
        ];
    }

    /**
     * Add a new rule to the engine
     * @param {Object} rule - Rule definition
     */
    async addRule(rule) {
        // Validate rule structure
        if (!this.validateRule(rule)) {
            throw new Error('Invalid rule structure');
        }

        // Generate ID if not provided
        if (!rule.id) {
            rule.id = this.generateRuleId();
        }

        // Add to rules array
        this.rules.push(rule);
        
        // Clear cache since rules changed
        this.evaluationCache.clear();
        
        // Save to storage
        await this.saveRules();
    }

    /**
     * Remove a rule by ID
     * @param {string} ruleId - ID of rule to remove
     */
    async removeRule(ruleId) {
        const index = this.rules.findIndex(rule => rule.id === ruleId);
        if (index !== -1) {
            const removedRule = this.rules.splice(index, 1)[0];
            
            // Clear cache since rules changed
            this.evaluationCache.clear();
            
            await this.saveRules();
            return true;
        }
        return false;
    }

    /**
     * Update an existing rule
     * @param {string} ruleId - ID of rule to update
     * @param {Object} updates - Updates to apply
     */
    async updateRule(ruleId, updates) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (rule) {
            Object.assign(rule, updates);
            
            // Clear cache since rules changed
            this.evaluationCache.clear();
            
            await this.saveRules();
            return true;
        }
        return false;
    }

    /**
     * Evaluate all rules against current schedule data
     * @param {Date} startDate - Start date for evaluation
     * @param {number} days - Number of days to evaluate
     * @returns {Array} Array of rule violations
     */
    evaluateRules(startDate = null, days = null) {
        const startTime = performance.now();
        const timeInterval = days || parseInt(localStorage.getItem('timeInterval')) || 42;
        const calendarStartDate = startDate || new Date(
            this.workforceManager.currentWeekStart.getFullYear(),
            this.workforceManager.currentWeekStart.getMonth(),
            this.workforceManager.currentWeekStart.getDate()
        );

        // Check cache first
        const cacheKey = `${calendarStartDate.getTime()}_${timeInterval}`;
        const now = Date.now();
        if (this.evaluationCache.has(cacheKey) && (now - this.lastEvaluationTime) < this.cacheTimeout) {
            // Debug logging removed to clean up console
            return this.evaluationCache.get(cacheKey);
        }

        // Clear cache if it's too old or too large
        if (this.evaluationCache.size > 10 || (now - this.lastEvaluationTime) > this.cacheTimeout * 2) {
            this.evaluationCache.clear();
            // Debug logging removed to clean up console
        }

        const violations = [];

        // Create schedule lookup map for quick access
        const scheduleMap = this.createScheduleMap();

        // Separate rules by type: JSON rules, employee rules, and daily rules
        const jsonRules = this.rules.filter(rule => 
            rule.enabled && rule.json
        );
        const employeeRules = this.rules.filter(rule => 
            rule.enabled && !rule.json && rule.conditions && rule.conditions.some(condition => 
                condition.type && condition.type.startsWith('employee_')
            )
        );
        const dailyRules = this.rules.filter(rule => 
            rule.enabled && !rule.json && rule.conditions && !rule.conditions.some(condition => 
                condition.type && condition.type.startsWith('employee_')
            )
        );

        // Evaluate employee rules once per employee across the entire period
        if (employeeRules.length > 0) {
            employeeRules.forEach(rule => {
                const employeeViolations = this.evaluateEmployeeRuleAcrossPeriod(rule, calendarStartDate, timeInterval);
                violations.push(...employeeViolations);
            });
        }

        // Evaluate JSON rules
        if (jsonRules.length > 0) {
            jsonRules.forEach(rule => {
                const jsonViolations = this.evaluateJsonRule(rule);
                violations.push(...jsonViolations);
            });
        }

        // Evaluate daily rules for each day
        if (dailyRules.length > 0) {
            for (let i = 0; i < timeInterval; i++) {
                const date = new Date(calendarStartDate);
                date.setDate(calendarStartDate.getDate() + i);
                const dateString = this.formatDateString(date);

                // Get staffing data for this date
                const staffingData = this.getStaffingDataForDate(date, scheduleMap);

                // Evaluate each daily rule
                dailyRules.forEach(rule => {
                    const ruleViolations = this.evaluateRuleForDate(rule, date, staffingData);
                    violations.push(...ruleViolations);
                });
            }
        }

        // Sort violations by date and severity
        const sortedViolations = this.sortViolations(violations);
        
        // Cache the results
        this.evaluationCache.set(cacheKey, sortedViolations);
        this.lastEvaluationTime = now;
        
        // Log performance metrics
        const endTime = performance.now();
        const duration = endTime - startTime;
        // Debug logging removed to clean up console
        
        return sortedViolations;
    }

    /**
     * Evaluate a single rule (for testing purposes)
     * @param {Object} rule - Rule to evaluate
     * @returns {Array} Array of violations for this rule
     */
    evaluateSingleRule(rule) {
        
        // Handle JSON rules
        if (rule.json) {
            // Debug logging removed to clean up console
            return this.evaluateJsonRule(rule);
        }
        
        // Check if this is an employee-based rule (only for simple rules with conditions)
        const isEmployeeRule = rule.conditions && rule.conditions.some(condition => 
            condition.type && condition.type.startsWith('employee_')
        );
        
        if (isEmployeeRule) {
            // Evaluate as employee rule across the entire period
            const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
            const calendarStartDate = new Date(
                this.workforceManager.currentWeekStart.getFullYear(),
                this.workforceManager.currentWeekStart.getMonth(),
                this.workforceManager.currentWeekStart.getDate()
            );
            
            return this.evaluateEmployeeRuleAcrossPeriod(rule, calendarStartDate, timeInterval);
        } else {
            // Evaluate as daily rule for each day
            const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
            const calendarStartDate = new Date(
                this.workforceManager.currentWeekStart.getFullYear(),
                this.workforceManager.currentWeekStart.getMonth(),
                this.workforceManager.currentWeekStart.getDate()
            );
            
            const violations = [];
            const scheduleMap = this.createScheduleMap();
            
            for (let i = 0; i < timeInterval; i++) {
                const date = new Date(calendarStartDate);
                date.setDate(calendarStartDate.getDate() + i);
                const staffingData = this.getStaffingDataForDate(date, scheduleMap);
                
                const ruleViolations = this.evaluateRuleForDate(rule, date, staffingData);
                violations.push(...ruleViolations);
            }
            
            return violations;
        }
    }

    /**
     * Evaluate a JSON-based rule
     * @param {Object} rule - Rule with JSON configuration
     * @returns {Array} Array of violations for this rule
     */
    evaluateJsonRule(rule) {
        // Debug logging removed to clean up console
        
        if (!rule.json) {
            console.warn('❌ JSON rule missing json property');
            return [];
        }

        // Handle different JSON rule structures
        let conditions = [];
        
        // Structure 1: rule.json.conditions (structured JSON rules)
        if (rule.json.conditions && Array.isArray(rule.json.conditions)) {
            // Debug logging removed to clean up console
            conditions = rule.json.conditions;
        }
        // Structure 2: rule.json is the condition itself (advanced JSON rules)
        else if (rule.json.type && rule.json.operator && rule.json.value !== undefined) {
            // Debug logging removed to clean up console
            conditions = [rule.json];
        }
        // Structure 3: rule.json is a plain text JSON string (raw JSON rules)
        else if (typeof rule.json === 'string') {
            // Debug logging removed to clean up console
            try {
                const parsedJson = JSON.parse(rule.json);
                if (parsedJson.conditions && Array.isArray(parsedJson.conditions)) {
                    conditions = parsedJson.conditions;
                } else if (parsedJson.type && parsedJson.operator && parsedJson.value !== undefined) {
                    conditions = [parsedJson];
                }
            } catch (error) {
                console.warn('❌ Invalid JSON in rule:', error);
                return [];
            }
        }
        // Structure 4: rule.json is an object but doesn't match above patterns
        else if (typeof rule.json === 'object' && rule.json !== null) {
            // Debug logging removed to clean up console
            
            // Check if it has the basic properties of a condition
            if (rule.json.type || rule.json.operator || rule.json.value !== undefined) {
                // Debug logging removed to clean up console
                conditions = [rule.json];
            }
            // Check if it has a nested json property (double-nested structure)
            else if (rule.json.json && typeof rule.json.json === 'object') {
                // Debug logging removed to clean up console
                const innerJson = rule.json.json;
                if (innerJson.type || innerJson.operator || innerJson.value !== undefined) {
                    // Debug logging removed to clean up console
                    conditions = [innerJson];
                } else {
                    // Debug logging removed to clean up console
                }
            }
            // Check if it has a conditions array
            else if (rule.json.conditions && Array.isArray(rule.json.conditions)) {
                // Debug logging removed to clean up console
                conditions = rule.json.conditions;
            }
            else {
                // Debug logging removed to clean up console
            }
        }
        
        // Debug logging removed to clean up console
        
        if (conditions.length === 0) {
            console.warn('❌ JSON rule has no valid conditions');
            console.warn('❌ Rule.json structure:', rule.json);
            return [];
        }

        const violations = [];
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        const calendarStartDate = new Date(
            this.workforceManager.currentWeekStart.getFullYear(),
            this.workforceManager.currentWeekStart.getMonth(),
            this.workforceManager.currentWeekStart.getDate()
        );

        // Create schedule lookup map
        const scheduleMap = this.createScheduleMap();

        // Evaluate each day for JSON rules (similar to daily rules)
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            const dateString = this.formatDateString(date);

            // Get staffing data for this date
            const staffingData = this.getStaffingDataForDate(date, scheduleMap);

            // Evaluate JSON rule conditions for this date
            const ruleViolations = this.evaluateJsonRuleForDate(rule, date, staffingData, conditions);
            if (ruleViolations.length > 0) {
                // Debug logging removed to clean up console
            }
            violations.push(...ruleViolations);
        }

        return violations;
    }

    /**
     * Evaluate a JSON rule for a specific date
     * @param {Object} rule - Rule with JSON configuration
     * @param {Date} date - Date to evaluate
     * @param {Object} staffingData - Staffing data for the date
     * @param {Array} conditions - Array of conditions to evaluate
     * @returns {Array} Array of violations for this rule/date
     */
    evaluateJsonRuleForDate(rule, date, staffingData, conditions) {
        const violations = [];
        
        if (!conditions || conditions.length === 0) {
            return violations;
        }

        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday

        // Evaluate each condition in the JSON rule
        conditions.forEach((condition, index) => {
            // Debug logging removed to clean up console
            
            // Check if condition has day filter
            if (condition.dayFilter) {
                let shouldSkip = false;
                let skipReason = '';
                
                if (condition.dayFilter === 'weekdays' && !isWeekday) {
                    shouldSkip = true;
                    skipReason = 'not a weekday';
                }
                if (condition.dayFilter === 'weekends' && !isWeekend) {
                    shouldSkip = true;
                    skipReason = 'not a weekend';
                }
                if (condition.dayFilter === 'monday' && dayOfWeek !== 1) {
                    shouldSkip = true;
                    skipReason = 'not Monday';
                }
                if (condition.dayFilter === 'tuesday' && dayOfWeek !== 2) {
                    shouldSkip = true;
                    skipReason = 'not Tuesday';
                }
                if (condition.dayFilter === 'wednesday' && dayOfWeek !== 3) {
                    shouldSkip = true;
                    skipReason = 'not Wednesday';
                }
                if (condition.dayFilter === 'thursday' && dayOfWeek !== 4) {
                    shouldSkip = true;
                    skipReason = 'not Thursday';
                }
                if (condition.dayFilter === 'friday' && dayOfWeek !== 5) {
                    shouldSkip = true;
                    skipReason = 'not Friday';
                }
                if (condition.dayFilter === 'saturday' && dayOfWeek !== 6) {
                    shouldSkip = true;
                    skipReason = 'not Saturday';
                }
                if (condition.dayFilter === 'sunday' && dayOfWeek !== 0) {
                    shouldSkip = true;
                    skipReason = 'not Sunday';
                }
                
                if (shouldSkip) {
                    return; // Skip this condition
                }
                // 'all' means no filtering, so continue
            }

            const violation = this.evaluateJsonCondition(condition, date, staffingData);
            if (violation) {
                violations.push({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    date: this.formatDateString(date),
                    dateObj: date,
                    condition: condition,
                    violation: violation,
                    severity: condition.severity || 'warning',
                    actualValue: violation.actualValue,
                    expectedValue: violation.expectedValue,
                    message: violation.message
                });
            }
        });

        return violations;
    }

    /**
     * Evaluate a single JSON condition
     * @param {Object} condition - JSON condition to evaluate
     * @param {Date} date - Date to evaluate
     * @param {Object} staffingData - Staffing data for the date
     * @returns {Object|null} Violation object or null if condition passes
     */
    evaluateJsonCondition(condition, date, staffingData) {
        // Handle different condition types from JSON
        switch (condition.type) {
            case 'charge_day_count':
            case 'charge_night_count':
                return this.evaluateChargeCondition(condition, date, staffingData);
            
            case 'amgr_day_count':
            case 'amgr_night_count':
            case 'pct_day_count':
            case 'pct_night_count':
            case 'rn_day_count':
            case 'rn_night_count':
            case 'us_day_count':
            case 'us_night_count':
                return this.evaluateSummaryCondition(condition, date, staffingData);
            
            case 'employee_condition':
                return this.evaluateEmployeeJsonCondition(condition, date, staffingData);
            
            case 'charge_shift_assignments':
                return this.evaluateChargeShiftAssignments(condition, date, staffingData);
            
            case 'employee_job_role_check':
                return this.evaluateEmployeeJobRoleCheck(condition, date, staffingData);
            
            case 'conditional_assignment_warning':
                return this.evaluateConditionalAssignmentWarning(condition, date, staffingData);
            
            default:
                console.warn('❌ Unknown JSON condition type:', condition.type);
                return null;
        }
    }

    /**
     * Evaluate charge-related conditions from JSON
     */
    evaluateChargeCondition(condition, date, staffingData) {
        // This would need to be implemented based on your charge counting logic
        // Debug logging removed to clean up console
        return null; // Placeholder
    }

    /**
     * Evaluate summary conditions from JSON
     */
    evaluateSummaryCondition(condition, date, staffingData) {
        // Debug logging removed to clean up console
        return this.evaluateCondition(condition, date, staffingData);
    }

    /**
     * Evaluate employee conditions from JSON
     */
    evaluateEmployeeJsonCondition(condition, date, staffingData) {
        // Debug logging removed to clean up console
        // This would need to be implemented based on your employee checking logic
        return null; // Placeholder
    }

    /**
     * Evaluate charge shift assignments
     */
    evaluateChargeShiftAssignments(condition, date, staffingData) {
        // Get all employees from the workforce manager (not from staffingData)
        const allEmployees = this.workforceManager.employees || [];
        
        // Filter for employees with Charge shifts (shift name starts with "Charg")
        const chargeEmployees = allEmployees.filter(emp => {
            const schedule = this.workforceManager.schedules.find(s => 
                s.employeeId === emp.id && s.date === staffingData.date
            );
            if (!schedule) return false;
            
            // Find the shift type to get the shift name
            const shiftType = this.workforceManager.shiftTypes.find(st => st.id === schedule.shiftId);
            if (!shiftType) return false;
            
            // Check if shift name starts with "Charg"
            return shiftType.name && shiftType.name.startsWith('Charg');
        });
        
        console.log('🔍 Charge employees found:', chargeEmployees.map(emp => ({
            id: emp.id,
            name: emp.name || 'Unknown Employee',
            jobRole: emp.role || emp.jobRole,
            fullEmployee: emp // Show the full employee object to debug
        })));
        
        // Debug: Show the first employee's full structure
        if (chargeEmployees.length > 0) {
            console.log('🔍 First employee full structure:', chargeEmployees[0]);
        }
        
        return {
            type: 'charge_shift_assignments',
            count: chargeEmployees.length,
            employees: chargeEmployees.map(emp => ({
                id: emp.id,
                name: emp.name || 'Unknown Employee',
                jobRole: emp.role || emp.jobRole
            }))
        };
    }

    /**
     * Evaluate employee job role check
     */
    evaluateEmployeeJobRoleCheck(condition, date, staffingData) {
        const { employeeId, expectedJobRole } = condition;
        
        const employee = this.workforceManager.employees.find(emp => emp.id === employeeId);
        if (!employee) {
            return null;
        }
        
        const hasCorrectRole = employee.jobRole === expectedJobRole;
        
        return {
            type: 'employee_job_role_check',
            employeeId: employeeId,
            actualJobRole: employee.jobRole,
            expectedJobRole: expectedJobRole,
            matches: hasCorrectRole
        };
    }

    /**
     * Evaluate conditional assignment warning
     * This is the main method for your specific rule
     */
    evaluateConditionalAssignmentWarning(condition, date, staffingData) {
        const { minChargeShifts, warningJobRole, shiftType } = condition;
        
        // Use the charge summary data instead of calculating from scratch
        let chargeCount, shiftDescription;
        
        if (shiftType === 'day') {
            chargeCount = this.getSummaryRowCount({ type: 'charge_day_count' }, staffingData);
            shiftDescription = 'day';
        } else if (shiftType === 'night') {
            chargeCount = this.getSummaryRowCount({ type: 'charge_night_count' }, staffingData);
            shiftDescription = 'night';
        } else {
            // Default to total (day + night) - but this should not happen for your rule
            const chargeDayCount = this.getSummaryRowCount({ type: 'charge_day_count' }, staffingData);
            const chargeNightCount = this.getSummaryRowCount({ type: 'charge_night_count' }, staffingData);
            chargeCount = chargeDayCount + chargeNightCount;
            shiftDescription = '';
        }
        
        if (chargeCount < minChargeShifts) {
            return null; // Not enough charge shifts to trigger warning
        }
        
        // Debug: Only log when we have enough charge shifts
        console.log('🔍 Charge shift rule evaluation:', {
            date: staffingData.date,
            shiftType: shiftType || 'all',
            chargeCount: chargeCount,
            minChargeShifts: minChargeShifts
        });
        
        // Get charge shift assignments to check for AMGR assignments
        const chargeAssignments = this.evaluateChargeShiftAssignments({}, date, staffingData);
        
        console.log('🔍 All charge assignments:', {
            totalAssignments: chargeAssignments.employees.length,
            assignments: chargeAssignments.employees.map(emp => ({
                name: emp.name,
                jobRole: emp.jobRole
            }))
        });
        
        // Filter by shift type if specified
        let relevantAssignments = chargeAssignments.employees;
        if (shiftType === 'day' || shiftType === 'night') {
            relevantAssignments = chargeAssignments.employees.filter(emp => {
                const schedule = this.workforceManager.schedules.find(s => 
                    s.employeeId === emp.id && s.date === staffingData.date
                );
                if (!schedule) {
                    console.log('🔍 No schedule found for employee:', emp.name);
                    return false;
                }
                
                const shiftTypeObj = this.workforceManager.shiftTypes.find(st => st.id === schedule.shiftId);
                if (!shiftTypeObj) {
                    console.log('🔍 No shift type found for employee:', emp.name, 'shiftId:', schedule.shiftId);
                    return false;
                }
                
                // Check if it's a charge shift and matches the shift type
                if (!shiftTypeObj.name.startsWith('Charg')) {
                    console.log('🔍 Not a charge shift for employee:', emp.name, 'shiftName:', shiftTypeObj.name);
                    return false;
                }
                
                // For day shifts, check if it's not a night shift
                if (shiftType === 'day') {
                    const isDayShift = !this.isNightShift(shiftTypeObj.name);
                    console.log('🔍 Checking day shift:', {
                        employee: emp.name,
                        shiftName: shiftTypeObj.name,
                        isNightShift: this.isNightShift(shiftTypeObj.name),
                        isDayShift: isDayShift
                    });
                    return isDayShift;
                }
                // For night shifts, check if it is a night shift
                if (shiftType === 'night') {
                    const isNightShift = this.isNightShift(shiftTypeObj.name);
                    console.log('🔍 Checking night shift:', {
                        employee: emp.name,
                        shiftName: shiftTypeObj.name,
                        isNightShift: isNightShift
                    });
                    return isNightShift;
                }
                
                return true;
            });
            
            console.log('🔍 Filtered assignments for', shiftType, 'shifts:', {
                filteredCount: relevantAssignments.length,
                assignments: relevantAssignments.map(emp => ({
                    name: emp.name,
                    jobRole: emp.jobRole
                }))
            });
        }
        
        // Check if any charge shift is assigned to an employee with the warning job role
        const hasWarningAssignment = relevantAssignments.some(emp => 
            emp.jobRole === warningJobRole
        );
        
        console.log('🔍 AMGR check:', {
            warningJobRole: warningJobRole,
            hasWarningAssignment: hasWarningAssignment,
            relevantAssignments: relevantAssignments.map(emp => emp ? emp.jobRole : 'undefined'),
            fullRelevantAssignments: relevantAssignments
        });
        
        if (hasWarningAssignment) {
            const warningEmployee = relevantAssignments.find(emp => 
                emp.jobRole === warningJobRole
            );
            
            console.log('✅ Rule violation found:', {
                employee: warningEmployee.name,
                jobRole: warningEmployee.jobRole,
                chargeCount: chargeCount,
                shiftType: shiftType
            });
            
            const shiftTypeText = shiftType ? ` ${shiftType}` : '';
            return {
                type: 'conditional_assignment_warning',
                description: `Warning: ${warningEmployee.name} (${warningJobRole}) assigned to Charge${shiftTypeText} shift when ${chargeCount} Charge${shiftTypeText} shifts exist`,
                actualValue: chargeCount,
                expectedValue: minChargeShifts,
                operator: 'greater_than_or_equal',
                message: `AMGR assigned to Charge${shiftTypeText} shift when ${chargeCount} Charge${shiftTypeText} shifts are scheduled`,
                severity: 'warning'
            };
        }
        
        console.log('❌ No AMGR found in charge assignments');
        return null;
    }

    /**
     * Check if a shift name represents a night shift
     */
    isNightShift(shiftName) {
        if (!shiftName) return false;

        const nightPatterns = [
            /^ANM N/i,  // Matches "ANM N" (case insensitive)
            /^18/,      // Matches "18*" (starts with 18)
            /^Night/i   // Matches "Night*" (case insensitive)
        ];

        return nightPatterns.some(pattern => pattern.test(shiftName));
    }

    /**
     * Evaluate an employee-based rule across the entire period (once per employee)
     * @param {Object} rule - Rule to evaluate
     * @param {Date} calendarStartDate - Start date of the calendar period
     * @param {number} timeInterval - Number of days in the period
     * @returns {Array} Array of violations for this rule
     */
    evaluateEmployeeRuleAcrossPeriod(rule, calendarStartDate, timeInterval) {
        const violations = [];
        
        // Get all employees that match the filter criteria
        const filteredEmployees = this.getFilteredEmployees(rule.conditions);
        // Debug logging removed to clean up console
        
        // Evaluate each employee once across the entire period
        filteredEmployees.forEach(employee => {
            // Debug logging removed to clean up console
            
            // Get employee name - the app uses employee.name in "Last,First" format
            let employeeName;
            if (employee.name) {
                // Handle "Last,First" format - convert to "First Last"
                if (employee.name.includes(',')) {
                    const parts = employee.name.split(',');
                    const lastName = parts[0].trim();
                    const firstName = parts[1].trim();
                    employeeName = `${firstName} ${lastName}`;
                } else {
                    // Handle "First Last" format or single name
                    employeeName = employee.name;
                }
            } else {
                employeeName = 'Unknown Employee';
            }
            
            // Collect all violations for this employee
            const employeeViolations = [];
            
            if (rule.conditions) {
                rule.conditions.forEach(condition => {
                    if (!condition.type.startsWith('employee_')) return;
                
                try {
                    // Calculate values across the entire period
                    const actualValue = this.getEmployeeConditionValueAcrossPeriod(condition, employee.id, calendarStartDate, timeInterval);
                    const expectedValue = condition.value;
                    const operator = condition.operator;
                    
                    // Debug logging removed to clean up console
                    
                    let isViolation = false;
                    switch (operator) {
                        case 'equals':
                            isViolation = actualValue !== expectedValue;
                            break;
                        case 'greater_than':
                            isViolation = actualValue <= expectedValue;
                            break;
                        case 'greater_than_or_equal':
                            isViolation = actualValue < expectedValue;
                            break;
                        case 'less_than':
                            isViolation = actualValue < expectedValue;
                            break;
                        case 'less_than_or_equal':
                            isViolation = actualValue > expectedValue;
                            break;
                    }
                    
                    if (isViolation) {
                        const description = this.getEmployeeConditionDescription(condition, employeeName, actualValue, expectedValue);
                        employeeViolations.push({
                            condition: condition.type,
                            description: description,
                            actualValue: actualValue,
                            expectedValue: expectedValue,
                            operator: operator,
                            severity: condition.severity
                        });
                    }
                } catch (error) {
                    console.error(`Error evaluating employee condition for ${employee.id}:`, error);
                }
                });
            }
            
            // Create a single violation for this employee if any conditions failed
            if (employeeViolations.length > 0) {
                // Combine all violation descriptions
                const combinedDescription = employeeViolations.map(v => v.description).join('; ');
                
                // Use the highest severity
                const severities = employeeViolations.map(v => v.severity);
                const severity = severities.includes('error') ? 'error' : 
                               severities.includes('warning') ? 'warning' : 'info';
                
                violations.push({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    date: 'Period', // Use "Period" instead of a specific date
                    dateObj: null, // No specific date for period-based violations
                    severity: severity,
                    message: combinedDescription,
                    employeeId: employee.id,
                    employeeName: employeeName,
                    violations: employeeViolations // Store individual violations for details
                });
            }
        });
        
        return violations;
    }

    /**
     * Evaluate an employee-based rule for a specific date
     * @param {Object} rule - Rule to evaluate
     * @param {Date} date - Date to evaluate
     * @param {Object} staffingData - Staffing data for the date
     * @returns {Array} Array of violations for this rule/date
     */
    evaluateEmployeeRule(rule, date, staffingData) {
        const violations = [];
        
        // Get all employees that match the filter criteria
        const filteredEmployees = this.getFilteredEmployees(rule.conditions);
        // Debug logging removed to clean up console
        
        // Evaluate each employee
        filteredEmployees.forEach(employee => {
            // Debug logging removed to clean up console
            if (rule.conditions) {
                rule.conditions.forEach(condition => {
                    if (!condition.type.startsWith('employee_')) return;
                
                try {
                    const actualValue = this.getEmployeeConditionValue(condition, employee.id);
                    const expectedValue = condition.value;
                    const operator = condition.operator;
                    
                    // Debug logging removed to clean up console
                    
                    let isViolation = false;
                    switch (operator) {
                        case 'equals':
                            isViolation = actualValue !== expectedValue;
                            break;
                        case 'greater_than':
                            isViolation = actualValue <= expectedValue;
                            break;
                        case 'greater_than_or_equal':
                            isViolation = actualValue < expectedValue;
                            break;
                        case 'less_than':
                            isViolation = actualValue < expectedValue;
                            break;
                        case 'less_than_or_equal':
                            isViolation = actualValue > expectedValue;
                            break;
                    }
                    
                    if (isViolation) {
                        // Get employee name - the app uses employee.name in "Last,First" format
                        let employeeName;
                        if (employee.name) {
                            // Handle "Last,First" format - convert to "First Last"
                            if (employee.name.includes(',')) {
                                const parts = employee.name.split(',');
                                const lastName = parts[0].trim();
                                const firstName = parts[1].trim();
                                employeeName = `${firstName} ${lastName}`;
                            } else {
                                // Handle "First Last" format or single name
                                employeeName = employee.name;
                            }
                        } else {
                            employeeName = 'Unknown Employee';
                        }
                        const description = this.getEmployeeConditionDescription(condition, employeeName, actualValue, expectedValue);
                        
                        violations.push({
                            ruleId: rule.id,
                            ruleName: rule.name,
                            date: this.formatDateString(date),
                            dateObj: date,
                            severity: condition.severity,
                            message: description,
                            employeeId: employee.id,
                            employeeName: employeeName,
                            actualValue: actualValue,
                            expectedValue: expectedValue,
                            operator: operator
                        });
                    }
                } catch (error) {
                    console.error(`Error evaluating employee condition for ${employee.id}:`, error);
                }
                });
            }
        });
        
        return violations;
    }

    /**
     * Get the actual value for an employee condition
     * @param {Object} condition - Condition to evaluate
     * @param {string} employeeId - Employee ID
     * @returns {number} Actual value
     */
    /**
     * Get the value for an employee condition across the entire period
     * @param {Object} condition - Condition to evaluate
     * @param {string} employeeId - Employee ID
     * @param {Date} calendarStartDate - Start date of the calendar period
     * @param {number} timeInterval - Number of days in the period
     * @returns {number} Calculated value
     */
    getEmployeeConditionValueAcrossPeriod(condition, employeeId, calendarStartDate, timeInterval) {
        // Create a dummy staffing data object for the period
        const periodStaffingData = {
            startDate: calendarStartDate,
            endDate: new Date(calendarStartDate.getTime() + (timeInterval - 1) * 24 * 60 * 60 * 1000),
            timeInterval: timeInterval
        };

        // Use the existing method but with period data
        return this.getEmployeeConditionValue(condition, employeeId, periodStaffingData);
    }

    getEmployeeConditionValue(condition, employeeId, staffingData = null) {
        const { type } = condition;

        switch (type) {
            case 'employee_total_shifts':
                return this.getEmployeeTotalShifts(employeeId, staffingData);
            case 'employee_vacation_days':
                return this.getEmployeeVacationDays(employeeId, staffingData);
            case 'employee_move_days':
                return this.getEmployeeMoveDays(employeeId, staffingData);
            case 'employee_day_shifts':
                return this.getEmployeeDayShifts(employeeId, staffingData);
            case 'employee_night_shifts':
                return this.getEmployeeNightShifts(employeeId, staffingData);
            case 'employee_weekend_shifts':
                return this.getEmployeeWeekendShifts(employeeId, staffingData);
            case 'employee_weekday_shifts':
                return this.getEmployeeWeekdayShifts(employeeId, staffingData);
            default:
                return 0;
        }
    }

    /**
     * Get employees that match the filter criteria
     * @param {Array} conditions - Rule conditions
     * @returns {Array} Filtered employees
     */
    getFilteredEmployees(conditions) {
        let employees = [...this.workforceManager.employees];
        // Debug logging removed to clean up console
        
        // Apply filters from conditions
        conditions.forEach(condition => {
            if (condition.filters) {
                // Debug logging removed to clean up console
                if (condition.filters.jobType) {
                    const beforeCount = employees.length;
                    employees = employees.filter(emp => emp.jobRole === condition.filters.jobType);
                    // Debug logging removed to clean up console
                }
                if (condition.filters.shiftType) {
                    // Filter by day/night shift - this would need to be implemented based on your shift assignment logic
                    // For now, we'll skip this filter as it requires checking actual shift assignments
                    console.log('⚠️ Shift type filtering not yet implemented for:', condition.filters.shiftType);
                }
                if (condition.filters.employeeId) {
                    const beforeCount = employees.length;
                    employees = employees.filter(emp => emp.id === condition.filters.employeeId);
                    // Debug logging removed to clean up console
                }
            }
        });
        
        // Debug logging removed to clean up console
        return employees;
    }

    /**
     * Get description for employee condition violation
     * @param {Object} condition - Condition that was violated
     * @param {string} employeeName - Name of the employee
     * @param {number} actualValue - Actual value
     * @param {number} expectedValue - Expected value
     * @returns {string} Description of the violation
     */
    getEmployeeConditionDescription(condition, employeeName, actualValue, expectedValue) {
        const operatorText = {
            'equals': 'exactly',
            'greater_than': 'more than',
            'greater_than_or_equal': 'at least',
            'less_than': 'less than',
            'less_than_or_equal': 'at most'
        };
        
        let countType = '';
        switch (condition.type) {
            case 'employee_total_shifts':
                countType = 'total shifts';
                break;
            case 'employee_vacation_days':
                countType = 'vacation days';
                break;
            case 'employee_move_days':
                countType = 'move days';
                break;
            case 'employee_day_shifts':
                countType = 'day shifts';
                break;
            case 'employee_night_shifts':
                countType = 'night shifts';
                break;
            case 'employee_weekend_shifts':
                countType = 'weekend shifts';
                break;
            case 'employee_weekday_shifts':
                countType = 'weekday shifts';
                break;
            default:
                countType = 'shifts';
        }
        
        return `${employeeName} has ${actualValue} ${countType}, but should have ${operatorText[condition.operator] || condition.operator} ${expectedValue}`;
    }

    /**
     * Evaluate a single rule for a specific date
     * @param {Object} rule - Rule to evaluate
     * @param {Date} date - Date to evaluate
     * @param {Object} staffingData - Staffing data for the date
     * @returns {Array} Array of violations for this rule/date
     */
    evaluateRuleForDate(rule, date, staffingData) {
        const violations = [];
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday

        // Evaluate each condition
        if (rule.conditions) {
            rule.conditions.forEach(condition => {
                // Check if condition has day filter
            if (condition.dayFilter) {
                if (condition.dayFilter === 'weekdays' && !isWeekday) {
                    return; // Skip this condition for weekends
                }
                if (condition.dayFilter === 'weekends' && !isWeekend) {
                    return; // Skip this condition for weekdays
                }
                // 'all' means no filtering, so continue
            }

            const violation = this.evaluateCondition(condition, date, staffingData);
            if (violation) {
                violations.push({
                    ruleId: rule.id,
                    ruleName: rule.name,
                    date: this.formatDateString(date),
                    dateObj: date,
                    condition: condition,
                    violation: violation,
                    severity: condition.severity || 'warning'
                });
            }
            });
        }

        // Evaluate complex rules (IF-THEN logic)
        if (rule.complexRules) {
            rule.complexRules.forEach(complexRule => {
                const violation = this.evaluateComplexRule(complexRule, date, staffingData);
                if (violation) {
                    violations.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        date: this.formatDateString(date),
                        dateObj: date,
                        condition: complexRule,
                        violation: violation,
                        severity: complexRule.severity || 'warning'
                    });
                }
            });
        }

        return violations;
    }

    /**
     * Evaluate a single condition
     * @param {Object} condition - Condition to evaluate
     * @param {Date} date - Date being evaluated
     * @param {Object} staffingData - Staffing data for the date
     * @returns {Object|null} Violation object or null if no violation
     */
    evaluateCondition(condition, date, staffingData, employeeId = null) {
        const { type, operator, value, severity } = condition;

        let actualValue = 0;
        let description = '';

        // Use employeeId parameter if provided, otherwise fall back to condition.employeeId
        const targetEmployeeId = employeeId || condition.employeeId;

        switch (type) {
            case 'count_by_role':
                actualValue = this.countByRole(condition.role, staffingData);
                description = `${condition.role} count`;
                break;
            case 'count_by_shift':
                actualValue = this.countByShift(condition.shift, staffingData);
                description = `${condition.shift} shift count`;
                break;
            case 'count_by_shift_and_role':
                actualValue = this.countByShiftAndRole(condition.shift, condition.role, staffingData);
                description = `${condition.role} on ${condition.shift} shift`;
                break;
            case 'count_total':
                actualValue = staffingData.totalStaff;
                description = 'total staff count';
                break;
            // Handle new summary conditions (rowType_shiftType_count format)
            case 'amgr_day_count':
            case 'pct_day_count':
            case 'rn_day_count':
            case 'us_day_count':
            case 'charge_day_count':
            case 'mid_day_count':
            case 'amgr_night_count':
            case 'pct_night_count':
            case 'rn_night_count':
            case 'us_night_count':
            case 'charge_night_count':
            case 'mid_night_count':
                actualValue = this.getSummaryRowCount(condition, staffingData);
                description = this.getSummaryRowDescription(condition);
                break;
            case 'employee_total_shifts':
                actualValue = this.getEmployeeTotalShifts(targetEmployeeId, staffingData);
                description = `employee ${targetEmployeeId} total shifts`;
                break;
            case 'employee_vacation_days':
                actualValue = this.getEmployeeVacationDays(targetEmployeeId, staffingData);
                description = `employee ${targetEmployeeId} vacation days`;
                break;
            case 'employee_move_days':
                actualValue = this.getEmployeeMoveDays(targetEmployeeId, staffingData);
                description = `employee ${targetEmployeeId} move days`;
                break;
            case 'employee_day_shifts':
                actualValue = this.getEmployeeDayShifts(targetEmployeeId, staffingData);
                description = `employee ${targetEmployeeId} day shifts`;
                break;
            case 'employee_night_shifts':
                actualValue = this.getEmployeeNightShifts(targetEmployeeId, staffingData);
                description = `employee ${targetEmployeeId} night shifts`;
                break;
            case 'employee_weekend_shifts':
                actualValue = this.getEmployeeWeekendShifts(targetEmployeeId, staffingData);
                description = `employee ${targetEmployeeId} weekend shifts`;
                break;
            case 'employee_weekday_shifts':
                actualValue = this.getEmployeeWeekdayShifts(targetEmployeeId, staffingData);
                description = `employee ${targetEmployeeId} weekday shifts`;
                break;
            case 'summary_value':
                actualValue = this.getSummaryValue(condition.summaryField, staffingData);
                description = `summary ${condition.summaryField}`;
                break;
            case 'weekend_check':
                actualValue = staffingData.isWeekend;
                description = 'is weekend';
                break;
            case 'weekday_check':
                actualValue = !staffingData.isWeekend;
                description = 'is weekday';
                break;
            default:
                console.warn(`Unknown condition type: ${type}`);
                return null;
        }

        // Check if condition is violated
        const isViolated = this.checkOperator(actualValue, operator, value);
        
        // Debug logging removed to clean up console
        
        if (isViolated) {
            return {
                type: 'condition_violation',
                description: description,
                actualValue: actualValue,
                expectedValue: value,
                operator: operator,
                message: condition.message || this.generateViolationMessage(condition, actualValue)
            };
        }

        return null;
    }

    /**
     * Evaluate complex rules (IF-THEN logic)
     * @param {Object} complexRule - Complex rule to evaluate
     * @param {Date} date - Date being evaluated
     * @param {Object} staffingData - Staffing data for the date
     * @returns {Object|null} Violation object or null if no violation
     */
    evaluateComplexRule(complexRule, date, staffingData) {
        const { if: ifCondition, then: thenCondition } = complexRule;

        // Evaluate IF condition
        const ifViolation = this.evaluateCondition(ifCondition, date, staffingData);
        if (!ifViolation) {
            return null; // IF condition not met, no violation
        }

        // IF condition met, evaluate THEN condition
        const thenViolation = this.evaluateCondition(thenCondition, date, staffingData);
        if (thenViolation) {
            return {
                type: 'complex_rule_violation',
                description: `IF condition met but THEN condition failed`,
                ifCondition: ifCondition,
                thenCondition: thenCondition,
                ifViolation: ifViolation,
                thenViolation: thenViolation,
                message: complexRule.message || 'Complex rule violation'
            };
        }

        return null;
    }

    /**
     * Count employees by role for a specific date
     * @param {string} role - Role to count
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Count of employees with the role
     */
    countByRole(role, staffingData) {
        return staffingData.employeesByRole[role] || 0;
    }

    /**
     * Count employees by shift for a specific date
     * @param {string} shift - Shift to count
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Count of employees on the shift
     */
    countByShift(shift, staffingData) {
        return staffingData.employeesByShift[shift] || 0;
    }

    /**
     * Count employees by both shift and role for a specific date
     * @param {string} shift - Shift to count
     * @param {string} role - Role to count
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Count of employees with the role on the shift
     */
    countByShiftAndRole(shift, role, staffingData) {
        let count = 0;
        staffingData.employees.forEach(employee => {
            if (employee.jobRole === role) {
                // Check if employee is scheduled for this shift on this date
                const scheduleKey = `${employee.id}_${staffingData.date}`;
                const schedule = this.workforceManager.schedules.find(s => 
                    s.employeeId === employee.id && s.date === staffingData.date
                );
                if (schedule) {
                    const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                    if (shiftType && shiftType.name === shift) {
                        count++;
                    }
                }
            }
        });
        return count;
    }

    /**
     * Get total shifts for a specific employee
     * @param {string} employeeId - Employee ID
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Total shifts for the employee
     */
    getEmployeeTotalShifts(employeeId, staffingData) {
        // Debug logging removed to clean up console
        const employee = this.workforceManager.employees.find(emp => emp.id === employeeId);
        if (!employee) {
            console.log('❌ Employee not found:', employeeId);
            return 0;
        }

        // Use existing count filter logic
        const totalShifts = this.countAllEmployeeShifts(employeeId);
        const vacationShifts = this.countEmployeeVacationShifts(employeeId);
        const requestShifts = this.countEmployeeRequestShifts(employeeId);
        
        const actualShifts = totalShifts - vacationShifts - requestShifts;
        
        // Debug logging removed to clean up console
        
        return actualShifts;
    }

    /**
     * Count all shifts for an employee (including vacation and request)
     * @param {string} employeeId - Employee ID
     * @returns {number} Total shift count
     */
    countAllEmployeeShifts(employeeId) {
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        const calendarStartDate = new Date(
            this.workforceManager.currentWeekStart.getFullYear(),
            this.workforceManager.currentWeekStart.getMonth(),
            this.workforceManager.currentWeekStart.getDate()
        );

        let totalShifts = 0;
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            const dateString = this.formatDateString(date);
            
            const schedule = this.workforceManager.schedules?.find(s => 
                s.employeeId === employeeId && s.date === dateString
            );
            if (schedule) {
                totalShifts++;
            }
        }
        return totalShifts;
    }

    /**
     * Count vacation shifts for an employee (shifts containing "C ")
     * @param {string} employeeId - Employee ID
     * @returns {number} Vacation shift count
     */
    countEmployeeVacationShifts(employeeId) {
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        const calendarStartDate = new Date(
            this.workforceManager.currentWeekStart.getFullYear(),
            this.workforceManager.currentWeekStart.getMonth(),
            this.workforceManager.currentWeekStart.getDate()
        );

        let vacCount = 0;
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            const dateString = this.formatDateString(date);
            
            const schedule = this.workforceManager.schedules?.find(s => 
                s.employeeId === employeeId && s.date === dateString
            );
            
            if (schedule) {
                const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                const shiftName = shiftType ? shiftType.name : schedule.shiftType || '';
                
                // Count shifts containing "C " (with space) for Vac
                if (shiftName.includes('C ')) {
                    vacCount++;
                }
            }
        }
        return vacCount;
    }

    /**
     * Count request shifts for an employee (shifts containing "R1" or "R 1")
     * @param {string} employeeId - Employee ID
     * @returns {number} Request shift count
     */
    countEmployeeRequestShifts(employeeId) {
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        const calendarStartDate = new Date(
            this.workforceManager.currentWeekStart.getFullYear(),
            this.workforceManager.currentWeekStart.getMonth(),
            this.workforceManager.currentWeekStart.getDate()
        );

        let reqCount = 0;
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            const dateString = this.formatDateString(date);
            
            const schedule = this.workforceManager.schedules?.find(s => 
                s.employeeId === employeeId && s.date === dateString
            );
            
            if (schedule) {
                const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                const shiftName = shiftType ? shiftType.name : schedule.shiftType || '';
                
                // Count shifts containing "R1" or "R 1" for Req
                if (shiftName.includes('R1') || shiftName.includes('R 1')) {
                    reqCount++;
                }
            }
        }
        return reqCount;
    }

    /**
     * Get vacation days for a specific employee
     * @param {string} employeeId - Employee ID
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Vacation days for the employee
     */
    getEmployeeVacationDays(employeeId, staffingData) {
        // Use the same logic as vacation shift counting (shifts containing "C ")
        return this.countEmployeeVacationShifts(employeeId);
    }

    /**
     * Get move days for a specific employee
     * @param {string} employeeId - Employee ID
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Move days for the employee
     */
    getEmployeeMoveDays(employeeId, staffingData) {
        // Use the same logic as request shift counting (shifts containing "R1" or "R 1")
        return this.countEmployeeRequestShifts(employeeId);
    }

    /**
     * Get summary value for a specific field
     * @param {string} summaryField - Summary field name
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Summary value
     */
    getSummaryValue(summaryField, staffingData) {
        return staffingData.summary[summaryField] || 0;
    }

    /**
     * Check if operator condition is met
     * @param {number} actual - Actual value
     * @param {string} operator - Operator to use
     * @param {number} expected - Expected value
     * @returns {boolean} True if condition is violated
     */
    checkOperator(actual, operator, expected) {
        switch (operator) {
            case 'equals':
                return actual !== expected;
            case 'not_equals':
                return actual === expected;
            case 'greater_than':
                return actual <= expected;
            case 'greater_than_or_equal':
                return actual < expected;
            case 'less_than':
                return actual < expected;
            case 'less_than_or_equal':
                return actual > expected;
            case 'between':
                return actual < expected.min || actual > expected.max;
            default:
                console.warn(`Unknown operator: ${operator}`);
                return false;
        }
    }

    /**
     * Generate violation message
     * @param {Object} condition - Condition that was violated
     * @param {number} actualValue - Actual value found
     * @returns {string} Human-readable violation message
     */
    generateViolationMessage(condition, actualValue) {
        const { type, operator, value } = condition;
        let description = '';

        switch (type) {
            case 'count_by_role':
                description = `${condition.role} count`;
                break;
            case 'count_by_shift':
                description = `${condition.shift} shift count`;
                break;
            case 'count_total':
                description = 'total staff count';
                break;
            // Handle new summary conditions (rowType_shiftType_count format)
            case 'amgr_day_count':
            case 'pct_day_count':
            case 'rn_day_count':
            case 'us_day_count':
            case 'charge_day_count':
            case 'mid_day_count':
            case 'amgr_night_count':
            case 'pct_night_count':
            case 'rn_night_count':
            case 'us_night_count':
            case 'charge_night_count':
            case 'mid_night_count':
                description = this.getSummaryRowDescription(condition);
                break;
        }

        switch (operator) {
            case 'equals':
                return `Expected exactly ${value} ${description}, found ${actualValue}`;
            case 'not_equals':
                return `Expected ${description} to not equal ${value}, found ${actualValue}`;
            case 'greater_than':
                return `Expected ${description} > ${value}, found ${actualValue}`;
            case 'greater_than_or_equal':
                return `Expected ${description} >= ${value}, found ${actualValue}`;
            case 'less_than':
                return `Expected ${description} < ${value}, found ${actualValue}`;
            case 'less_than_or_equal':
                return `Expected ${description} <= ${value}, found ${actualValue}`;
            case 'between':
                return `Expected ${description} between ${value.min}-${value.max}, found ${actualValue}`;
            default:
                return `${description} violation: expected ${operator} ${value}, found ${actualValue}`;
        }
    }

    /**
     * Get staffing data for a specific date
     * @param {Date} date - Date to get data for
     * @param {Map} scheduleMap - Schedule lookup map
     * @returns {Object} Staffing data for the date
     */
    getStaffingDataForDate(date, scheduleMap) {
        const dateString = this.formatDateString(date);
        const employeesByRole = {};
        const employeesByShift = {};
        let totalStaff = 0;

        // Initialize role counts
        this.workforceManager.jobRoles.forEach(role => {
            employeesByRole[role.name] = 0;
        });

        // Initialize shift counts
        this.workforceManager.shiftTypes.forEach(shift => {
            employeesByShift[shift.name] = 0;
        });

        // Count employees for this date
        this.workforceManager.employees.forEach(employee => {
            const scheduleKey = `${employee.id}_${dateString}`;
            const schedule = scheduleMap.get(scheduleKey);

            if (schedule) {
                // Count by role
                if (employee.jobRole) {
                    const role = this.workforceManager.jobRoles.find(r => r.id === employee.jobRole);
                    if (role) {
                        employeesByRole[role.name] = (employeesByRole[role.name] || 0) + 1;
                    }
                }

                // Count by shift
                const shift = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                if (shift) {
                    employeesByShift[shift.name] = (employeesByShift[shift.name] || 0) + 1;
                }

                totalStaff++;
            }
        });

        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const isWeekend = this.isWeekend(date);

        const employeesOnDate = this.workforceManager.employees.filter(emp => {
            const scheduleKey = `${emp.id}_${dateString}`;
            return scheduleMap.has(scheduleKey);
        });
        
        // Debug logging removed to clean up console
        
        return {
            date: dateString,
            dayOfWeek: dayOfWeek,
            isWeekend: isWeekend,
            employeesByRole,
            employeesByShift,
            totalStaff,
            employees: employeesOnDate,
            summary: this.getSummaryDataForDate(date)
        };
    }

    /**
     * Check if a date is a weekend
     * @param {Date} date - Date to check
     * @returns {boolean} True if weekend
     */
    isWeekend(date) {
        const dayOfWeek = date.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    }

    /**
     * Get summary data for a specific date
     * @param {Date} date - Date to get summary for
     * @returns {Object} Summary data
     */
    getSummaryDataForDate(date) {
        if (!this.workforceManager || !this.workforceManager.summaryData) {
            return {
                friday: 0,
                saturday: 0,
                sunday: 0,
                vacation: 0,
                required: 0,
                charge: 0,
                move: 0
            };
        }

        const dateString = this.formatDateString(date);
        const summary = this.workforceManager.summaryData.find(s => s.date === dateString);
        
        if (!summary) {
            return {
                friday: 0,
                saturday: 0,
                sunday: 0,
                vacation: 0,
                required: 0,
                charge: 0,
                move: 0
            };
        }

        return {
            friday: summary.friday || 0,
            saturday: summary.saturday || 0,
            sunday: summary.sunday || 0,
            vacation: summary.vacation || 0,
            required: summary.required || 0,
            charge: summary.charge || 0,
            move: summary.move || 0
        };
    }

    /**
     * Create schedule lookup map for quick access
     * @returns {Map} Schedule lookup map
     */
    createScheduleMap() {
        const scheduleMap = new Map();
        this.workforceManager.schedules.forEach(schedule => {
            const key = `${schedule.employeeId}_${schedule.date}`;
            scheduleMap.set(key, schedule);
        });
        return scheduleMap;
    }

    /**
     * Format date as YYYY-MM-DD string
     * @param {Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDateString(date) {
        return formatDateString(date);
    }

    /**
     * Sort violations by date and severity
     * @param {Array} violations - Array of violations
     * @returns {Array} Sorted violations
     */
    sortViolations(violations) {
        return violations.sort((a, b) => {
            // First sort by date
            const dateCompare = new Date(a.date) - new Date(b.date);
            if (dateCompare !== 0) return dateCompare;

            // Then sort by severity (error > warning > info)
            const severityOrder = { error: 3, warning: 2, info: 1 };
            return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        });
    }

    /**
     * Validate rule structure
     * @param {Object} rule - Rule to validate
     * @returns {boolean} True if valid
     */
    validateRule(rule) {
        if (!rule.name) {
            return false;
        }

        // Handle JSON rules (advanced rules)
        if (rule.json) {
            // Structure 1: rule.json.conditions (structured JSON rules)
            if (rule.json.conditions && Array.isArray(rule.json.conditions)) {
                return rule.json.conditions.every(condition => {
                    return condition.type && condition.operator && condition.value !== undefined;
                });
            }
            // Structure 2: rule.json is the condition itself (advanced JSON rules)
            else if (rule.json.type && rule.json.operator && rule.json.value !== undefined) {
                return true;
            }
            // Structure 3: rule.json is a plain text JSON string (raw JSON rules)
            else if (typeof rule.json === 'string') {
                try {
                    const parsedJson = JSON.parse(rule.json);
                    return (parsedJson.conditions && Array.isArray(parsedJson.conditions)) ||
                           (parsedJson.type && parsedJson.operator && parsedJson.value !== undefined);
                } catch (error) {
                    return false;
                }
            }
            // Structure 4: rule.json is an object but not structured
            else if (typeof rule.json === 'object' && rule.json !== null) {
                // Check for nested json property (double-nested structure)
                if (rule.json.json && typeof rule.json.json === 'object') {
                    const innerJson = rule.json.json;
                    return innerJson.type && innerJson.operator && innerJson.value !== undefined;
                }
                // Check for conditions array
                else if (rule.json.conditions && Array.isArray(rule.json.conditions)) {
                    return rule.json.conditions.every(condition => {
                        return condition.type && condition.operator && condition.value !== undefined;
                    });
                }
                // Allow any object structure for advanced rules
                return true;
            }
            return false;
        }

        // Handle condition-based rules (simple rules)
        if (!rule.conditions || !Array.isArray(rule.conditions)) {
            return false;
        }

        // Validate each condition
        return rule.conditions.every(condition => {
            return condition.type && condition.operator && condition.value !== undefined;
        });
    }

    /**
     * Generate unique rule ID
     * @returns {string} Unique rule ID
     */
    generateRuleId() {
        return `rule_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`;
    }

    /**
     * Save rules to storage (both Firestore and localStorage)
     */
    async saveRules() {
        try {
            console.log('🔄 Saving rules...', {
                rulesCount: this.rules.length,
                user: this.workforceManager?.authManager?.user?.email,
                isAdmin: this.workforceManager?.authManager?.adminEmails?.has(this.workforceManager?.authManager?.user?.email?.toLowerCase()),
                firebaseManager: !!this.workforceManager?.firebaseManager,
                currentOrgId: this.workforceManager?.firebaseManager?.currentOrgId
            });
            
            // Save to localStorage as backup
            localStorage.setItem('workforce_rules', JSON.stringify(this.rules));
            console.log('✅ Rules saved to localStorage');
            
            // Save to Firestore if available
            if (this.workforceManager && this.workforceManager.firebaseManager) {
                try {
                    console.log('🔄 Attempting to save rules to Firestore...');
                    await this.workforceManager.firebaseManager.batchReplace('rules', this.rules);
                    console.log('✅ Rules saved to Firestore');
                } catch (firestoreError) {
                    console.warn('⚠️ Failed to save rules to Firestore:', firestoreError);
                    // Continue with localStorage save even if Firestore fails
                }
            } else {
                console.log('📝 Firebase not available, using localStorage only');
            }
        } catch (error) {
            console.error('❌ Failed to save rules:', error);
        }
    }

    /**
     * Load rules from storage (Firestore first, then localStorage fallback)
     */
    async loadRules() {
        try {
            console.log('🔄 Loading rules...', {
                user: this.workforceManager?.authManager?.user?.email,
                isAdmin: this.workforceManager?.authManager?.adminEmails?.has(this.workforceManager?.authManager?.user?.email?.toLowerCase()),
                firebaseManager: !!this.workforceManager?.firebaseManager,
                currentOrgId: this.workforceManager?.firebaseManager?.currentOrgId
            });
            
            // Try to load from Firestore first
            if (this.workforceManager && this.workforceManager.firebaseManager) {
                try {
                    console.log('🔄 Attempting to load rules from Firestore...');
                    const firestoreRules = await this.workforceManager.firebaseManager.read('rules');
                    console.log('🔄 Firestore rules response:', {
                        rulesCount: firestoreRules?.length || 0,
                        rules: firestoreRules
                    });
                    
                    if (firestoreRules && firestoreRules.length > 0) {
                        this.rules = firestoreRules;
                        console.log(`✅ Loaded ${this.rules.length} rules from Firestore`);
                        
                        // Update localStorage with Firestore data
                        localStorage.setItem('workforce_rules', JSON.stringify(this.rules));
                        return;
                    } else {
                        console.log('📝 No rules found in Firestore');
                    }
                } catch (firestoreError) {
                    console.warn('⚠️ Failed to load rules from Firestore:', firestoreError);
                }
            } else {
                console.log('📝 Firebase manager not available for rules loading');
            }
            
            // Fallback to localStorage
            console.log('🔄 Falling back to localStorage...');
            const saved = localStorage.getItem('workforce_rules');
            if (saved) {
                this.rules = JSON.parse(saved);
                console.log(`✅ Loaded ${this.rules.length} rules from localStorage`);
            } else {
                this.rules = [];
                console.log('📝 No rules found in localStorage');
            }
        } catch (error) {
            console.error('❌ Failed to load rules:', error);
            this.rules = [];
        }
    }

    /**
     * Get all rules
     * @returns {Array} Array of all rules
     */
    getRules() {
        return this.rules;
    }

    /**
     * Get rule by ID
     * @param {string} ruleId - ID of rule to get
     * @returns {Object|null} Rule object or null if not found
     */
    getRule(ruleId) {
        return this.rules.find(rule => rule.id === ruleId) || null;
    }

    /**
     * Get rule templates
     * @returns {Array} Array of rule templates
     */
    getRuleTemplates() {
        return this.ruleTemplates;
    }

    /**
     * Determine the type of a rule
     * @param {Object} rule - Rule to analyze
     * @returns {string} Rule type: 'simple', 'advanced', or 'unknown'
     */
    getRuleType(rule) {
        if (rule.json) {
            return 'advanced';
        } else if (rule.conditions && Array.isArray(rule.conditions)) {
            return 'simple';
        }
        return 'unknown';
    }

    /**
     * Get display name for rule type
     * @param {Object} rule - Rule to analyze
     * @returns {string} Display name for the rule type
     */
    getRuleTypeDisplayName(rule) {
        const type = this.getRuleType(rule);
        switch (type) {
            case 'simple':
                return 'Simple Rule';
            case 'advanced':
                return 'Advanced JSON Rule';
            default:
                return 'Unknown Rule Type';
        }
    }

    /**
     * Create rule from template
     * @param {string} templateId - ID of template to use
     * @param {Object} customizations - Customizations to apply
     * @returns {Object} New rule created from template
     */
    createRuleFromTemplate(templateId, customizations = {}) {
        const template = this.ruleTemplates.find(t => t.id === templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        const rule = {
            ...template.rule,
            ...customizations,
            id: this.generateRuleId(),
            enabled: true
        };

        return rule;
    }

    /**
     * Get employee day shifts for a specific date
     * @param {string} employeeId - Employee ID
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Number of day shifts
     */
    getEmployeeDayShifts(employeeId, staffingData) {
        // Count day shifts for the employee using shift type names
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        const calendarStartDate = new Date(
            this.workforceManager.currentWeekStart.getFullYear(),
            this.workforceManager.currentWeekStart.getMonth(),
            this.workforceManager.currentWeekStart.getDate()
        );

        let dayCount = 0;
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            const dateString = this.formatDateString(date);
            
            const schedule = this.workforceManager.schedules?.find(s => 
                s.employeeId === employeeId && s.date === dateString
            );
            
            if (schedule) {
                const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                const shiftName = shiftType ? shiftType.name : schedule.shiftType || '';
                
                // Count day shifts (not vacation "C " or request "R1"/"R 1")
                const isDayShift = shiftName.toLowerCase().includes('day') && 
                                 !shiftName.includes('C ') && 
                                 !shiftName.includes('R1') && 
                                 !shiftName.includes('R 1');
                
                if (isDayShift) {
                    dayCount++;
                }
            }
        }
        return dayCount;
    }

    /**
     * Get employee night shifts for a specific date
     * @param {string} employeeId - Employee ID
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Number of night shifts
     */
    getEmployeeNightShifts(employeeId, staffingData) {
        // Count night shifts for the employee using shift type names
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        const calendarStartDate = new Date(
            this.workforceManager.currentWeekStart.getFullYear(),
            this.workforceManager.currentWeekStart.getMonth(),
            this.workforceManager.currentWeekStart.getDate()
        );

        let nightCount = 0;
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            const dateString = this.formatDateString(date);
            
            const schedule = this.workforceManager.schedules?.find(s => 
                s.employeeId === employeeId && s.date === dateString
            );
            
            if (schedule) {
                const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                const shiftName = shiftType ? shiftType.name : schedule.shiftType || '';
                
                // Count night shifts (not vacation "C " or request "R1"/"R 1")
                const isNightShift = shiftName.toLowerCase().includes('night') && 
                                   !shiftName.includes('C ') && 
                                   !shiftName.includes('R1') && 
                                   !shiftName.includes('R 1');
                
                if (isNightShift) {
                    nightCount++;
                }
            }
        }
        return nightCount;
    }

    /**
     * Get employee weekend shifts for a specific date
     * @param {string} employeeId - Employee ID
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Number of weekend shifts
     */
    getEmployeeWeekendShifts(employeeId, staffingData) {
        // Count weekend shifts for the employee using day of week
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        const calendarStartDate = new Date(
            this.workforceManager.currentWeekStart.getFullYear(),
            this.workforceManager.currentWeekStart.getMonth(),
            this.workforceManager.currentWeekStart.getDate()
        );

        let weekendCount = 0;
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            const dateString = this.formatDateString(date);
            
            // Check if it's a weekend (Saturday = 6, Sunday = 0)
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            if (isWeekend) {
                const schedule = this.workforceManager.schedules?.find(s => 
                    s.employeeId === employeeId && s.date === dateString
                );
                
                if (schedule) {
                    const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                    const shiftName = shiftType ? shiftType.name : schedule.shiftType || '';
                    
                    // Count weekend shifts (not vacation "C " or request "R1"/"R 1")
                    const isWorkShift = !shiftName.includes('C ') && 
                                      !shiftName.includes('R1') && 
                                      !shiftName.includes('R 1') &&
                                      shiftName && shiftName !== 'Off';
                    
                    if (isWorkShift) {
                        weekendCount++;
                    }
                }
            }
        }
        return weekendCount;
    }

    /**
     * Get employee weekday shifts for a specific date
     * @param {string} employeeId - Employee ID
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Number of weekday shifts
     */
    getEmployeeWeekdayShifts(employeeId, staffingData) {
        // Count weekday shifts for the employee using day of week
        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        const calendarStartDate = new Date(
            this.workforceManager.currentWeekStart.getFullYear(),
            this.workforceManager.currentWeekStart.getMonth(),
            this.workforceManager.currentWeekStart.getDate()
        );

        let weekdayCount = 0;
        for (let i = 0; i < timeInterval; i++) {
            const date = new Date(calendarStartDate);
            date.setDate(calendarStartDate.getDate() + i);
            const dateString = this.formatDateString(date);
            
            // Check if it's a weekday (Monday = 1 through Friday = 5)
            const dayOfWeek = date.getDay();
            const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
            
            if (isWeekday) {
                const schedule = this.workforceManager.schedules?.find(s => 
                    s.employeeId === employeeId && s.date === dateString
                );
                
                if (schedule) {
                    const shiftType = this.workforceManager.shiftTypes.find(s => s.id === schedule.shiftId);
                    const shiftName = shiftType ? shiftType.name : schedule.shiftType || '';
                    
                    // Count weekday shifts (not vacation "C " or request "R1"/"R 1")
                    const isWorkShift = !shiftName.includes('C ') && 
                                      !shiftName.includes('R1') && 
                                      !shiftName.includes('R 1') &&
                                      shiftName && shiftName !== 'Off';
                    
                    if (isWorkShift) {
                        weekdayCount++;
                    }
                }
            }
        }
        return weekdayCount;
    }

    /**
     * Get count for a specific summary row (AMGR, PCT, RN, US, CHARGE, MID) and shift type
     * @param {Object} condition - Condition with rowType and shiftType or type like 'rn_day_count'
     * @param {Object} staffingData - Staffing data for the date
     * @returns {number} Count for the specified row and shift
     */
    getSummaryRowCount(condition, staffingData) {
        let rowType, shiftType;
        
        // Check if condition has separate rowType and shiftType properties
        if (condition.rowType && condition.shiftType) {
            rowType = condition.rowType;
            shiftType = condition.shiftType;
        }
        // Otherwise, extract from condition type (e.g., 'rn_day_count' -> rowType: 'rn', shiftType: 'day')
        else if (condition.type) {
            const typeMatch = condition.type.match(/^(.+)_(day|night)_count$/);
            if (typeMatch) {
                rowType = typeMatch[1];
                shiftType = typeMatch[2];
            } else {
                console.warn('❌ Cannot extract rowType and shiftType from condition type:', condition.type);
                return 0;
            }
        } else {
            console.warn('❌ Condition missing rowType/shiftType or type property:', condition);
            return 0;
        }
        
        // Debug logging removed to clean up console
        
        // Get the pre-calculated summary data from the workforce manager
        if (!this.workforceManager.calendarRenderer || !this.workforceManager.calendarRenderer.workerCountData) {
            console.warn('❌ No pre-calculated summary data available');
        // Debug logging removed to clean up console
            return 0;
        }
        
        const summaryData = this.workforceManager.calendarRenderer.workerCountData;
        const dateString = staffingData.date;
        
        // Find the date index in the summary data
        const dateIndex = this.getDateIndexInSummary(dateString);
        
        if (dateIndex === -1) {
            console.warn('❌ Date not found in summary data:', dateString);
            // Debug logging removed to clean up console
            return 0;
        }
        
        // Debug logging removed to clean up console
        
        // Map rowType to the corresponding data property
        const dataPropertyMap = {
            'amgr': shiftType === 'day' ? 'amgrDayCounts' : 'amgrNightCounts',
            'pct': shiftType === 'day' ? 'pctDayCounts' : 'pctNightCounts',
            'rn': shiftType === 'day' ? 'rnDayCounts' : 'rnNightCounts',
            'us': shiftType === 'day' ? 'usDayCounts' : 'usNightCounts',
            'charge': shiftType === 'day' ? 'chargeDayCounts' : 'chargeNightCounts',
            'mid': shiftType === 'day' ? 'midDayCounts' : 'midNightCounts'
        };
        
        const dataProperty = dataPropertyMap[rowType];
        if (!dataProperty) {
            console.warn('❌ Unknown row type:', rowType);
            // Debug logging removed to clean up console
            return 0;
        }
        
        const count = summaryData[dataProperty]?.[dateIndex] || 0;
        
        return count;
    }
    
    /**
     * Get the date index in the summary data arrays
     * @param {string} dateString - Date string in YYYY-MM-DD format
     * @returns {number} Index in the summary arrays, or -1 if not found
     */
    getDateIndexInSummary(dateString) {
        if (!this.workforceManager.calendarRenderer || !this.workforceManager.calendarRenderer.currentWeekDates) {
            return -1;
        }
        
        const weekDates = this.workforceManager.calendarRenderer.currentWeekDates;
        return weekDates.findIndex(date => this.formatDateString(date) === dateString);
    }

    /**
     * Get description for summary row condition
     * @param {Object} condition - Condition with rowType and shiftType or type like 'rn_day_count'
     * @returns {string} Human-readable description
     */
    getSummaryRowDescription(condition) {
        let rowType, shiftType;
        
        // Check if condition has separate rowType and shiftType properties
        if (condition.rowType && condition.shiftType) {
            rowType = condition.rowType;
            shiftType = condition.shiftType;
        }
        // Otherwise, extract from condition type (e.g., 'rn_day_count' -> rowType: 'rn', shiftType: 'day')
        else if (condition.type) {
            const typeMatch = condition.type.match(/^(.+)_(day|night)_count$/);
            if (typeMatch) {
                rowType = typeMatch[1];
                shiftType = typeMatch[2];
            } else {
                console.warn('❌ Cannot extract rowType and shiftType from condition type:', condition.type);
                return 'Unknown summary condition';
            }
        } else {
            console.warn('❌ Condition missing rowType/shiftType or type property:', condition);
            return 'Unknown summary condition';
        }
        
        const shiftText = shiftType === 'day' ? 'Day' : 'Night';
        const rowText = rowType ? rowType.toUpperCase() : 'Unknown';
        return `${rowText} ${shiftText} shift count`;
    }

    /**
     * Initialize the rule engine (load rules from storage)
     */
    async initialize() {
        await this.loadRules();
        console.log('✅ Rule Engine initialized');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleEngine;
}
