// Rule Manager UI Module for Workforce Schedule Manager
/**
 * Provides user interface for creating, editing, and managing staffing rules
 * Handles both simple and advanced rule creation workflows
 */

class RuleManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.ruleEngine = null;
        this.currentRule = null;
        this.isEditing = false;
    }

    /**
     * Initialize the rule manager
     * @param {RuleEngine} ruleEngine - Rule engine instance
     */
    initialize(ruleEngine) {
        this.ruleEngine = ruleEngine;
        this.setupEventListeners();
    }

    /**
     * Set up event listeners for rule management UI
     */
    setupEventListeners() {
        
        // Add rule button (now in the rules tab)
        const addRuleBtn = document.getElementById('addRuleBtn');
        if (addRuleBtn) {
            addRuleBtn.addEventListener('click', () => {
                this.showNewRuleBuilderModal();
            });
        } else {
            console.error('❌ Add rule button not found!');
        }


        // Rule builder form submission
        const ruleBuilderForm = document.getElementById('ruleBuilderForm');
        if (ruleBuilderForm) {
            ruleBuilderForm.addEventListener('submit', (e) => this.handleRuleSubmit(e));
        }

        // Template selection
        const templateSelect = document.getElementById('ruleTemplateSelect');
        if (templateSelect) {
            templateSelect.addEventListener('change', (e) => this.handleTemplateSelection(e));
        }

        // Rule mode toggle
        const ruleModeToggle = document.getElementById('ruleModeToggle');
        if (ruleModeToggle) {
            ruleModeToggle.addEventListener('change', (e) => this.handleModeToggle(e));
        }
    }

    /**
     * Show the rule management modal
     */
    showRuleManagementModal() {
        const modal = this.createRuleManagementModal();
        document.body.appendChild(modal);
        this.renderRuleList();
    }

    /**
     * Create the rule management modal
     * @returns {HTMLElement} Modal element
     */
    createRuleManagementModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h3><i class="fas fa-cogs"></i> Manage Staffing Rules</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="rule-management-toolbar">
                        <button id="addNewRuleBtn" class="btn btn-primary">
                            <i class="fas fa-plus"></i> Add New Rule
                        </button>
                    </div>
                    <div class="rule-list-container">
                        <div id="ruleList" class="rule-list">
                            <div class="loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i> Loading rules...
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Close</button>
                </div>
            </div>
        `;

        // Add event listeners for new buttons
        modal.querySelector('#addNewRuleBtn').addEventListener('click', () => {
            modal.remove();
            this.showNewRuleBuilderModal();
        });


        return modal;
    }

    /**
     * Render the list of rules
     */
    renderRuleList() {
        const ruleList = document.getElementById('rulesList');
        
        if (!ruleList || !this.ruleEngine) return;

        const rules = this.ruleEngine.getRules();

        if (rules.length === 0) {
            ruleList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cogs"></i>
                    <h3>No Rules Created</h3>
                    <p>Create your first staffing rule to get started.</p>
                    <button class="btn btn-primary" onclick="this.closest('.modal').remove(); window.ruleManager.showNewRuleBuilderModal();">
                        <i class="fas fa-plus"></i> Create First Rule
                    </button>
                </div>
            `;
            return;
        }

        // Render rules
        const rulesHTML = rules.map(rule => this.createRuleCard(rule)).join('');
        ruleList.innerHTML = rulesHTML;

        // Add event listeners to rule cards
        this.attachRuleCardListeners();
    }

    /**
     * Create a rule card element
     * @param {Object} rule - Rule object
     * @returns {string} HTML string for rule card
     */
    createRuleCard(rule) {
        const ruleDescription = this.generateRuleDescription(rule);
        
        // Determine rule type and styling
        const isEmployeeRule = rule.conditions && rule.conditions.some(c => c.type && c.type.startsWith('employee_'));
        const isSummaryRule = rule.conditions && rule.conditions.some(c => c.type && !c.type.startsWith('employee_'));
        const isAdvancedRule = rule.json;
        
        let ruleTypeIndicator = '';
        let ruleTypeClass = '';
        
        if (isEmployeeRule) {
            ruleTypeIndicator = '<span class="rule-type-badge employee-rule"><i class="fas fa-user"></i> Employee</span>';
            ruleTypeClass = 'employee-rule-card';
        } else if (isSummaryRule) {
            ruleTypeIndicator = '<span class="rule-type-badge summary-rule"><i class="fas fa-calendar-day"></i> Daily</span>';
            ruleTypeClass = 'summary-rule-card';
        } else if (isAdvancedRule) {
            ruleTypeIndicator = '<span class="rule-type-badge advanced-rule"><i class="fas fa-file-code"></i> Advanced</span>';
            ruleTypeClass = 'advanced-rule-card';
        }
        
        return `
            <div class="rule-card ${ruleTypeClass}" data-rule-id="${rule.id}">
                <div class="rule-card-header">
                    <div class="rule-header-left">
                        <label class="rule-toggle-label compact">
                            <input type="checkbox" class="rule-toggle compact" ${rule.enabled ? 'checked' : ''} 
                                   onchange="window.ruleManager.toggleRule('${rule.id}', this.checked)">
                            <span class="toggle-slider compact"></span>
                        </label>
                        <h4 class="rule-title">${rule.name}</h4>
                        ${ruleTypeIndicator}
                    </div>
                    <div class="rule-actions compact">
                        <button class="btn-icon compact" onclick="window.ruleManager.editRule('${rule.id}')" title="Edit Rule">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon compact" onclick="window.ruleManager.duplicateRule('${rule.id}')" title="Duplicate Rule">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn-icon compact danger" onclick="window.ruleManager.deleteRule('${rule.id}')" title="Delete Rule">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="rule-card-body">
                    <div class="rule-description">${rule.description || 'No description provided'}</div>
                    <div class="rule-logic">${ruleDescription}</div>
                </div>
            </div>
        `;
    }

    /**
     * Generate a human-readable description of the rule based on its conditions
     * @param {Object} rule - Rule object
     * @returns {string} Generated rule description
     */
    generateRuleDescription(rule) {
        if (!rule.conditions || rule.conditions.length === 0) {
            return 'No conditions defined';
        }

        if (rule.json) {
            return 'Advanced JSON rule';
        }

        const descriptions = rule.conditions.map(condition => {
            return this.formatConditionText(condition);
        });

        if (descriptions.length === 1) {
            return descriptions[0];
        } else {
            return descriptions.join(' AND ');
        }
    }

    /**
     * Get the highest severity level from a rule's conditions
     * @param {Object} rule - Rule object
     * @returns {string} Highest severity level
     */
    getHighestSeverity(rule) {
        let highestSeverity = 'info';
        const severityOrder = { error: 3, warning: 2, info: 1 };

        if (rule.conditions) {
            rule.conditions.forEach(condition => {
                if (severityOrder[condition.severity] > severityOrder[highestSeverity]) {
                    highestSeverity = condition.severity;
                }
            });
        }

        if (rule.complexRules) {
            rule.complexRules.forEach(complexRule => {
                if (severityOrder[complexRule.severity] > severityOrder[highestSeverity]) {
                    highestSeverity = complexRule.severity;
                }
            });
        }

        return highestSeverity.toUpperCase();
    }

    /**
     * Attach event listeners to rule cards
     */
    attachRuleCardListeners() {
        // Toggle switches are handled inline for simplicity
        // Other actions are handled by global functions
    }

    /**
     * Toggle rule enabled/disabled state
     * @param {string} ruleId - ID of rule to toggle
     * @param {boolean} enabled - New enabled state
     */
    async toggleRule(ruleId, enabled) {
        if (this.ruleEngine) {
            await this.ruleEngine.updateRule(ruleId, { enabled });
        }
    }

    /**
     * Edit a rule
     * @param {string} ruleId - ID of rule to edit
     */
    editRule(ruleId) {
        const rule = this.ruleEngine.getRule(ruleId);
        if (rule) {
            this.currentRule = rule;
            this.isEditing = true;
            this.showRuleBuilderModal();
        }
    }

    /**
     * Duplicate a rule
     * @param {string} ruleId - ID of rule to duplicate
     */
    async duplicateRule(ruleId) {
        const rule = this.ruleEngine.getRule(ruleId);
        if (rule) {
            const duplicatedRule = {
                ...rule,
                id: this.ruleEngine.generateRuleId(),
                name: `${rule.name} (Copy)`,
                enabled: false
            };
            await this.ruleEngine.addRule(duplicatedRule);
            this.renderRuleList();
            
            // Refresh the rules management page
            if (window.workforceManager && window.workforceManager.renderRulesView) {
                window.workforceManager.renderRulesView();
            }
        }
    }

    /**
     * Delete a rule
     * @param {string} ruleId - ID of rule to delete
     */
    async deleteRule(ruleId) {
        const rule = this.ruleEngine.getRule(ruleId);
        if (rule && await showConfirm(`Are you sure you want to delete the rule "${rule.name}"?`, 'Delete Rule')) {
            await this.ruleEngine.removeRule(ruleId);
            this.renderRuleList();
            
            // Refresh the rules management page
            if (window.workforceManager && window.workforceManager.renderRulesView) {
                window.workforceManager.renderRulesView();
            }
        }
    }

    /**
     * Show the rule builder modal
     */
    showRuleBuilderModal() {
        const modal = this.createRuleBuilderModal();
        document.body.appendChild(modal);
        this.initializeRuleBuilder();
        // Populate employee filters when modal is shown with a small delay
        setTimeout(() => {
            this.populateEmployeeFilters();
        }, 100);
    }

    /**
     * Show the rule builder modal for creating a new rule
     */
    showNewRuleBuilderModal() {
        // Reset editing state for new rule creation
        this.currentRule = null;
        this.isEditing = false;
        this.showRuleBuilderModal();
    }

    /**
     * Create the rule builder modal
     * @returns {HTMLElement} Modal element
     */
    createRuleBuilderModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h3><i class="fas fa-tools"></i> ${this.isEditing ? 'Edit Rule' : 'Create New Rule'}</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="ruleBuilderForm">
                        <div class="rule-builder-section">
                            <h4>Basic Information</h4>
                            <div class="form-group">
                                <label for="ruleName">Rule Name *</label>
                                <input type="text" id="ruleName" name="ruleName" required 
                                       placeholder="e.g., Daily Charge Nurse Requirement">
                            </div>
                            <div class="form-group">
                                <label for="ruleDescription">Description</label>
                                <textarea id="ruleDescription" name="ruleDescription" rows="2"
                                          placeholder="Describe what this rule checks for..."></textarea>
                            </div>
                        </div>

                        <div class="rule-builder-section">
                            <h4>Rule Mode</h4>
                            <div class="form-group">
                                <div class="mode-toggle-container">
                                    <div class="mode-toggle">
                                        <input type="checkbox" id="ruleModeToggle" checked>
                                        <div class="toggle-track">
                                            <div class="toggle-thumb"></div>
                                        </div>
                                        <label for="ruleModeToggle" class="toggle-label-overlay"></label>
                                    </div>
                                    <div class="mode-display">
                                        <span class="current-mode" id="currentModeLabel">Simple Mode</span>
                                    </div>
                                </div>
                                <p class="form-help" id="modeHelpText">Simple mode provides an easy interface for creating rules. Advanced mode allows complex JSON-based conditions.</p>
                            </div>
                        </div>

                        <div id="simpleRuleBuilder" class="rule-builder-section">
                            <h4>Rule Conditions</h4>
                            
                            <!-- Employee Tracking Section -->
                            <div class="condition-section">
                                <div class="section-header">
                                    <h5><i class="fas fa-user"></i> Employee Tracking</h5>
                                    <p class="section-description">Filter employees by job type, shift, or name, then test count values</p>
                                </div>
                                
                                <!-- Employee Filter Section -->
                                <div class="employee-filter-section">
                                    <h6>Filter Employees</h6>
                                    <div class="filter-row">
                                        <div class="filter-group">
                                            <label>Job Role</label>
                                            <select id="employeeJobFilter" class="form-select">
                                                <option value="">Any Job Role</option>
                                            </select>
                                        </div>
                                        <div class="filter-group">
                                            <label>Shift (Day/Night)</label>
                                            <select id="employeeShiftFilter" class="form-select">
                                                <option value="">Any Shift</option>
                                            </select>
                                        </div>
                                        <div class="filter-group">
                                            <label>Specific Employee</label>
                                            <select id="employeeNameFilter" class="form-select">
                                                <option value="">Any Employee</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- Condition Builder -->
                                <div class="condition-builder">
                                    <h6>Add Condition</h6>
                                    <div class="condition-row">
                                        <select id="employeeCountType" class="form-select">
                                            <option value="">Select what to count...</option>
                                            <option value="total_shifts">Total Shifts</option>
                                            <option value="vacation_days">Vacation Days</option>
                                            <option value="move_days">Move Days</option>
                                            <option value="day_shifts">Day Shifts</option>
                                            <option value="night_shifts">Night Shifts</option>
                                            <option value="weekend_shifts">Weekend Shifts</option>
                                            <option value="weekday_shifts">Weekday Shifts</option>
                                        </select>
                                        <select id="employeeOperator" class="form-select">
                                            <option value="equals">Exactly</option>
                                            <option value="greater_than">More than</option>
                                            <option value="greater_than_or_equal">At least</option>
                                            <option value="less_than">Less than</option>
                                            <option value="less_than_or_equal">At most</option>
                                        </select>
                                        <input type="number" id="employeeValue" class="form-input" placeholder="0" min="0">
                                        <select id="employeeSeverity" class="form-select">
                                            <option value="error">Error</option>
                                            <option value="warning">Warning</option>
                                            <option value="info">Info</option>
                                        </select>
                                        <button type="button" class="btn-icon" onclick="window.ruleManager.addEmployeeCondition()" title="Add Condition">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                    </div>
                                </div>

                                <!-- Logic Controls -->
                                <div class="logic-controls">
                                    <label>Combine conditions with:</label>
                                    <div class="logic-options">
                                        <label class="logic-option">
                                            <input type="radio" name="employeeLogic" value="AND" checked>
                                            <span>AND (all conditions must be true)</span>
                                        </label>
                                        <label class="logic-option">
                                            <input type="radio" name="employeeLogic" value="OR">
                                            <span>OR (any condition can be true)</span>
                                        </label>
                                    </div>
                                </div>

                                <div id="employeeConditionsList" class="conditions-list">
                                    <!-- Employee conditions will be added here -->
                                </div>
                            </div>

                            <!-- Daily Shift Summary Section -->
                            <div class="condition-section">
                                <div class="section-header">
                                    <h5><i class="fas fa-calendar-day"></i> Daily Shift Summary</h5>
                                    <p class="section-description">Check specific summary rows (AMGR, PCT, RN, US, CHARGE, MID) for day or night shifts</p>
                                </div>
                                <div class="condition-builder">
                                    <div class="condition-row">
                                        <select id="summaryRowType" class="form-select">
                                            <option value="">Select summary row...</option>
                                            <option value="amgr">AMGR</option>
                                            <option value="pct">PCT</option>
                                            <option value="rn">RN</option>
                                            <option value="us">US</option>
                                            <option value="charge">CHARGE</option>
                                            <option value="mid">MID</option>
                                        </select>
                                        <select id="summaryShiftType" class="form-select">
                                            <option value="day">Day Shift</option>
                                            <option value="night">Night Shift</option>
                                        </select>
                                        <select id="summaryDayFilter" class="form-select">
                                            <option value="all">All Days</option>
                                            <option value="weekdays">Weekdays Only</option>
                                            <option value="weekends">Weekends Only</option>
                                            <option value="monday">Monday Only</option>
                                            <option value="tuesday">Tuesday Only</option>
                                            <option value="wednesday">Wednesday Only</option>
                                            <option value="thursday">Thursday Only</option>
                                            <option value="friday">Friday Only</option>
                                            <option value="saturday">Saturday Only</option>
                                            <option value="sunday">Sunday Only</option>
                                        </select>
                                        <select id="summaryOperator" class="form-select">
                                            <option value="equals">Exactly</option>
                                            <option value="greater_than">More than</option>
                                            <option value="greater_than_or_equal">At least</option>
                                            <option value="less_than">Less than</option>
                                            <option value="less_than_or_equal">At most</option>
                                        </select>
                                        <input type="number" id="summaryValue" class="form-input" placeholder="0" min="0">
                                        <select id="summarySeverity" class="form-select">
                                            <option value="error">Error</option>
                                            <option value="warning">Warning</option>
                                            <option value="info">Info</option>
                                        </select>
                                        <button type="button" class="btn-icon" onclick="window.ruleManager.addSummaryCondition()" title="Add Summary Condition">
                                            <i class="fas fa-plus"></i>
                                        </button>
                                    </div>
                                </div>
                                <div id="summaryConditionsList" class="conditions-list">
                                    <!-- Summary conditions will be added here -->
                                </div>
                            </div>
                        </div>

                        <div id="advancedRuleBuilder" class="rule-builder-section" style="display: none;">
                            <h4>Advanced Rule Builder</h4>
                            <div class="form-group">
                                <label>Rule JSON (Advanced Users Only)</label>
                                <textarea id="ruleJson" name="ruleJson" rows="10" 
                                          placeholder="Enter rule JSON here..."></textarea>
                                <p class="form-help">For advanced users who want to create complex rules manually.</p>
                            </div>
                        </div>

                        <div class="rule-builder-section">
                            <h4>Rule Testing</h4>
                            <button type="button" id="testRuleBtn" class="btn btn-secondary">
                                <i class="fas fa-play"></i> Test Rule
                            </button>
                            <div id="ruleTestResults" class="test-results" style="display: none;">
                                <!-- Test results will be shown here -->
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="this.closest('.modal').remove()" class="btn btn-secondary">Cancel</button>
                    <button type="submit" form="ruleBuilderForm" class="btn btn-primary">
                        <i class="fas fa-save"></i> ${this.isEditing ? 'Update Rule' : 'Create Rule'}
                    </button>
                </div>
            </div>
        `;

        return modal;
    }

    /**
     * Initialize the rule builder
     */
    initializeRuleBuilder() {
        this.setupRuleBuilderListeners();
        
        if (this.isEditing && this.currentRule) {
            this.populateRuleForEditing();
        }
    }

    /**
     * Populate employee filter dropdowns
     */
    populateEmployeeFilters() {

        // If data isn't available, retry after a short delay
        if (!this.workforceManager?.jobRoles || !this.workforceManager?.shiftTypes || !this.workforceManager?.employees) {
            setTimeout(() => {
                this.populateEmployeeFilters();
            }, 500);
            return;
        }

        // Populate job types (clear first to avoid duplicates)
        const jobFilter = document.getElementById('employeeJobFilter');
        if (jobFilter) {
            // Clear existing options except the first one
            jobFilter.innerHTML = '<option value="">Any Job Type</option>';
            if (this.workforceManager.jobRoles) {
                this.workforceManager.jobRoles.forEach(role => {
                    const option = document.createElement('option');
                    option.value = role.name;
                    option.textContent = role.name;
                    jobFilter.appendChild(option);
                });
            } else {
                console.warn('⚠️ No job roles available');
            }
        } else {
            console.error('❌ Job filter element not found');
        }

        // Populate shift types (clear first to avoid duplicates)
        const shiftFilter = document.getElementById('employeeShiftFilter');
        if (shiftFilter) {
            // Clear existing options except the first one
            shiftFilter.innerHTML = '<option value="">Any Shift</option>';
            
            // Add simplified shift options
            const shiftOptions = [
                { value: 'day', text: 'Day Shift' },
                { value: 'night', text: 'Night Shift' }
            ];
            
            shiftOptions.forEach(shift => {
                const option = document.createElement('option');
                option.value = shift.value;
                option.textContent = shift.text;
                shiftFilter.appendChild(option);
            });
        } else {
            console.error('❌ Shift filter element not found');
        }

        // Populate employee names (clear first to avoid duplicates)
        const nameFilter = document.getElementById('employeeNameFilter');
        if (nameFilter) {
            // Clear existing options except the first one
            nameFilter.innerHTML = '<option value="">Any Employee</option>';
            if (this.workforceManager.employees) {
                this.workforceManager.employees.forEach(employee => {
                    const option = document.createElement('option');
                    option.value = employee.id;
                    
                    // Handle different name formats consistently
                    let firstName, lastName;
                    if (employee.firstName && employee.lastName) {
                        firstName = employee.firstName;
                        lastName = employee.lastName;
                    } else if (employee.first_name && employee.last_name) {
                        firstName = employee.first_name;
                        lastName = employee.last_name;
                    } else if (employee.name) {
                        // Handle "Last,First" format
                        if (employee.name.includes(',')) {
                            const parts = employee.name.split(',');
                            lastName = parts[0].trim();
                            firstName = parts[1].trim();
                        } else {
                            // Handle "First Last" format
                            const parts = employee.name.split(' ');
                            firstName = parts[0] || 'Unknown';
                            lastName = parts[1] || 'Unknown';
                        }
                    } else {
                        firstName = 'Unknown';
                        lastName = 'Unknown';
                    }
                    
                    option.textContent = `${firstName} ${lastName}`;
                    nameFilter.appendChild(option);
                });
            } else {
                console.warn('⚠️ No employees available');
            }
        } else {
            console.error('❌ Name filter element not found');
        }
    }

    /**
     * Update employee target options based on condition type
     */
    updateEmployeeTargetOptions() {
        const employeeTarget = document.getElementById('employeeTarget');
        const employeeConditionType = document.getElementById('employeeConditionType');
        if (!employeeTarget || !employeeConditionType) return;

        // Clear existing options
        employeeTarget.innerHTML = '<option value="">Select employee...</option>';

        const selectedType = employeeConditionType.value;

        if (selectedType && selectedType.startsWith('employee_')) {
            // Add employee options
            this.workforceManager.employees.forEach(employee => {
                const option = document.createElement('option');
                option.value = employee.id;
                option.textContent = `${employee.firstName} ${employee.lastName}`;
                option.dataset.type = 'employee';
                employeeTarget.appendChild(option);
            });
        }
    }

    /**
     * Update summary target options based on condition type
     */
    updateSummaryTargetOptions() {
        const summaryTarget = document.getElementById('summaryTarget');
        const summaryConditionType = document.getElementById('summaryConditionType');
        if (!summaryTarget || !summaryConditionType) return;

        // Clear existing options
        summaryTarget.innerHTML = '<option value="">Select...</option>';

        const selectedType = summaryConditionType.value;

        switch (selectedType) {
            case 'count_by_role':
            case 'count_by_shift_and_role':
                // Add role options
                this.workforceManager.jobRoles.forEach(role => {
                    const option = document.createElement('option');
                    option.value = role.name;
                    option.textContent = role.name;
                    option.dataset.type = 'role';
                    summaryTarget.appendChild(option);
                });
                break;

            case 'count_by_shift':
            case 'count_by_shift_and_role':
                // Add shift options
                this.workforceManager.shiftTypes.forEach(shift => {
                    const option = document.createElement('option');
                    option.value = shift.name;
                    option.textContent = shift.name;
                    option.dataset.type = 'shift';
                    summaryTarget.appendChild(option);
                });
                break;

            case 'summary_value':
                // Add summary field options
                const summaryFields = [
                    { value: 'friday', label: 'Friday Count' },
                    { value: 'saturday', label: 'Saturday Count' },
                    { value: 'sunday', label: 'Sunday Count' },
                    { value: 'vacation', label: 'Vacation Count' },
                    { value: 'required', label: 'Required Count' },
                    { value: 'charge', label: 'Charge Count' },
                    { value: 'move', label: 'Move Count' }
                ];
                summaryFields.forEach(field => {
                    const option = document.createElement('option');
                    option.value = field.value;
                    option.textContent = field.label;
                    option.dataset.type = 'summary';
                    summaryTarget.appendChild(option);
                });
                break;

            case 'weekend_check':
            case 'weekday_check':
                // No target needed for these types
                summaryTarget.innerHTML = '<option value="true">Yes</option><option value="false">No</option>';
                break;

            case 'count_total':
                // No target needed for total count
                summaryTarget.innerHTML = '<option value="total">Total Staff</option>';
                break;
        }
    }

    /**
     * Set up event listeners for rule builder
     */
    setupRuleBuilderListeners() {
        // Populate employee filter dropdowns
        this.populateEmployeeFilters();
        
        // Add event listener for employee count type changes
        const employeeCountType = document.getElementById('employeeCountType');
        if (employeeCountType) {
            employeeCountType.addEventListener('change', () => {
            });
        }

        // Summary condition type change
        const summaryConditionType = document.getElementById('summaryConditionType');
        if (summaryConditionType) {
            summaryConditionType.addEventListener('change', () => this.updateSummaryTargetOptions());
        }

        // Mode toggle
        const ruleModeToggle = document.getElementById('ruleModeToggle');
        if (ruleModeToggle) {
            ruleModeToggle.addEventListener('change', (e) => {
                this.handleModeToggle(e);
            });
        } else {
            console.error('❌ Mode toggle not found');
        }

        // Mode display click (clicking the mode label toggles the switch)
        const currentModeLabel = document.getElementById('currentModeLabel');
        
        if (currentModeLabel) {
            currentModeLabel.addEventListener('click', () => {
                if (ruleModeToggle) {
                    ruleModeToggle.checked = !ruleModeToggle.checked;
                    this.handleModeToggle({ target: ruleModeToggle });
                }
            });
        }

        // Test rule button
        const testRuleBtn = document.getElementById('testRuleBtn');
        if (testRuleBtn) {
            testRuleBtn.addEventListener('click', () => {
                this.testRule();
            });
        } else {
            console.error('❌ Test rule button not found!');
        }

        // Form submission - ensure it's properly attached
        const form = document.getElementById('ruleBuilderForm');
        if (form) {
            // Remove any existing listeners to avoid duplicates
            form.removeEventListener('submit', this.handleRuleSubmit);
            form.addEventListener('submit', (e) => this.handleRuleSubmit(e));
            console.log('✅ Rule builder form event listener attached');
        } else {
            console.warn('⚠️ Rule builder form not found for event listener');
        }
    }

    /**
     * Update target options based on condition type
     */
    updateTargetOptions() {
        const conditionType = document.getElementById('conditionType');
        const conditionTarget = document.getElementById('conditionTarget');
        
        if (!conditionType || !conditionTarget) return;

        const selectedType = conditionType.value;
        
        // Clear existing options
        conditionTarget.innerHTML = '<option value="">Select...</option>';

        if (selectedType === 'count_by_role') {
            this.workforceManager.jobRoles.forEach(role => {
                const option = document.createElement('option');
                option.value = role.name;
                option.textContent = role.name;
                conditionTarget.appendChild(option);
            });
        } else if (selectedType === 'count_by_shift') {
            this.workforceManager.shiftTypes.forEach(shift => {
                const option = document.createElement('option');
                option.value = shift.name;
                option.textContent = shift.name;
                conditionTarget.appendChild(option);
            });
        } else if (selectedType === 'count_total') {
            const option = document.createElement('option');
            option.value = 'total';
            option.textContent = 'Total Staff';
            conditionTarget.appendChild(option);
        }
    }

    /**
     * Handle mode toggle between simple and advanced
     * @param {Event} event - Toggle event
     */
    handleModeToggle(event) {
        const isSimple = event.target.checked;
        console.log('🔄 Handling mode toggle - isSimple:', isSimple);
        
        const simpleBuilder = document.getElementById('simpleRuleBuilder');
        const advancedBuilder = document.getElementById('advancedRuleBuilder');
        const currentModeLabel = document.getElementById('currentModeLabel');
        const modeHelpText = document.getElementById('modeHelpText');
        
        console.log('📋 Found elements:', {
            simpleBuilder: !!simpleBuilder,
            advancedBuilder: !!advancedBuilder,
            currentModeLabel: !!currentModeLabel,
            modeHelpText: !!modeHelpText
        });
        
        // Toggle visibility
        if (simpleBuilder && advancedBuilder) {
            simpleBuilder.style.display = isSimple ? 'block' : 'none';
            advancedBuilder.style.display = isSimple ? 'none' : 'block';
            console.log('✅ Toggled visibility - simple:', simpleBuilder.style.display, 'advanced:', advancedBuilder.style.display);
        }
        
        // Update mode label
        if (currentModeLabel) {
            currentModeLabel.textContent = isSimple ? 'Simple Mode' : 'Advanced Mode';
            
            // Update color based on mode
            if (isSimple) {
                currentModeLabel.style.color = 'var(--success-600)';
            } else {
                currentModeLabel.style.color = 'var(--primary-600)';
            }
            
            console.log('✅ Updated mode label to:', currentModeLabel.textContent);
        }
        
        // Update help text
        if (modeHelpText) {
            if (isSimple) {
                modeHelpText.textContent = 'Simple mode provides an easy interface for creating rules. Use dropdowns and forms to build conditions.';
                // Clear advanced form when switching to simple mode
                this.clearAdvancedRuleForm();
            } else {
                modeHelpText.textContent = 'Advanced mode allows complex JSON-based conditions. You can create sophisticated rules with custom logic.';
                // Clear simple form when switching to advanced mode
                this.clearEmployeeConditionForm();
                this.clearSummaryConditionForm();
                // Clear any existing conditions from the UI
                const employeeConditionsList = document.getElementById('employeeConditionsList');
                const summaryConditionsList = document.getElementById('summaryConditionsList');
                if (employeeConditionsList) employeeConditionsList.innerHTML = '';
                if (summaryConditionsList) summaryConditionsList.innerHTML = '';
            }
            console.log('✅ Updated help text');
        }
    }

    /**
     * Add an employee condition to the rule
     */
    addEmployeeCondition() {
        console.log('🔧 Adding employee condition...');
        
        const countType = document.getElementById('employeeCountType');
        const operator = document.getElementById('employeeOperator');
        const value = document.getElementById('employeeValue');
        const severity = document.getElementById('employeeSeverity');
        
        // Get filter values
        const jobFilter = document.getElementById('employeeJobFilter');
        const shiftFilter = document.getElementById('employeeShiftFilter');
        const nameFilter = document.getElementById('employeeNameFilter');

        console.log('🔍 Form elements found:', {
            countType: !!countType,
            operator: !!operator,
            value: !!value,
            severity: !!severity,
            jobFilter: !!jobFilter,
            shiftFilter: !!shiftFilter,
            nameFilter: !!nameFilter
        });

        if (!countType || !operator || !value || !severity) {
            console.error('❌ Missing employee condition form elements');
            return;
        }

        const countTypeValue = countType.value;
        const operatorValue = operator.value;
        const valueValue = parseInt(value.value) || 0;
        const severityValue = severity.value;

        console.log('📝 Employee condition data:', { countTypeValue, operatorValue, valueValue, severityValue });

        // Validate
        if (!countTypeValue || isNaN(valueValue)) {
            showAlert('Please select a count type and enter a valid value', 'Incomplete Condition');
            return;
        }

        // Build filter object
        const filters = {};
        if (jobFilter && jobFilter.value) filters.jobType = jobFilter.value;
        if (shiftFilter && shiftFilter.value) filters.shiftType = shiftFilter.value;
        if (nameFilter && nameFilter.value) {
            filters.employeeId = nameFilter.value;
            console.log('🔍 Selected employee ID:', nameFilter.value);
            console.log('🔍 Selected employee text:', nameFilter.options[nameFilter.selectedIndex]?.textContent);
        }

        // Map count type to rule engine condition type
        let conditionType;
        switch (countTypeValue) {
            case 'total_shifts':
                conditionType = 'employee_total_shifts';
                break;
            case 'vacation_days':
                conditionType = 'employee_vacation_days';
                break;
            case 'move_days':
                conditionType = 'employee_move_days';
                break;
            case 'day_shifts':
                conditionType = 'employee_day_shifts';
                break;
            case 'night_shifts':
                conditionType = 'employee_night_shifts';
                break;
            case 'weekend_shifts':
                conditionType = 'employee_weekend_shifts';
                break;
            case 'weekday_shifts':
                conditionType = 'employee_weekday_shifts';
                break;
            default:
                showAlert('Invalid count type selected', 'Invalid Condition');
                return;
        }

        const condition = {
            type: conditionType,
            operator: operatorValue,
            value: valueValue,
            severity: severityValue,
            filters: filters
        };

        console.log('✅ Employee condition created:', condition);
        this.addConditionToUI(condition, 'employeeConditionsList');
        this.clearEmployeeConditionForm();
        
        // Debug: Check if condition was added to UI
        const conditionList = document.getElementById('employeeConditionsList');
        if (conditionList) {
            console.log('📋 Employee conditions list now has', conditionList.children.length, 'items');
        } else {
            console.error('❌ Employee conditions list not found!');
        }
    }

    /**
     * Add a summary condition to the rule
     */
    addSummaryCondition() {
        console.log('🔧 Adding summary condition...');
        
        const rowType = document.getElementById('summaryRowType');
        const shiftType = document.getElementById('summaryShiftType');
        const dayFilter = document.getElementById('summaryDayFilter');
        const operator = document.getElementById('summaryOperator');
        const value = document.getElementById('summaryValue');
        const severity = document.getElementById('summarySeverity');

        if (!rowType || !shiftType || !dayFilter || !operator || !value || !severity) {
            console.error('❌ Missing summary condition form elements');
            return;
        }

        if (!rowType.value || !shiftType.value || !dayFilter.value || !operator.value || value.value === '' || !severity.value) {
            showAlert('Please fill in all summary condition fields', 'Missing Information');
            return;
        }

        // Create condition type based on row type and shift type
        const conditionType = `${rowType.value}_${shiftType.value}_count`;

        const condition = {
            type: conditionType,
            rowType: rowType.value,
            shiftType: shiftType.value,
            dayFilter: dayFilter.value,
            operator: operator.value,
            value: parseInt(value.value) || 0,
            severity: severity.value
        };

        console.log('✅ Summary condition created:', condition);
        this.addConditionToUI(condition, 'summaryConditionsList');
        this.clearSummaryConditionForm();
    }

    /**
     * Add a condition to the rule (legacy method for compatibility)
     */
    addCondition() {
        console.log('🔧 Adding condition...');
        
        const conditionType = document.getElementById('conditionType');
        const conditionTarget = document.getElementById('conditionTarget');
        const conditionOperator = document.getElementById('conditionOperator');
        const conditionValue = document.getElementById('conditionValue');
        const conditionSeverity = document.getElementById('conditionSeverity');

        if (!conditionType || !conditionTarget || !conditionOperator || !conditionValue || !conditionSeverity) {
            console.error('❌ Missing condition form elements');
            return;
        }

        const type = conditionType.value;
        const target = conditionTarget.value;
        const operator = conditionOperator.value;
        const value = parseInt(conditionValue.value);
        const severity = conditionSeverity.value;

        console.log('📝 Condition data:', { type, target, operator, value, severity });

        // Validate based on condition type
        if (type === 'weekend_check' || type === 'weekday_check') {
            // These types don't need target validation
        } else if (type === 'count_total') {
            // Total count doesn't need target
        } else if (!target) {
            showAlert('Please select a target for this condition type', 'Incomplete Condition');
            return;
        }

        // Validate value for numeric conditions
        if (type !== 'weekend_check' && type !== 'weekday_check' && isNaN(value)) {
            showAlert('Please enter a valid numeric value', 'Invalid Value');
            return;
        }

        const condition = {
            type: type,
            operator: operator,
            value: value,
            severity: severity
        };

        // Add target-specific properties based on condition type
        switch (type) {
            case 'count_by_role':
                condition.role = target;
                break;
            case 'count_by_shift':
                condition.shift = target;
                break;
            case 'count_by_shift_and_role':
                // For this type, we need both shift and role
                // The target will be the role, and we need to get shift from a separate field
                condition.role = target;
                // We'll need to add a shift selector for this type
                const shiftSelect = document.getElementById('conditionShift');
                if (shiftSelect) {
                    condition.shift = shiftSelect.value;
                }
                break;
            case 'employee_total_shifts':
            case 'employee_vacation_days':
            case 'employee_move_days':
                condition.employeeId = target;
                break;
            case 'summary_value':
                condition.summaryField = target;
                break;
            case 'weekend_check':
            case 'weekday_check':
                condition.value = target === 'true';
                break;
        }

        console.log('✅ Condition created:', condition);
        this.addConditionToUI(condition);
        this.clearConditionForm();
    }

    /**
     * Add condition to UI
     * @param {Object} condition - Condition to add
     */
    addConditionToUI(condition, containerId = 'conditionsList') {
        console.log('🔧 Adding condition to UI, container:', containerId);
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('❌ Condition container not found:', containerId);
            return;
        }

        console.log('✅ Found container, creating condition element...');
        const conditionElement = document.createElement('div');
        conditionElement.className = 'condition-item';
        conditionElement.dataset.condition = JSON.stringify(condition);
        
        // Create condition display text
        let conditionText = this.formatConditionText(condition);
        console.log('📝 Condition text:', conditionText);
        
        conditionElement.innerHTML = `
            <div class="condition-content">
                <span class="condition-text">
                    ${conditionText}
                </span>
                <span class="condition-severity severity-${condition.severity}">
                    ${condition.severity.toUpperCase()}
                </span>
            </div>
            <button type="button" class="btn-icon danger" onclick="this.parentElement.remove()" title="Remove Condition">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(conditionElement);
        console.log('✅ Condition added to UI:', conditionText);
        console.log('📊 Container now has', container.children.length, 'children');
    }

    /**
     * Format condition text for display
     * @param {Object} condition - Condition to format
     * @returns {string} Formatted condition text
     */
    formatConditionText(condition) {
        const operatorText = {
            'equals': 'exactly',
            'greater_than': 'more than',
            'greater_than_or_equal': 'at least',
            'less_than': 'less than',
            'less_than_or_equal': 'at most'
        };

        // Handle employee conditions with filters
        if (condition.filters) {
            let filterText = '';
            if (condition.filters.jobType) filterText += condition.filters.jobType + ' ';
            if (condition.filters.shiftType) {
                const shiftText = condition.filters.shiftType === 'day' ? 'Day Shift' : 
                                 condition.filters.shiftType === 'night' ? 'Night Shift' : 
                                 condition.filters.shiftType;
                filterText += shiftText + ' ';
            }
            if (condition.filters.employeeId) {
                console.log('🔍 Looking up employee with ID:', condition.filters.employeeId);
                console.log('📊 Available employees:', this.workforceManager.employees?.length || 0);
                console.log('📊 Sample employee IDs:', this.workforceManager.employees?.slice(0, 3).map(e => e.id));
                
                const employee = this.workforceManager.employees?.find(emp => emp.id === condition.filters.employeeId);
                console.log('👤 Found employee:', employee);
                
                if (employee) {
                    let firstName, lastName;
                    
                    // Handle different name formats
                    if (employee.firstName && employee.lastName) {
                        firstName = employee.firstName;
                        lastName = employee.lastName;
                    } else if (employee.first_name && employee.last_name) {
                        firstName = employee.first_name;
                        lastName = employee.last_name;
                    } else if (employee.name) {
                        // Handle "Last,First" format
                        if (employee.name.includes(',')) {
                            const parts = employee.name.split(',');
                            lastName = parts[0].trim();
                            firstName = parts[1].trim();
                        } else {
                            // Handle "First Last" format
                            const parts = employee.name.split(' ');
                            firstName = parts[0] || 'Unknown';
                            lastName = parts[1] || 'Unknown';
                        }
                    } else {
                        firstName = 'Unknown';
                        lastName = 'Unknown';
                    }
                    
                    console.log('📝 Employee name parts:', { firstName, lastName, raw: employee });
                    filterText += firstName + ' ' + lastName + ' ';
                } else {
                    console.warn('⚠️ Employee not found for ID:', condition.filters.employeeId);
                    filterText += 'Unknown Employee ';
                }
            }
            
            // Map condition type to readable text
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

            const filterPrefix = filterText ? `For ${filterText.trim()}: ` : '';
            return `${filterPrefix}${countType} should be ${operatorText[condition.operator] || condition.operator} ${condition.value}`;
        }

        // Handle new summary conditions (rowType_shiftType_count format)
        if (condition.rowType && condition.shiftType) {
            const shiftText = condition.shiftType === 'day' ? 'Day' : 'Night';
            const rowText = condition.rowType.toUpperCase();
            const dayFilterText = condition.dayFilter === 'all' ? '' : 
                                 condition.dayFilter === 'weekdays' ? ' (weekdays only)' :
                                 condition.dayFilter === 'weekends' ? ' (weekends only)' :
                                 condition.dayFilter === 'monday' ? ' (Monday only)' :
                                 condition.dayFilter === 'tuesday' ? ' (Tuesday only)' :
                                 condition.dayFilter === 'wednesday' ? ' (Wednesday only)' :
                                 condition.dayFilter === 'thursday' ? ' (Thursday only)' :
                                 condition.dayFilter === 'friday' ? ' (Friday only)' :
                                 condition.dayFilter === 'saturday' ? ' (Saturday only)' :
                                 condition.dayFilter === 'sunday' ? ' (Sunday only)' : '';
            return `${rowText} ${shiftText} shift count${dayFilterText} should be ${operatorText[condition.operator] || condition.operator} ${condition.value}`;
        }

        // Handle legacy conditions
        let target = '';
        if (condition.role) target = condition.role;
        else if (condition.shift) target = condition.shift;
        else if (condition.type === 'count_total') target = 'total staff';

        return `${target} count should be ${operatorText[condition.operator] || condition.operator} ${condition.value}`;
    }

    /**
     * Clear the condition form
     */
    clearConditionForm() {
        const conditionValue = document.getElementById('conditionValue');
        if (conditionValue) {
            conditionValue.value = '';
        }
    }

    /**
     * Test the current rule
     */
    testRule() {
        console.log('🔧 Testing rule...');
        if (!this.ruleEngine) {
            console.error('❌ Rule engine not available');
            return;
        }

        try {
            const rule = this.buildRuleFromForm();
            if (!rule) {
                console.error('❌ Could not build rule from form');
                return;
            }
            console.log('✅ Rule built successfully:', rule);

            // Create test rule with unique name
            const testRule = { ...rule, name: `TEST_${rule.name}_${Date.now()}` };
            console.log('🔍 Test rule name:', testRule.name);

            // Evaluate only the test rule, not all existing rules
            console.log('🔍 Starting test rule evaluation...');
            const violations = this.ruleEngine.evaluateSingleRule(testRule);
            console.log('📋 Test rule evaluation complete. Violations found:', violations.length);
            console.log('📋 Violations:', violations);

            // Show test results
            this.showTestResults(violations);

        } catch (error) {
            console.error('Error testing rule:', error);
            showAlert('Error testing rule: ' + error.message, 'Test Error');
        }
    }

    /**
     * Build rule from form data
     * @returns {Object|null} Rule object or null if invalid
     */
    buildRuleFromForm() {
        const ruleName = document.getElementById('ruleName')?.value;
        const ruleDescription = document.getElementById('ruleDescription')?.value;
        const ruleJson = document.getElementById('ruleJson')?.value;
        const isAdvanced = document.getElementById('ruleModeToggle')?.checked === false; // Advanced mode when toggle is OFF

        if (!ruleName) {
            showAlert('Please enter a rule name', 'Incomplete Rule');
            return null;
        }

        // Handle advanced JSON rules
        if (isAdvanced) {
            if (!ruleJson || ruleJson.trim() === '') {
                showAlert('Please enter JSON for the advanced rule', 'Missing JSON');
                return null;
            }

            try {
                // Validate JSON
                const parsedJson = JSON.parse(ruleJson);
                
                // Check if the parsed JSON is a complete rule object or just a condition
                if (parsedJson.id && parsedJson.name && parsedJson.json) {
                    // It's a complete rule object, use it as-is but update the name/description
                    return {
                        ...parsedJson,
                        name: ruleName,
                        description: ruleDescription,
                        enabled: true
                    };
                } else {
                    // It's just a condition object, wrap it properly
                    return {
                        name: ruleName,
                        description: ruleDescription,
                        json: parsedJson,
                        enabled: true
                    };
                }
            } catch (error) {
                showAlert('Invalid JSON format. Please check your syntax.', 'JSON Error');
                return null;
            }
        }

        // Handle simple rules with conditions
        const conditions = this.getConditionsFromUI();
        if (conditions.length === 0) {
            showAlert('Please add at least one condition', 'No Conditions');
            return null;
        }

        return {
            name: ruleName,
            description: ruleDescription,
            conditions: conditions,
            enabled: true
        };
    }

    /**
     * Clear employee condition form
     */
    clearEmployeeConditionForm() {
        document.getElementById('employeeCountType').value = '';
        document.getElementById('employeeOperator').value = 'equals';
        document.getElementById('employeeValue').value = '';
        document.getElementById('employeeSeverity').value = 'error';
        // Note: We don't clear the filters as they might be used for multiple conditions
    }

    /**
     * Clear summary condition form
     */
    clearSummaryConditionForm() {
        document.getElementById('summaryRowType').value = '';
        document.getElementById('summaryShiftType').value = 'day';
        document.getElementById('summaryDayFilter').value = 'all';
        document.getElementById('summaryOperator').value = 'equals';
        document.getElementById('summaryValue').value = '';
        document.getElementById('summarySeverity').value = 'error';
    }

    /**
     * Clear advanced rule form
     */
    clearAdvancedRuleForm() {
        const ruleJson = document.getElementById('ruleJson');
        if (ruleJson) {
            ruleJson.value = '';
        }
    }

    /**
     * Get conditions from UI
     * @returns {Array} Array of conditions
     */
    getConditionsFromUI() {
        const conditions = [];
        
        // Get employee conditions
        const employeeConditionItems = document.querySelectorAll('#employeeConditionsList .condition-item');
        console.log('🔍 Found employee condition items:', employeeConditionItems.length);
        
        employeeConditionItems.forEach((item, index) => {
            try {
                const conditionData = item.dataset.condition;
                console.log(`📝 Employee condition ${index + 1} data:`, conditionData);
                
                if (conditionData) {
                    const condition = JSON.parse(conditionData);
                    conditions.push(condition);
                    console.log(`✅ Parsed employee condition ${index + 1}:`, condition);
                } else {
                    console.warn(`⚠️ No condition data found for employee item ${index + 1}`);
                }
            } catch (error) {
                console.error(`❌ Error parsing employee condition ${index + 1}:`, error);
            }
        });
        
        // Get summary conditions
        const summaryConditionItems = document.querySelectorAll('#summaryConditionsList .condition-item');
        console.log('🔍 Found summary condition items:', summaryConditionItems.length);
        
        summaryConditionItems.forEach((item, index) => {
            try {
                const conditionData = item.dataset.condition;
                console.log(`📝 Summary condition ${index + 1} data:`, conditionData);
                
                if (conditionData) {
                    const condition = JSON.parse(conditionData);
                    conditions.push(condition);
                    console.log(`✅ Parsed summary condition ${index + 1}:`, condition);
                } else {
                    console.warn(`⚠️ No condition data found for summary item ${index + 1}`);
                }
            } catch (error) {
                console.error(`❌ Error parsing summary condition ${index + 1}:`, error);
            }
        });

        console.log('📊 Total conditions collected:', conditions.length);
        return conditions;
    }

    /**
     * Show test results
     * @param {Array} violations - Array of violations
     */
    showTestResults(violations) {
        const testResults = document.getElementById('ruleTestResults');
        if (!testResults) return;

        testResults.style.display = 'block';

        if (violations.length === 0) {
            testResults.innerHTML = `
                <div class="test-result success">
                    <i class="fas fa-check-circle"></i>
                    <span>Rule test passed - no violations found</span>
                </div>
            `;
        } else {
            const violationsHTML = violations.slice(0, 10).map(violation => {
                // Debug: Log violation structure
                console.log('🔍 Violation structure:', violation);
                
                // Create detailed violation message
                let violationText = '';
                
                // Handle nested violation structure (daily rules)
                const actualViolation = violation.violation || violation;
                console.log('🔍 Actual violation:', actualViolation);
                
                if (actualViolation.message) {
                    violationText = actualViolation.message;
                } else if (actualViolation.actualValue !== undefined && actualViolation.expectedValue !== undefined) {
                    // Show detailed actual vs expected values
                    const operatorText = {
                        'equals': 'exactly',
                        'greater_than': 'more than',
                        'greater_than_or_equal': 'at least',
                        'less_than': 'less than',
                        'less_than_or_equal': 'at most',
                        'not_equals': 'not equal to'
                    };
                    
                    const operator = operatorText[actualViolation.operator] || actualViolation.operator;
                    violationText = `Found ${actualViolation.actualValue}, but should be ${operator} ${actualViolation.expectedValue}`;
                } else if (actualViolation.description) {
                    violationText = actualViolation.description;
                } else {
                    violationText = 'Violation found';
                }
                
                const dateLabel = violation.date === 'Period' ? 'Period' : violation.date;
                
                return `
                    <div class="test-result ${violation.severity}">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span><strong>${dateLabel}:</strong> ${violationText}</span>
                    </div>
                `;
            }).join('');

            testResults.innerHTML = `
                <div class="test-result-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Found ${violations.length} violation${violations.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="test-result-list">
                    ${violationsHTML}
                    ${violations.length > 10 ? `<div class="test-result-more">... and ${violations.length - 10} more</div>` : ''}
                </div>
            `;
        }
    }

    /**
     * Handle rule form submission
     * @param {Event} event - Form submit event
     */
    async handleRuleSubmit(event) {
        event.preventDefault();

        try {
            const rule = this.buildRuleFromForm();
            if (!rule) return;

            if (this.isEditing && this.currentRule) {
                // Update existing rule
                await this.ruleEngine.updateRule(this.currentRule.id, rule);
                showAlert('Rule updated successfully', 'Rule Updated');
            } else {
                // Add new rule
                await this.ruleEngine.addRule(rule);
                showAlert('Rule created successfully', 'Rule Created');
            }

            // Close modal
            event.target.closest('.modal').remove();
            
            // Reset state
            this.currentRule = null;
            this.isEditing = false;
            
            // Refresh the rules management page
            if (window.workforceManager && window.workforceManager.renderRulesView) {
                window.workforceManager.renderRulesView();
            }

        } catch (error) {
            console.error('Error saving rule:', error);
            showAlert('Error saving rule: ' + error.message, 'Save Error');
        }
    }

    /**
     * Populate rule for editing
     */
    populateRuleForEditing() {
        if (!this.currentRule) return;

        console.log('🔧 Populating rule for editing:', this.currentRule);

        const ruleName = document.getElementById('ruleName');
        const ruleDescription = document.getElementById('ruleDescription');

        if (ruleName) ruleName.value = this.currentRule.name;
        if (ruleDescription) ruleDescription.value = this.currentRule.description || '';

        // Set the correct mode based on rule structure
        const isAdvancedMode = !!this.currentRule.json; // Advanced mode if rule has JSON
        const modeToggle = document.getElementById('ruleModeToggle');
        const currentModeLabel = document.getElementById('currentModeLabel');
        
        if (modeToggle && currentModeLabel) {
            modeToggle.checked = !isAdvancedMode; // Toggle is ON for simple mode, OFF for advanced mode
            // Force update the display immediately
            setTimeout(() => {
                currentModeLabel.textContent = isAdvancedMode ? 'Advanced Mode' : 'Simple Mode';
                currentModeLabel.style.color = isAdvancedMode ? '#007bff' : '#28a745';
                
                // Also trigger the toggle handler to update the UI properly
                this.handleModeToggle({ target: modeToggle });
            }, 0);
        }

        // Handle JSON rules - moved after toggle handler
        if (isAdvancedMode && this.currentRule.json) {
            // Wait for toggle handler to complete, then populate JSON
            setTimeout(() => {
                const ruleJson = document.getElementById('ruleJson');
                if (ruleJson) {
                    ruleJson.value = JSON.stringify(this.currentRule.json, null, 2);
                    console.log('✅ Populated JSON textarea with rule data');
                }
            }, 50);
        }

        // Populate conditions
        if (this.currentRule.conditions) {
            console.log('📋 Loading conditions:', this.currentRule.conditions);
            this.currentRule.conditions.forEach(condition => {
                // Determine which container to use based on condition type
                let containerId = 'conditionsList'; // default
                
                if (condition.type && condition.type.startsWith('employee_')) {
                    containerId = 'employeeConditionsList';
                } else if (condition.type && !condition.type.startsWith('employee_')) {
                    containerId = 'summaryConditionsList';
                }
                
                console.log('📦 Adding condition to container:', containerId, condition);
                this.addConditionToUI(condition, containerId);
            });
        }
    }

    /**
     * Show template selection modal
     */
    showTemplateSelectionModal() {
        const modal = this.createTemplateSelectionModal();
        document.body.appendChild(modal);
    }

    /**
     * Create template selection modal
     * @returns {HTMLElement} Modal element
     */
    createTemplateSelectionModal() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="fas fa-copy"></i> Add Rule from Template</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="template-list">
                        ${this.ruleEngine.getRuleTemplates().map(template => `
                            <div class="template-card" data-template-id="${template.id}">
                                <h4>${template.name}</h4>
                                <p>${template.description}</p>
                                <div class="template-category">${template.category}</div>
                                <button class="btn btn-primary" onclick="window.ruleManager.useTemplate('${template.id}')">
                                    Use Template
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `;

        return modal;
    }

    /**
     * Use a template to create a new rule
     * @param {string} templateId - ID of template to use
     */
    useTemplate(templateId) {
        try {
            const rule = this.ruleEngine.createRuleFromTemplate(templateId);
            this.ruleEngine.addRule(rule);
            showAlert('Rule created from template successfully', 'Rule Created');
            
            // Close template modal
            document.querySelector('.modal').remove();
            
            // Refresh the rules management page
            if (window.workforceManager && window.workforceManager.renderRulesView) {
                window.workforceManager.renderRulesView();
            }
            
            // Show rule management modal
            this.showRuleManagementModal();
            
        } catch (error) {
            console.error('Error using template:', error);
            showAlert('Error using template: ' + error.message, 'Template Error');
        }
    }

    /**
     * Handle template selection
     * @param {Event} event - Change event
     */
    handleTemplateSelection(event) {
        const templateId = event.target.value;
        if (templateId) {
            const template = this.ruleEngine.getRuleTemplate(templateId);
            if (template) {
                this.createRuleFromTemplate(template);
            }
        }
    }

    /**
     * Create a rule from a template object
     * @param {Object} template - Template object
     */
    createRuleFromTemplate(template) {
        try {
            const rule = {
                ...template.rule,
                id: this.ruleEngine.generateRuleId(),
                enabled: true
            };
            this.ruleEngine.addRule(rule);
            showAlert('Rule created from template successfully', 'Rule Created');
            
            // Refresh the rules management page
            if (window.workforceManager && window.workforceManager.renderRulesView) {
                window.workforceManager.renderRulesView();
            }
            
        } catch (error) {
            console.error('Error creating rule from template:', error);
            showAlert('Error creating rule from template: ' + error.message, 'Template Error');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RuleManager;
}
