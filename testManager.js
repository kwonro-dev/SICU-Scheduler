// Test Manager Module
// Handles all data consistency testing and test result display

class TestManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
    }

    /**
     * Run data consistency tests
     */
    async runDataConsistencyTests() {
        if (!this.workforceManager.dataConsistencyTests) {
            console.error('Data consistency tests not available');
            return;
        }

        console.log('🧪 Starting data consistency tests...');
        const results = await this.workforceManager.dataConsistencyTests.runAllTests();
        
        // Show results in UI
        this.showTestResults(results);
        
        return results;
    }

    /**
     * Run safe data consistency tests (non-destructive)
     */
    async runSafeDataConsistencyTests() {
        if (!this.workforceManager.safeDataConsistencyTests) {
            console.error('Safe data consistency tests not available');
            return;
        }

        console.log('🧪 Starting safe data consistency tests...');
        const results = await this.workforceManager.safeDataConsistencyTests.runSafeTests();
        
        // Show results in UI
        this.showSafeTestResults(results);
        
        return results;
    }

    /**
     * Show test results in UI
     */
    showTestResults(results) {
        const summary = this.workforceManager.dataConsistencyTests.getTestSummary();
        
        // Create results modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Data Consistency Test Results</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="test-summary">
                        <h4>Summary</h4>
                        <div class="summary-stats">
                            <div class="stat">
                                <span class="label">Total Tests:</span>
                                <span class="value">${summary.total}</span>
                            </div>
                            <div class="stat">
                                <span class="label">Passed:</span>
                                <span class="value success">${summary.passed}</span>
                            </div>
                            <div class="stat">
                                <span class="label">Failed:</span>
                                <span class="value error">${summary.failed}</span>
                            </div>
                            <div class="stat">
                                <span class="label">Success Rate:</span>
                                <span class="value">${summary.successRate.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="test-details">
                        <h4>Test Details</h4>
                        <div class="test-list">
                            ${summary.results.map(result => `
                                <div class="test-item ${result.status}">
                                    <div class="test-name">${result.test.replace(/_/g, ' ').toUpperCase()}</div>
                                    <div class="test-status">${result.status.toUpperCase()}</div>
                                    <div class="test-duration">${(result.duration || 0).toFixed(2)}ms</div>
                                    ${result.error ? `<div class="test-error">${result.error}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Close</button>
                    <button onclick="workforceManager.testManager.runDataConsistencyTests()" class="btn btn-primary">Run Again</button>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .test-summary {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            .summary-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin-top: 10px;
            }
            .stat {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: white;
                border-radius: 4px;
                border-left: 4px solid #007bff;
            }
            .stat .value.success {
                color: #28a745;
                font-weight: bold;
            }
            .stat .value.error {
                color: #dc3545;
                font-weight: bold;
            }
            .test-list {
                max-height: 400px;
                overflow-y: auto;
            }
            .test-item {
                display: grid;
                grid-template-columns: 1fr auto auto;
                gap: 15px;
                align-items: center;
                padding: 12px;
                margin-bottom: 8px;
                border-radius: 4px;
                border-left: 4px solid #ddd;
            }
            .test-item.passed {
                background: #d4edda;
                border-left-color: #28a745;
            }
            .test-item.failed {
                background: #f8d7da;
                border-left-color: #dc3545;
            }
            .test-name {
                font-weight: 500;
            }
            .test-status {
                font-weight: bold;
                text-transform: uppercase;
                font-size: 12px;
            }
            .test-duration {
                font-size: 12px;
                color: #666;
            }
            .test-error {
                grid-column: 1 / -1;
                margin-top: 8px;
                padding: 8px;
                background: rgba(220, 53, 69, 0.1);
                border-radius: 4px;
                font-size: 12px;
                color: #721c24;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(modal);
    }

    /**
     * Show safe test results in UI
     */
    showSafeTestResults(results) {
        const summary = this.workforceManager.safeDataConsistencyTests.getTestSummary();
        
        // Create results modal
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>Safe Data Consistency Test Results</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="test-summary">
                        <h4>Summary</h4>
                        <div class="summary-stats">
                            <div class="stat">
                                <span class="label">Total Tests:</span>
                                <span class="value">${summary.total}</span>
                            </div>
                            <div class="stat">
                                <span class="label">Passed:</span>
                                <span class="value success">${summary.passed}</span>
                            </div>
                            <div class="stat">
                                <span class="label">Failed:</span>
                                <span class="value error">${summary.failed}</span>
                            </div>
                            <div class="stat">
                                <span class="label">Success Rate:</span>
                                <span class="value">${summary.successRate.toFixed(1)}%</span>
                            </div>
                        </div>
                        <div style="margin-top: 15px; padding: 10px; background: #e8f5e8; border-radius: 4px; border-left: 4px solid #28a745;">
                            <strong>✅ Safe Tests:</strong> These tests only validate existing data without creating or deleting anything.
                        </div>
                    </div>
                    <div class="test-details">
                        <h4>Test Details</h4>
                        <div class="test-list">
                            ${summary.results.map(result => `
                                <div class="test-item ${result.status}">
                                    <div class="test-name">${result.test.replace(/_/g, ' ').toUpperCase()}</div>
                                    <div class="test-status">${result.status.toUpperCase()}</div>
                                    <div class="test-duration">${(result.duration || 0).toFixed(2)}ms</div>
                                    ${result.error ? `<div class="test-error">${result.error}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">Close</button>
                    <button onclick="workforceManager.testManager.runSafeDataConsistencyTests()" class="btn btn-primary">Run Again</button>
                </div>
            </div>
        `;
        
        // Add styles (reuse existing styles)
        const style = document.createElement('style');
        style.textContent = `
            .test-summary {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            .summary-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin-top: 10px;
            }
            .stat {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: white;
                border-radius: 4px;
                border-left: 4px solid #007bff;
            }
            .stat .value.success {
                color: #28a745;
                font-weight: bold;
            }
            .stat .value.error {
                color: #dc3545;
                font-weight: bold;
            }
            .test-list {
                max-height: 400px;
                overflow-y: auto;
            }
            .test-item {
                display: grid;
                grid-template-columns: 1fr auto auto;
                gap: 15px;
                align-items: center;
                padding: 12px;
                margin-bottom: 8px;
                border-radius: 4px;
                border-left: 4px solid #ddd;
            }
            .test-item.passed {
                background: #d4edda;
                border-left-color: #28a745;
            }
            .test-item.failed {
                background: #f8d7da;
                border-left-color: #dc3545;
            }
            .test-name {
                font-weight: 500;
            }
            .test-status {
                font-weight: bold;
                text-transform: uppercase;
                font-size: 12px;
            }
            .test-duration {
                font-size: 12px;
                color: #666;
            }
            .test-error {
                grid-column: 1 / -1;
                margin-top: 8px;
                padding: 8px;
                background: rgba(220, 53, 69, 0.1);
                border-radius: 4px;
                font-size: 12px;
                color: #721c24;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(modal);
    }
}
