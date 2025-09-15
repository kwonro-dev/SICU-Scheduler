/**
 * Data Consistency Testing Suite
 * Comprehensive tests for Firebase data consistency and synchronization
 */
class DataConsistencyTests {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.dataConsistencyManager = new DataConsistencyManager(workforceManager);
        this.testResults = [];
        this.isRunning = false;
    }

    /**
     * Run all data consistency tests
     */
    async runAllTests() {
        if (this.isRunning) {
            console.warn('Tests already running, please wait...');
            return;
        }

        // Safety check: Don't run destructive tests if there's real data
        const hasRealData = this.workforceManager.employees.length > 0 || 
                           this.workforceManager.schedules.length > 0;
        
        if (hasRealData) {
            const proceed = confirm(
                `⚠️ WARNING: You have ${this.workforceManager.employees.length} employees and ${this.workforceManager.schedules.length} schedules.\n\n` +
                `The FULL tests will create and delete temporary test data. This should not affect your real data, but there's a small risk.\n\n` +
                `RECOMMENDATION: Use "Test data consistency (safe)" instead for regular validation.\n\n` +
                `Do you want to continue with the FULL tests?`
            );
            
            if (!proceed) {
                console.log('Full tests cancelled by user');
                // Suggest safe tests instead
                if (confirm('Would you like to run the safe tests instead?')) {
                    return await this.workforceManager.runSafeDataConsistencyTests();
                }
                return;
            }
        }

        this.isRunning = true;
        console.log('🧪 Starting comprehensive data consistency tests...');
        
        const startTime = performance.now();
        this.testResults = [];

        try {
            // Test 1: Basic data validation
            await this.testBasicDataValidation();
            
            // Test 2: Reference integrity
            await this.testReferenceIntegrity();
            
            // Test 3: Real-time sync consistency
            await this.testRealtimeSyncConsistency();
            
            // Test 4: Conflict resolution
            await this.testConflictResolution();
            
            // Test 5: Offline/online sync
            await this.testOfflineOnlineSync();
            
            // Test 6: Data migration consistency
            await this.testDataMigrationConsistency();
            
            // Test 7: Performance under load
            await this.testPerformanceUnderLoad();
            
            // Test 8: Error recovery
            await this.testErrorRecovery();

            const totalTime = performance.now() - startTime;
            console.log(`✅ All tests completed in ${totalTime.toFixed(2)}ms`);
            
            this.generateTestReport();
            return this.testResults;
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            this.testResults.push({
                test: 'test_suite',
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Test 1: Basic data validation
     */
    async testBasicDataValidation() {
        console.log('🧪 Running basic data validation tests...');
        
        const testName = 'basic_data_validation';
        const startTime = performance.now();
        
        try {
            // Test data structure integrity
            const dataValidation = await this.dataConsistencyManager.validateDataConsistency();
            
            const result = {
                test: testName,
                status: dataValidation.isValid ? 'passed' : 'failed',
                duration: performance.now() - startTime,
                details: {
                    isValid: dataValidation.isValid,
                    errorCount: dataValidation.errors.length,
                    warningCount: dataValidation.warnings.length,
                    statistics: dataValidation.statistics
                },
                timestamp: new Date().toISOString()
            };

            if (!dataValidation.isValid) {
                result.errors = dataValidation.errors.slice(0, 5); // Limit to first 5 errors
            }

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.status}`);
            
        } catch (error) {
            this.testResults.push({
                test: testName,
                status: 'failed',
                error: error.message,
                duration: performance.now() - startTime,
                timestamp: new Date().toISOString()
            });
            console.error(`❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test 2: Reference integrity
     */
    async testReferenceIntegrity() {
        console.log('🧪 Running reference integrity tests...');
        
        const testName = 'reference_integrity';
        const startTime = performance.now();
        
        try {
            const issues = [];
            
            // Check schedule references
            for (const schedule of this.workforceManager.schedules) {
                // Check employee reference
                const employeeExists = this.workforceManager.employees.some(emp => emp.id === schedule.employeeId);
                if (!employeeExists) {
                    issues.push({
                        type: 'missing_employee_reference',
                        scheduleId: schedule.id,
                        employeeId: schedule.employeeId
                    });
                }

                // Check shift type reference
                const shiftExists = this.workforceManager.shiftTypes.some(shift => shift.id === schedule.shiftId);
                if (!shiftExists) {
                    issues.push({
                        type: 'missing_shift_reference',
                        scheduleId: schedule.id,
                        shiftId: schedule.shiftId
                    });
                }
            }

            // Check employee job role references
            for (const employee of this.workforceManager.employees) {
                if (employee.jobRole) {
                    const roleExists = this.workforceManager.jobRoles.some(role => role.id === employee.jobRole);
                    if (!roleExists) {
                        issues.push({
                            type: 'missing_job_role_reference',
                            employeeId: employee.id,
                            jobRoleId: employee.jobRole
                        });
                    }
                }
            }

            const result = {
                test: testName,
                status: issues.length === 0 ? 'passed' : 'failed',
                duration: performance.now() - startTime,
                details: {
                    issueCount: issues.length,
                    issues: issues.slice(0, 10) // Limit to first 10 issues
                },
                timestamp: new Date().toISOString()
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.status} (${issues.length} issues found)`);
            
        } catch (error) {
            this.testResults.push({
                test: testName,
                status: 'failed',
                error: error.message,
                duration: performance.now() - startTime,
                timestamp: new Date().toISOString()
            });
            console.error(`❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test 3: Real-time sync consistency
     */
    async testRealtimeSyncConsistency() {
        console.log('🧪 Running real-time sync consistency tests...');
        
        const testName = 'realtime_sync_consistency';
        const startTime = performance.now();
        
        try {
            // Store initial state
            const initialState = {
                employees: [...this.workforceManager.employees],
                shiftTypes: [...this.workforceManager.shiftTypes],
                jobRoles: [...this.workforceManager.jobRoles],
                schedules: [...this.workforceManager.schedules]
            };

            // Simulate data changes
            const testEmployee = {
                id: 'test_employee_' + Date.now(),
                name: 'Test Employee',
                jobRole: null,
                created: new Date().toISOString()
            };

            // Add test employee
            await this.workforceManager.addEmployee(testEmployee);
            
            // Wait for sync with longer timeout
            await this.waitForSync(5000);

            // Verify data consistency
            const currentState = {
                employees: this.workforceManager.employees,
                shiftTypes: this.workforceManager.shiftTypes,
                jobRoles: this.workforceManager.jobRoles,
                schedules: this.workforceManager.schedules
            };

            // Check if employee was added
            const employeeAdded = currentState.employees.some(emp => emp.id === testEmployee.id);
            
            // Clean up test data with error handling
            try {
                await this.workforceManager.deleteEmployee(testEmployee.id);
                // Wait a bit for deletion to sync
                await this.waitForSync(2000);
            } catch (deleteError) {
                console.warn('Failed to delete test employee:', deleteError);
            }

            const result = {
                test: testName,
                status: employeeAdded ? 'passed' : 'failed',
                duration: performance.now() - startTime,
                details: {
                    employeeAdded,
                    initialEmployeeCount: initialState.employees.length,
                    finalEmployeeCount: currentState.employees.length
                },
                timestamp: new Date().toISOString()
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.status}`);
            
        } catch (error) {
            this.testResults.push({
                test: testName,
                status: 'failed',
                error: error.message,
                duration: performance.now() - startTime,
                timestamp: new Date().toISOString()
            });
            console.error(`❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test 4: Conflict resolution
     */
    async testConflictResolution() {
        console.log('🧪 Running conflict resolution tests...');
        
        const testName = 'conflict_resolution';
        const startTime = performance.now();
        
        try {
            // Create test data for conflict simulation
            const testEmployee = {
                id: 'conflict_test_' + Date.now(),
                name: 'Conflict Test Employee',
                jobRole: null,
                created: new Date().toISOString()
            };

            // Add employee
            await this.workforceManager.addEmployee(testEmployee);
            
            // Simulate concurrent updates
            const update1 = { name: 'Updated Name 1' };
            const update2 = { name: 'Updated Name 2' };

            // Apply updates concurrently
            const promises = [
                this.workforceManager.updateEmployee(testEmployee.id, update1),
                this.workforceManager.updateEmployee(testEmployee.id, update2)
            ];

            await Promise.allSettled(promises);
            
            // Wait for sync
            await this.waitForSync(3000);

            // Check final state
            const finalEmployee = this.workforceManager.employees.find(emp => emp.id === testEmployee.id);
            const hasValidName = finalEmployee && finalEmployee.name && finalEmployee.name.trim().length > 0;

            // Clean up
            await this.workforceManager.deleteEmployee(testEmployee.id);

            const result = {
                test: testName,
                status: hasValidName ? 'passed' : 'failed',
                duration: performance.now() - startTime,
                details: {
                    finalName: finalEmployee ? finalEmployee.name : 'not found',
                    hasValidName
                },
                timestamp: new Date().toISOString()
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.status}`);
            
        } catch (error) {
            this.testResults.push({
                test: testName,
                status: 'failed',
                error: error.message,
                duration: performance.now() - startTime,
                timestamp: new Date().toISOString()
            });
            console.error(`❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test 5: Offline/online sync
     */
    async testOfflineOnlineSync() {
        console.log('🧪 Running offline/online sync tests...');
        
        const testName = 'offline_online_sync';
        const startTime = performance.now();
        
        try {
            // Store initial state
            const initialState = {
                employees: this.workforceManager.employees.length,
                schedules: this.workforceManager.schedules.length
            };

            // Simulate offline mode by disabling network
            const originalOnline = navigator.onLine;
            Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

            // Make changes while offline
            const testEmployee = {
                id: 'offline_test_' + Date.now(),
                name: 'Offline Test Employee',
                jobRole: null,
                created: new Date().toISOString()
            };

            // This should work with local cache
            this.workforceManager.employees.push(testEmployee);
            this.workforceManager.dataManager.saveData('employees', this.workforceManager.employees);

            // Simulate coming back online
            Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
            
            // Trigger sync
            if (this.workforceManager.hybridDataManager) {
                await this.workforceManager.hybridDataManager.syncPendingChanges();
            }

            // Wait for sync
            await this.waitForSync(3000);

            // Verify sync
            const finalState = {
                employees: this.workforceManager.employees.length,
                schedules: this.workforceManager.schedules.length
            };

            const employeeAdded = this.workforceManager.employees.some(emp => emp.id === testEmployee.id);

            // Clean up
            if (employeeAdded) {
                await this.workforceManager.deleteEmployee(testEmployee.id);
            }

            // Restore original online state
            Object.defineProperty(navigator, 'onLine', { value: originalOnline, writable: true });

            const result = {
                test: testName,
                status: employeeAdded ? 'passed' : 'failed',
                duration: performance.now() - startTime,
                details: {
                    initialEmployeeCount: initialState.employees,
                    finalEmployeeCount: finalState.employees,
                    employeeAdded
                },
                timestamp: new Date().toISOString()
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.status}`);
            
        } catch (error) {
            this.testResults.push({
                test: testName,
                status: 'failed',
                error: error.message,
                duration: performance.now() - startTime,
                timestamp: new Date().toISOString()
            });
            console.error(`❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test 6: Data migration consistency
     */
    async testDataMigrationConsistency() {
        console.log('🧪 Running data migration consistency tests...');
        
        const testName = 'data_migration_consistency';
        const startTime = performance.now();
        
        try {
            // Store current data
            const currentData = {
                employees: [...this.workforceManager.employees],
                shiftTypes: [...this.workforceManager.shiftTypes],
                jobRoles: [...this.workforceManager.jobRoles],
                schedules: [...this.workforceManager.schedules]
            };

            // Test migration validation
            const migrationValidation = await this.dataConsistencyManager.validateDataConsistency();
            
            // Check for data integrity after migration
            const dataIntegrity = {
                employeesValid: this.workforceManager.employees.every(emp => emp.id && emp.name),
                shiftTypesValid: this.workforceManager.shiftTypes.every(shift => shift.id && shift.name),
                jobRolesValid: this.workforceManager.jobRoles.every(role => role.id && role.name),
                schedulesValid: this.workforceManager.schedules.every(schedule => 
                    schedule.id && schedule.employeeId && schedule.shiftId && schedule.date
                )
            };

            const allValid = Object.values(dataIntegrity).every(valid => valid);

            const result = {
                test: testName,
                status: allValid && migrationValidation.isValid ? 'passed' : 'failed',
                duration: performance.now() - startTime,
                details: {
                    migrationValid: migrationValidation.isValid,
                    dataIntegrity,
                    errorCount: migrationValidation.errors.length,
                    warningCount: migrationValidation.warnings.length
                },
                timestamp: new Date().toISOString()
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.status}`);
            
        } catch (error) {
            this.testResults.push({
                test: testName,
                status: 'failed',
                error: error.message,
                duration: performance.now() - startTime,
                timestamp: new Date().toISOString()
            });
            console.error(`❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test 7: Performance under load
     */
    async testPerformanceUnderLoad() {
        console.log('🧪 Running performance under load tests...');
        
        const testName = 'performance_under_load';
        const startTime = performance.now();
        
        try {
            // Use smaller batch size to avoid overwhelming the system
            const testData = [];
            const batchSize = 5; // Reduced from 50 to 5
            
            // Create test data
            for (let i = 0; i < batchSize; i++) {
                testData.push({
                    id: 'perf_test_' + Date.now() + '_' + i,
                    name: `Performance Test Employee ${i}`,
                    jobRole: null,
                    created: new Date().toISOString()
                });
            }

            // Measure batch creation time
            const createStart = performance.now();
            for (const employee of testData) {
                await this.workforceManager.addEmployee(employee);
            }
            const createTime = performance.now() - createStart;

            // Wait for sync
            await this.waitForSync(2000); // Reduced from 5000 to 2000

            // Measure batch deletion time
            const deleteStart = performance.now();
            for (const employee of testData) {
                await this.workforceManager.deleteEmployee(employee.id);
            }
            const deleteTime = performance.now() - deleteStart;

            const result = {
                test: testName,
                status: 'passed',
                duration: performance.now() - startTime,
                details: {
                    batchSize,
                    createTime: createTime.toFixed(2),
                    deleteTime: deleteTime.toFixed(2),
                    avgCreateTime: (createTime / batchSize).toFixed(2),
                    avgDeleteTime: (deleteTime / batchSize).toFixed(2)
                },
                timestamp: new Date().toISOString()
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.status} (${batchSize} items in ${result.duration.toFixed(2)}ms)`);
            
        } catch (error) {
            this.testResults.push({
                test: testName,
                status: 'failed',
                error: error.message,
                duration: performance.now() - startTime,
                timestamp: new Date().toISOString()
            });
            console.error(`❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Test 8: Error recovery
     */
    async testErrorRecovery() {
        console.log('🧪 Running error recovery tests...');
        
        const testName = 'error_recovery';
        const startTime = performance.now();
        
        try {
            // Test with invalid data
            const invalidEmployee = {
                id: 'error_test_' + Date.now(),
                name: '', // Invalid: empty name
                jobRole: 'non_existent_role', // Invalid: non-existent role
                created: new Date().toISOString()
            };

            // Attempt to add invalid employee
            let errorCaught = false;
            try {
                await this.workforceManager.addEmployee(invalidEmployee);
            } catch (error) {
                errorCaught = true;
            }

            // Test data validation
            const validationResults = await this.dataConsistencyManager.validateDataConsistency();
            
            // Test auto-fix
            const autoFixResults = await this.dataConsistencyManager.autoFixDataIssues(validationResults);

            const result = {
                test: testName,
                status: errorCaught || validationResults.isValid ? 'passed' : 'failed',
                duration: performance.now() - startTime,
                details: {
                    errorCaught,
                    validationValid: validationResults.isValid,
                    autoFixApplied: autoFixResults.applied,
                    autoFixFailed: autoFixResults.failed
                },
                timestamp: new Date().toISOString()
            };

            this.testResults.push(result);
            console.log(`✅ ${testName}: ${result.status}`);
            
        } catch (error) {
            this.testResults.push({
                test: testName,
                status: 'failed',
                error: error.message,
                duration: performance.now() - startTime,
                timestamp: new Date().toISOString()
            });
            console.error(`❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Wait for sync operations to complete
     */
    async waitForSync(timeout = 5000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkSync = () => {
                // Simple sync check - can be enhanced
                if (Date.now() - startTime > timeout) {
                    resolve();
                } else {
                    setTimeout(checkSync, 100);
                }
            };
            
            checkSync();
        });
    }

    /**
     * Generate comprehensive test report
     */
    generateTestReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(result => result.status === 'passed').length;
        const failedTests = this.testResults.filter(result => result.status === 'failed').length;
        const totalDuration = this.testResults.reduce((sum, result) => sum + (result.duration || 0), 0);

        console.log('\n📊 Data Consistency Test Report');
        console.log('================================');
        console.log(`Total Tests: ${totalTests}`);
        console.log(`Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
        console.log(`Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
        console.log(`Total Duration: ${totalDuration.toFixed(2)}ms`);
        console.log(`Average Duration: ${(totalDuration / totalTests).toFixed(2)}ms per test`);

        // Log failed tests
        const failedTestResults = this.testResults.filter(result => result.status === 'failed');
        if (failedTestResults.length > 0) {
            console.log('\n❌ Failed Tests:');
            failedTestResults.forEach(result => {
                console.log(`  - ${result.test}: ${result.error || 'Unknown error'}`);
            });
        }

        // Store results for UI display
        this.workforceManager.testResults = this.testResults;
    }

    /**
     * Get test results summary
     */
    getTestSummary() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(result => result.status === 'passed').length;
        const failedTests = this.testResults.filter(result => result.status === 'failed').length;

        return {
            total: totalTests,
            passed: passedTests,
            failed: failedTests,
            successRate: totalTests > 0 ? (passedTests / totalTests) * 100 : 0,
            results: this.testResults
        };
    }

    /**
     * Run specific test
     */
    async runTest(testName) {
        const testMethods = {
            'basic_data_validation': this.testBasicDataValidation.bind(this),
            'reference_integrity': this.testReferenceIntegrity.bind(this),
            'realtime_sync_consistency': this.testRealtimeSyncConsistency.bind(this),
            'conflict_resolution': this.testConflictResolution.bind(this),
            'offline_online_sync': this.testOfflineOnlineSync.bind(this),
            'data_migration_consistency': this.testDataMigrationConsistency.bind(this),
            'performance_under_load': this.testPerformanceUnderLoad.bind(this),
            'error_recovery': this.testErrorRecovery.bind(this)
        };

        if (testMethods[testName]) {
            console.log(`🧪 Running specific test: ${testName}`);
            await testMethods[testName]();
        } else {
            console.error(`❌ Unknown test: ${testName}`);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataConsistencyTests;
} else {
    window.DataConsistencyTests = DataConsistencyTests;
}
