/**
 * Emergency Loop Stopper
 * Run this in the browser console to stop any infinite loops
 */

// Stop all real-time listeners
if (window.workforceManager && window.workforceManager.firebaseManager) {
    console.log('🛑 Stopping all Firebase listeners...');
    window.workforceManager.firebaseManager.removeAllListeners();
}

// Disable data consistency validation
if (window.workforceManager && window.workforceManager.dataConsistencyManager) {
    console.log('🛑 Disabling data consistency validation...');
    window.workforceManager.dataConsistencyManager.isValidating = true;
    window.workforceManager.dataConsistencyManager.validationCooldown = 60000; // 1 minute
}

// Clear any pending timeouts
console.log('🛑 Clearing all timeouts...');
let highestTimeoutId = setTimeout(() => {}, 0);
for (let i = 0; i < highestTimeoutId; i++) {
    clearTimeout(i);
}

// Clear any pending intervals
console.log('🛑 Clearing all intervals...');
let highestIntervalId = setInterval(() => {}, 0);
for (let i = 0; i < highestIntervalId; i++) {
    clearInterval(i);
}

// Reset flags
if (window.workforceManager) {
    console.log('🛑 Resetting application flags...');
    window.workforceManager.isResetting = true;
    window.workforceManager.skipFirstListenerEvents = true;
    window.workforceManager.initialLoadComplete = false;
}

// Disable debug loop detector
if (window.workforceManager && window.workforceManager.debugLoopDetector) {
    console.log('🛑 Disabling debug loop detector...');
    window.workforceManager.debugLoopDetector.disable();
}

console.log('✅ Emergency loop stopping complete!');
console.log('💡 To restart the application, refresh the page.');
