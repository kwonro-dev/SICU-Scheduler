/**
 * Safe Data Consistency Tests
 * Non-destructive tests that only validate existing data without creating/deleting anything
 */
class SafeDataConsistencyTests {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.dataConsistencyManager = new DataConsistencyManager(workforceManager);
        this.testResults = [];
        this.isRunning = false;
    }

    /**
     * Run safe data consistency tests (non-destructive)
     */
    async runSafeTests() {
        if (this.isRunning) {
            console.warn('Tests already running, please wait...');
            return;
        }

        this.isRunning = true;
        console.log('🧪 Starting safe data consistency tests (non-destructive)...');
        
        const startTime = performance.now();
        this.testResults = [];

        try {
            // Test 1: Basic data validation
            await this.testBasicDataValidation();
            
            // Test 2: Reference integrity
            await this.testReferenceIntegrity();
            
            // Test 3: Data structure validation
            await this.testDataStructureValidation();
            
            // Test 4: Cross-collection references
            await this.testCrossCollectionReferences();
            
            // Test 5: Data completeness
            await this.testDataCompleteness();

            const totalTime = performance.now() - startTime;
            console.log(`✅ Safe tests completed in ${totalTime.toFixed(2)}ms`);
            
            this.generateTestReport();
            return this.testResults;
        } catch (error) {
            console.error('❌ Safe test suite failed:', error);
            this.testResults.push({
                test: 'safe_test_suite',
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
     * Test 3: Data structure validation
     */
    async testDataStructureValidation() {
        console.log('🧪 Running data structure validation tests...');
        
        const testName = 'data_structure_validation';
        const startTime = performance.now();
        
        try {
            const issues = [];
            
            // Validate employees structure
            for (const employee of this.workforceManager.employees) {
                if (!employee.id || !employee.name) {
                    issues.push({
                        type: 'missing_required_field',
                        collection: 'employees',
                        itemId: employee.id,
                        field: !employee.id ? 'id' : 'name'
                    });
                }
            }

            // Validate shift types structure
            for (const shiftType of this.workforceManager.shiftTypes) {
                if (!shiftType.id || !shiftType.name) {
                    issues.push({
                        type: 'missing_required_field',
                        collection: 'shiftTypes',
                        itemId: shiftType.id,
                        field: !shiftType.id ? 'id' : 'name'
                    });
                }
            }

            // Validate job roles structure
            for (const jobRole of this.workforceManager.jobRoles) {
                if (!jobRole.id || !jobRole.name) {
                    issues.push({
                        type: 'missing_required_field',
                        collection: 'jobRoles',
                        itemId: jobRole.id,
                        field: !jobRole.id ? 'id' : 'name'
                    });
                }
            }

            // Validate schedules structure
            for (const schedule of this.workforceManager.schedules) {
                if (!schedule.id || !schedule.employeeId || !schedule.shiftId || !schedule.date) {
                    issues.push({
                        type: 'missing_required_field',
                        collection: 'schedules',
                        itemId: schedule.id,
                        field: !schedule.id ? 'id' : !schedule.employeeId ? 'employeeId' : !schedule.shiftId ? 'shiftId' : 'date'
                    });
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
     * Test 4: Cross-collection references
     */
    async testCrossCollectionReferences() {
        console.log('🧪 Running cross-collection reference tests...');
        
        const testName = 'cross_collection_references';
        const startTime = performance.now();
        
        try {
            const issues = [];
            
            // Check for orphaned schedules
            const orphanedSchedules = this.workforceManager.schedules.filter(schedule => 
                !this.workforceManager.employees.some(emp => emp.id === schedule.employeeId) ||
                !this.workforceManager.shiftTypes.some(shift => shift.id === schedule.shiftId)
            );

            if (orphanedSchedules.length > 0) {
                issues.push({
                    type: 'orphaned_schedules',
                    count: orphanedSchedules.length,
                    message: `Found ${orphanedSchedules.length} schedules with missing references`
                });
            }

            // Check for employees with invalid job roles
            const invalidJobRoles = this.workforceManager.employees.filter(employee => 
                employee.jobRole && !this.workforceManager.jobRoles.some(role => role.id === employee.jobRole)
            );

            if (invalidJobRoles.length > 0) {
                issues.push({
                    type: 'invalid_job_roles',
                    count: invalidJobRoles.length,
                    message: `Found ${invalidJobRoles.length} employees with invalid job role references`
                });
            }

            const result = {
                test: testName,
                status: issues.length === 0 ? 'passed' : 'failed',
                duration: performance.now() - startTime,
                details: {
                    issueCount: issues.length,
                    issues: issues
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
     * Test 5: Data completeness
     */
    async testDataCompleteness() {
        console.log('🧪 Running data completeness tests...');
        
        const testName = 'data_completeness';
        const startTime = performance.now();
        
        try {
            const issues = [];
            
            // Check for empty required fields
            const employeesWithEmptyNames = this.workforceManager.employees.filter(emp => !emp.name || emp.name.trim() === '');
            if (employeesWithEmptyNames.length > 0) {
                issues.push({
                    type: 'empty_names',
                    count: employeesWithEmptyNames.length,
                    message: `Found ${employeesWithEmptyNames.length} employees with empty names`
                });
            }

            const shiftTypesWithEmptyNames = this.workforceManager.shiftTypes.filter(st => !st.name || st.name.trim() === '');
            if (shiftTypesWithEmptyNames.length > 0) {
                issues.push({
                    type: 'empty_shift_names',
                    count: shiftTypesWithEmptyNames.length,
                    message: `Found ${shiftTypesWithEmptyNames.length} shift types with empty names`
                });
            }

            const jobRolesWithEmptyNames = this.workforceManager.jobRoles.filter(jr => !jr.name || jr.name.trim() === '');
            if (jobRolesWithEmptyNames.length > 0) {
                issues.push({
                    type: 'empty_role_names',
                    count: jobRolesWithEmptyNames.length,
                    message: `Found ${jobRolesWithEmptyNames.length} job roles with empty names`
                });
            }

            // Check for invalid dates
            const schedulesWithInvalidDates = this.workforceManager.schedules.filter(schedule => 
                !schedule.date || isNaN(Date.parse(schedule.date))
            );
            if (schedulesWithInvalidDates.length > 0) {
                issues.push({
                    type: 'invalid_dates',
                    count: schedulesWithInvalidDates.length,
                    message: `Found ${schedulesWithInvalidDates.length} schedules with invalid dates`
                });
            }

            const result = {
                test: testName,
                status: issues.length === 0 ? 'passed' : 'failed',
                duration: performance.now() - startTime,
                details: {
                    issueCount: issues.length,
                    issues: issues
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
     * Generate test report
     */
    generateTestReport() {
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(result => result.status === 'passed').length;
        const failedTests = this.testResults.filter(result => result.status === 'failed').length;
        const totalDuration = this.testResults.reduce((sum, result) => sum + (result.duration || 0), 0);

        console.log('\n📊 Safe Data Consistency Test Report');
        console.log('=====================================');
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
        this.workforceManager.safeTestResults = this.testResults;
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SafeDataConsistencyTests;
} else {
    window.SafeDataConsistencyTests = SafeDataConsistencyTests;
}
