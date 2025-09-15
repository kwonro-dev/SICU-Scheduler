// Rule System Test File
// This file can be used to test the rule system functionality

/**
 * Test the rule system with sample data
 */
function testRuleSystem() {
    console.log('🧪 Testing Rule System...');
    
    // Check if rule engine is available
    if (typeof RuleEngine === 'undefined') {
        console.error('❌ RuleEngine not found');
        return false;
    }
    
    // Check if rule manager is available
    if (typeof RuleManager === 'undefined') {
        console.error('❌ RuleManager not found');
        return false;
    }
    
    console.log('✅ Rule Engine and Manager classes found');
    
    // Test rule engine initialization
    try {
        const testManager = {
            employees: [
                { id: 'emp1', name: 'John Doe', jobRole: 'role1' },
                { id: 'emp2', name: 'Jane Smith', jobRole: 'role2' }
            ],
            jobRoles: [
                { id: 'role1', name: 'Charge Nurse' },
                { id: 'role2', name: 'RN' }
            ],
            shiftTypes: [
                { id: 'shift1', name: 'Morning' },
                { id: 'shift2', name: 'Afternoon' }
            ],
            schedules: [
                { employeeId: 'emp1', date: '2024-01-01', shiftId: 'shift1' },
                { employeeId: 'emp2', date: '2024-01-01', shiftId: 'shift1' }
            ]
        };
        
        const ruleEngine = new RuleEngine(testManager);
        ruleEngine.initialize();
        
        console.log('✅ Rule Engine initialized successfully');
        
        // Test adding a rule
        const testRule = {
            name: 'Test Rule',
            description: 'Test rule for validation',
            conditions: [
                {
                    type: 'count_by_role',
                    role: 'Charge Nurse',
                    operator: 'equals',
                    value: 1,
                    severity: 'error'
                }
            ],
            enabled: true
        };
        
        ruleEngine.addRule(testRule);
        console.log('✅ Test rule added successfully');
        
        // Test rule evaluation
        const violations = ruleEngine.evaluateRules();
        console.log('✅ Rule evaluation completed:', violations.length, 'violations found');
        
        // Test rule templates
        const templates = ruleEngine.getRuleTemplates();
        console.log('✅ Rule templates loaded:', templates.length, 'templates available');
        
        return true;
        
    } catch (error) {
        console.error('❌ Rule system test failed:', error);
        return false;
    }
}

/**
 * Test rule manager UI functionality
 */
function testRuleManagerUI() {
    console.log('🧪 Testing Rule Manager UI...');
    
    // Check if rule manager button exists
    const manageRulesBtn = document.getElementById('manageRulesBtn');
    if (!manageRulesBtn) {
        console.error('❌ Manage Rules button not found');
        return false;
    }
    
    console.log('✅ Manage Rules button found');
    
    // Test button click (this will open the modal)
    try {
        manageRulesBtn.click();
        console.log('✅ Rule management modal opened');
        
        // Close the modal after a short delay
        setTimeout(() => {
            const modal = document.querySelector('.modal.active');
            if (modal) {
                modal.remove();
                console.log('✅ Rule management modal closed');
            }
        }, 1000);
        
        return true;
        
    } catch (error) {
        console.error('❌ Rule Manager UI test failed:', error);
        return false;
    }
}

/**
 * Run all rule system tests
 */
function runAllRuleTests() {
    console.log('🚀 Starting Rule System Tests...');
    
    const results = {
        ruleEngine: testRuleSystem(),
        ruleManagerUI: testRuleManagerUI()
    };
    
    const allPassed = Object.values(results).every(result => result === true);
    
    console.log('📊 Test Results:', results);
    console.log(allPassed ? '✅ All tests passed!' : '❌ Some tests failed');
    
    return results;
}

// Make functions available globally for testing
window.testRuleSystem = testRuleSystem;
window.testRuleManagerUI = testRuleManagerUI;
window.runAllRuleTests = runAllRuleTests;

// Test function to check if the manage rules button exists
function checkManageRulesButton() {
    console.log('🔍 Checking for manage rules button...');
    const button = document.getElementById('manageRulesBtn');
    if (button) {
        console.log('✅ Manage rules button found:', button);
        console.log('Button text:', button.textContent);
        console.log('Button visible:', button.offsetParent !== null);
        return true;
    } else {
        console.error('❌ Manage rules button not found!');
        console.log('Available buttons with "rule" in ID:', 
            Array.from(document.querySelectorAll('[id*="rule"]')).map(el => el.id));
        return false;
    }
}

// Test function to manually trigger rule manager
function testRuleManager() {
    console.log('🧪 Testing rule manager...');
    if (window.workforceManager && window.workforceManager.ruleManager) {
        console.log('✅ Rule manager found, opening modal...');
        window.workforceManager.ruleManager.showRuleManagementModal();
        return true;
    } else {
        console.error('❌ Rule manager not found!');
        console.log('Workforce manager:', window.workforceManager);
        return false;
    }
}

// Function to manually initialize rule manager
function initializeRuleManager() {
    console.log('🔧 Manually initializing rule manager...');
    if (window.workforceManager && typeof RuleManager !== 'undefined') {
        if (!window.workforceManager.ruleManager) {
            window.workforceManager.ruleManager = new RuleManager(window.workforceManager);
            window.workforceManager.ruleManager.initialize(window.workforceManager.ruleEngine);
            console.log('✅ Rule manager manually initialized');
            return true;
        } else {
            console.log('✅ Rule manager already initialized');
            return true;
        }
    } else {
        console.error('❌ Cannot initialize rule manager - missing dependencies');
        return false;
    }
}

// Make functions available globally
window.checkManageRulesButton = checkManageRulesButton;
window.testRuleManager = testRuleManager;
window.initializeRuleManager = initializeRuleManager;

// Auto-run tests when page loads (for development)
if (window.location.hostname === 'localhost') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            console.log('🔧 Auto-running rule system tests...');
            checkManageRulesButton();
            runAllRuleTests();
        }, 2000);
    });
}
