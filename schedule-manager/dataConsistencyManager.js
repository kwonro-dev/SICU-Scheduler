/**
 * Data Consistency Manager
 * Handles data validation, conflict resolution, and consistency checks
 * for the Firebase integration
 */
class DataConsistencyManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.firebaseManager = workforceManager.firebaseManager;
        this.validationRules = this.initializeValidationRules();
        this.conflictResolution = new ConflictResolutionManager();
        this.syncMonitor = new SyncMonitor();
        this.isValidating = false; // Prevent validation loops
        this.lastValidationTime = 0;
        this.validationCooldown = 5000; // 5 seconds between validations
    }

    /**
     * Initialize validation rules for data consistency
     */
    initializeValidationRules() {
        return {
            employees: {
                required: ['id', 'name'],
                unique: ['id'],
                references: {
                    jobRole: 'jobRoles.id'
                },
                validation: {
                    name: (value) => value && value.trim().length > 0,
                    jobRole: (value, allData) => !value || allData.jobRoles.some(role => role.id === value)
                }
            },
            shiftTypes: {
                required: ['id', 'name'],
                unique: ['id', 'name'],
                validation: {
                    name: (value) => value && value.trim().length > 0,
                    color: (value) => !value || /^#[0-9A-F]{6}$/i.test(value)
                }
            },
            jobRoles: {
                required: ['id', 'name'],
                unique: ['id', 'name'],
                validation: {
                    name: (value) => value && value.trim().length > 0,
                    color: (value) => !value || /^#[0-9A-F]{6}$/i.test(value)
                }
            },
            schedules: {
                required: ['id', 'employeeId', 'date', 'shiftId'],
                unique: ['id'],
                references: {
                    employeeId: 'employees.id',
                    shiftId: 'shiftTypes.id'
                },
                validation: {
                    date: (value) => !isNaN(Date.parse(value)),
                    employeeId: (value, allData) => allData.employees.some(emp => emp.id === value),
                    shiftId: (value, allData) => allData.shiftTypes.some(shift => shift.id === value)
                }
            }
        };
    }

    /**
     * Validate data consistency across all collections
     */
    async validateDataConsistency() {
        // Prevent validation loops
        if (this.isValidating) {
            console.log('🔄 Validation already in progress, skipping...');
            return { isValid: true, errors: [], warnings: [], statistics: {}, timestamp: new Date().toISOString() };
        }

        // Check cooldown period
        const now = Date.now();
        if (now - this.lastValidationTime < this.validationCooldown) {
            console.log('🔄 Validation cooldown active, skipping...');
            return { isValid: true, errors: [], warnings: [], statistics: {}, timestamp: new Date().toISOString() };
        }

        this.isValidating = true;
        this.lastValidationTime = now;
        
        console.log('🔍 Starting comprehensive data consistency validation...');
        const startTime = performance.now();
        
        const results = {
            isValid: true,
            errors: [],
            warnings: [],
            statistics: {},
            timestamp: new Date().toISOString()
        };

        try {
            // Get current data state
            const data = {
                employees: this.workforceManager.employees,
                shiftTypes: this.workforceManager.shiftTypes,
                jobRoles: this.workforceManager.jobRoles,
                schedules: this.workforceManager.schedules
            };

            // Validate each collection
            for (const [collection, rules] of Object.entries(this.validationRules)) {
                const collectionResults = await this.validateCollection(collection, data[collection], data, rules);
                results.statistics[collection] = collectionResults;
                
                if (collectionResults.errors.length > 0) {
                    results.isValid = false;
                    results.errors.push(...collectionResults.errors);
                }
                results.warnings.push(...collectionResults.warnings);
            }

            // Cross-collection validation
            const crossValidationResults = this.validateCrossCollectionReferences(data);
            results.errors.push(...crossValidationResults.errors);
            results.warnings.push(...crossValidationResults.warnings);
            if (crossValidationResults.errors.length > 0) {
                results.isValid = false;
            }

            // Check for orphaned data
            const orphanResults = this.checkForOrphanedData(data);
            results.warnings.push(...orphanResults);

            const validationTime = performance.now() - startTime;
            console.log(`✅ Data consistency validation completed in ${validationTime.toFixed(2)}ms`);
            console.log(`📊 Results: ${results.errors.length} errors, ${results.warnings.length} warnings`);

            return results;
        } catch (error) {
            console.error('❌ Data consistency validation failed:', error);
            results.isValid = false;
            results.errors.push({
                type: 'validation_error',
                message: `Validation process failed: ${error.message}`,
                collection: 'all',
                timestamp: new Date().toISOString()
            });
            return results;
        } finally {
            this.isValidating = false;
        }
    }

    /**
     * Validate a specific collection
     */
    async validateCollection(collectionName, data, allData, rules) {
        const results = {
            collection: collectionName,
            totalItems: data.length,
            errors: [],
            warnings: [],
            validItems: 0
        };

        console.log(`🔍 Validating ${collectionName} (${data.length} items)...`);

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const itemErrors = [];
            const itemWarnings = [];

            // Check required fields
            for (const field of rules.required) {
                if (!item[field] || (typeof item[field] === 'string' && !item[field].trim())) {
                    itemErrors.push({
                        field,
                        message: `Required field '${field}' is missing or empty`,
                        value: item[field]
                    });
                }
            }

            // Check unique constraints
            for (const field of rules.unique) {
                const duplicates = data.filter((otherItem, otherIndex) => 
                    otherIndex !== i && otherItem[field] === item[field]
                );
                if (duplicates.length > 0) {
                    itemErrors.push({
                        field,
                        message: `Duplicate value for unique field '${field}': ${item[field]}`,
                        value: item[field]
                    });
                }
            }

            // Run field validations
            for (const [field, validator] of Object.entries(rules.validation)) {
                if (item[field] !== undefined && !validator(item[field], allData)) {
                    itemErrors.push({
                        field,
                        message: `Invalid value for field '${field}': ${item[field]}`,
                        value: item[field]
                    });
                }
            }

            if (itemErrors.length === 0) {
                results.validItems++;
            } else {
                results.errors.push({
                    itemIndex: i,
                    itemId: item.id,
                    errors: itemErrors
                });
            }
        }

        // Check for missing references
        if (rules.references) {
            for (const [field, targetCollection] of Object.entries(rules.references)) {
                const targetField = targetCollection.split('.')[1];
                const validReferences = allData[targetCollection.split('.')[0]].map(item => item[targetField]);
                
                const invalidReferences = data.filter(item => 
                    item[field] && !validReferences.includes(item[field])
                );

                for (const invalidItem of invalidReferences) {
                    results.warnings.push({
                        itemId: invalidItem.id,
                        field,
                        message: `Reference to non-existent ${targetCollection}: ${invalidItem[field]}`,
                        value: invalidItem[field]
                    });
                }
            }
        }

        console.log(`✅ ${collectionName} validation: ${results.validItems}/${results.totalItems} valid items`);
        return results;
    }

    /**
     * Validate cross-collection references
     */
    validateCrossCollectionReferences(data) {
        const results = { errors: [], warnings: [] };

        // Check schedule references
        for (const schedule of data.schedules) {
            // Check employee reference
            if (schedule.employeeId && !data.employees.some(emp => emp.id === schedule.employeeId)) {
                results.errors.push({
                    type: 'missing_reference',
                    collection: 'schedules',
                    itemId: schedule.id,
                    field: 'employeeId',
                    message: `Schedule references non-existent employee: ${schedule.employeeId}`,
                    value: schedule.employeeId
                });
            }

            // Check shift type reference
            if (schedule.shiftId && !data.shiftTypes.some(shift => shift.id === schedule.shiftId)) {
                results.errors.push({
                    type: 'missing_reference',
                    collection: 'schedules',
                    itemId: schedule.id,
                    field: 'shiftId',
                    message: `Schedule references non-existent shift type: ${schedule.shiftId}`,
                    value: schedule.shiftId
                });
            }
        }

        // Check employee job role references
        for (const employee of data.employees) {
            if (employee.jobRole && !data.jobRoles.some(role => role.id === employee.jobRole)) {
                results.warnings.push({
                    type: 'missing_reference',
                    collection: 'employees',
                    itemId: employee.id,
                    field: 'jobRole',
                    message: `Employee references non-existent job role: ${employee.jobRole}`,
                    value: employee.jobRole
                });
            }
        }

        return results;
    }

    /**
     * Check for orphaned data
     */
    checkForOrphanedData(data) {
        const warnings = [];

        // Check for schedules with no employee
        const orphanedSchedules = data.schedules.filter(schedule => 
            !data.employees.some(emp => emp.id === schedule.employeeId)
        );

        if (orphanedSchedules.length > 0) {
            warnings.push({
                type: 'orphaned_data',
                collection: 'schedules',
                count: orphanedSchedules.length,
                message: `Found ${orphanedSchedules.length} schedules with no corresponding employee`
            });
        }

        // Check for schedules with no shift type
        const invalidShiftSchedules = data.schedules.filter(schedule => 
            !data.shiftTypes.some(shift => shift.id === schedule.shiftId)
        );

        if (invalidShiftSchedules.length > 0) {
            warnings.push({
                type: 'orphaned_data',
                collection: 'schedules',
                count: invalidShiftSchedules.length,
                message: `Found ${invalidShiftSchedules.length} schedules with no corresponding shift type`
            });
        }

        return warnings;
    }

    /**
     * Auto-fix common data consistency issues
     */
    async autoFixDataIssues(validationResults) {
        // Prevent auto-fix loops
        if (this.isValidating) {
            console.log('🔄 Auto-fix skipped - validation in progress');
            return { applied: 0, failed: 0, details: [] };
        }

        console.log('🔧 Starting auto-fix for data consistency issues...');
        
        const fixes = {
            applied: 0,
            failed: 0,
            details: []
        };

        try {
            // Fix missing job role references
            for (const employee of this.workforceManager.employees) {
                if (employee.jobRole && !this.workforceManager.jobRoles.some(role => role.id === employee.jobRole)) {
                    console.log(`🔧 Fixing invalid job role reference for employee ${employee.name}`);
                    employee.jobRole = null;
                    fixes.applied++;
                    fixes.details.push({
                        type: 'clear_invalid_reference',
                        collection: 'employees',
                        itemId: employee.id,
                        field: 'jobRole'
                    });
                }
            }

            // Remove orphaned schedules
            const validSchedules = this.workforceManager.schedules.filter(schedule => {
                const hasEmployee = this.workforceManager.employees.some(emp => emp.id === schedule.employeeId);
                const hasShiftType = this.workforceManager.shiftTypes.some(shift => shift.id === schedule.shiftId);
                
                if (!hasEmployee || !hasShiftType) {
                    console.log(`🔧 Removing orphaned schedule: ${schedule.id}`);
                    fixes.applied++;
                    fixes.details.push({
                        type: 'remove_orphaned_schedule',
                        collection: 'schedules',
                        itemId: schedule.id
                    });
                    return false;
                }
                return true;
            });

            this.workforceManager.schedules = validSchedules;

            // Save fixes to Firebase
            if (fixes.applied > 0) {
                await this.workforceManager.dataManager.saveData('employees', this.workforceManager.employees);
                await this.workforceManager.dataManager.saveData('schedules', this.workforceManager.schedules);
                console.log(`✅ Applied ${fixes.applied} auto-fixes`);
            }

            return fixes;
        } catch (error) {
            console.error('❌ Auto-fix failed:', error);
            fixes.failed++;
            return fixes;
        }
    }

    /**
     * Monitor real-time sync for consistency issues
     */
    startSyncMonitoring() {
        console.log('🔄 Starting real-time sync monitoring...');
        
        // Monitor for sync conflicts
        this.syncMonitor.onConflict((conflict) => {
            console.warn('⚠️ Sync conflict detected:', conflict);
            this.handleSyncConflict(conflict);
        });

        // Monitor for sync errors
        this.syncMonitor.onError((error) => {
            console.error('❌ Sync error detected:', error);
            this.handleSyncError(error);
        });

        // Monitor data consistency after each sync
        this.syncMonitor.onSyncComplete(async () => {
            console.log('🔄 Sync completed, validating consistency...');
            const validationResults = await this.validateDataConsistency();
            if (!validationResults.isValid) {
                console.warn('⚠️ Data consistency issues detected after sync');
                this.notifyDataInconsistency(validationResults);
            }
        });
    }

    /**
     * Handle sync conflicts
     */
    handleSyncConflict(conflict) {
        // Implement conflict resolution strategy
        const resolution = this.conflictResolution.resolveConflict(conflict);
        
        if (resolution.action === 'merge') {
            console.log('🔧 Merging conflicting changes...');
            this.applyConflictResolution(resolution);
        } else if (resolution.action === 'reject') {
            console.log('❌ Rejecting conflicting changes...');
            this.rejectConflictResolution(resolution);
        }
    }

    /**
     * Handle sync errors
     */
    handleSyncError(error) {
        // Log error and attempt recovery
        console.error('Sync error details:', error);
        
        // Implement retry logic
        if (error.retryable) {
            setTimeout(() => {
                console.log('🔄 Retrying failed sync operation...');
                this.retrySyncOperation(error.operation);
            }, error.retryDelay || 5000);
        }
    }

    /**
     * Notify about data inconsistency
     */
    notifyDataInconsistency(validationResults) {
        // Show user notification
        const notification = document.createElement('div');
        notification.className = 'data-consistency-warning';
        notification.innerHTML = `
            <div class="warning-content">
                <h4>⚠️ Data Consistency Issues Detected</h4>
                <p>Found ${validationResults.errors.length} errors and ${validationResults.warnings.length} warnings.</p>
                <button onclick="this.parentElement.parentElement.remove()">Dismiss</button>
                <button onclick="workforceManager.dataConsistencyManager.showDetailedReport()">View Details</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }

    /**
     * Show detailed consistency report
     */
    showDetailedReport() {
        // Create modal with detailed report
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Data Consistency Report</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="consistencyReportContent">
                        <p>Loading detailed report...</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Load detailed report asynchronously
        this.generateDetailedReport().then(html => {
            document.getElementById('consistencyReportContent').innerHTML = html;
        });
    }

    /**
     * Generate detailed consistency report HTML
     */
    async generateDetailedReport() {
        const validationResults = await this.validateDataConsistency();
        
        let html = `
            <div class="consistency-summary">
                <h4>Summary</h4>
                <p><strong>Status:</strong> ${validationResults.isValid ? '✅ Valid' : '❌ Invalid'}</p>
                <p><strong>Errors:</strong> ${validationResults.errors.length}</p>
                <p><strong>Warnings:</strong> ${validationResults.warnings.length}</p>
                <p><strong>Timestamp:</strong> ${new Date(validationResults.timestamp).toLocaleString()}</p>
            </div>
        `;

        if (validationResults.errors.length > 0) {
            html += '<div class="errors-section"><h4>Errors</h4><ul>';
            validationResults.errors.forEach(error => {
                html += `<li><strong>${error.collection || 'General'}:</strong> ${error.message}</li>`;
            });
            html += '</ul></div>';
        }

        if (validationResults.warnings.length > 0) {
            html += '<div class="warnings-section"><h4>Warnings</h4><ul>';
            validationResults.warnings.forEach(warning => {
                html += `<li><strong>${warning.collection || 'General'}:</strong> ${warning.message}</li>`;
            });
            html += '</ul></div>';
        }

        return html;
    }
}

/**
 * Conflict Resolution Manager
 */
class ConflictResolutionManager {
    constructor() {
        this.strategies = {
            'last_write_wins': this.lastWriteWins.bind(this),
            'merge': this.mergeChanges.bind(this),
            'user_choice': this.userChoice.bind(this)
        };
    }

    resolveConflict(conflict) {
        // Determine resolution strategy based on conflict type
        const strategy = this.determineStrategy(conflict);
        return this.strategies[strategy](conflict);
    }

    determineStrategy(conflict) {
        // Simple strategy selection - can be enhanced
        if (conflict.type === 'concurrent_edit') {
            return 'last_write_wins';
        } else if (conflict.type === 'reference_conflict') {
            return 'merge';
        } else {
            return 'user_choice';
        }
    }

    lastWriteWins(conflict) {
        return {
            action: 'accept',
            data: conflict.localChange.timestamp > conflict.remoteChange.timestamp 
                ? conflict.localChange : conflict.remoteChange
        };
    }

    mergeChanges(conflict) {
        // Implement merge logic
        return {
            action: 'merge',
            data: { ...conflict.remoteChange, ...conflict.localChange }
        };
    }

    userChoice(conflict) {
        return {
            action: 'user_choice',
            conflict: conflict
        };
    }
}

/**
 * Sync Monitor
 */
class SyncMonitor {
    constructor() {
        this.conflictHandlers = [];
        this.errorHandlers = [];
        this.syncCompleteHandlers = [];
    }

    onConflict(handler) {
        this.conflictHandlers.push(handler);
    }

    onError(handler) {
        this.errorHandlers.push(handler);
    }

    onSyncComplete(handler) {
        this.syncCompleteHandlers.push(handler);
    }

    notifyConflict(conflict) {
        this.conflictHandlers.forEach(handler => handler(conflict));
    }

    notifyError(error) {
        this.errorHandlers.forEach(handler => handler(error));
    }

    notifySyncComplete() {
        this.syncCompleteHandlers.forEach(handler => handler());
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DataConsistencyManager, ConflictResolutionManager, SyncMonitor };
} else {
    window.DataConsistencyManager = DataConsistencyManager;
    window.ConflictResolutionManager = ConflictResolutionManager;
    window.SyncMonitor = SyncMonitor;
}
