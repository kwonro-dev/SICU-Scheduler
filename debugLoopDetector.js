/**
 * Debug Loop Detector
 * Helps identify what's causing infinite loops in the application
 */
class DebugLoopDetector {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.callCounts = new Map();
        this.lastCallTimes = new Map();
        this.loopThreshold = 10; // Calls within 1 second
        this.timeWindow = 1000; // 1 second window
        this.isEnabled = false;
    }

    /**
     * Enable loop detection
     */
    enable() {
        this.isEnabled = true;
        console.log('🔍 Loop detection enabled');
        this.startMonitoring();
    }

    /**
     * Disable loop detection
     */
    disable() {
        this.isEnabled = false;
        console.log('🔍 Loop detection disabled');
    }

    /**
     * Track a function call
     */
    track(functionName, details = {}) {
        if (!this.isEnabled) return;

        const now = Date.now();
        const key = functionName;

        // Initialize if first call
        if (!this.callCounts.has(key)) {
            this.callCounts.set(key, 0);
            this.lastCallTimes.set(key, now);
        }

        // Reset count if outside time window
        if (now - this.lastCallTimes.get(key) > this.timeWindow) {
            this.callCounts.set(key, 0);
        }

        // Increment count
        const count = this.callCounts.get(key) + 1;
        this.callCounts.set(key, count);
        this.lastCallTimes.set(key, now);

        // Check for potential loop
        if (count >= this.loopThreshold) {
            console.warn(`🔄 POTENTIAL LOOP DETECTED: ${functionName} called ${count} times in ${this.timeWindow}ms`, details);
            this.reportLoop(functionName, count, details);
        }
    }

    /**
     * Report detected loop
     */
    reportLoop(functionName, count, details) {
        console.group(`🔄 Loop Detected: ${functionName}`);
        console.log(`Function: ${functionName}`);
        console.log(`Call Count: ${count}`);
        console.log(`Time Window: ${this.timeWindow}ms`);
        console.log(`Details:`, details);
        console.log(`Stack Trace:`, new Error().stack);
        console.groupEnd();

        // Show user notification
        this.showLoopNotification(functionName, count);
    }

    /**
     * Show loop notification to user
     */
    showLoopNotification(functionName, count) {
        const notification = document.createElement('div');
        notification.className = 'loop-detection-warning';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">🔄 Loop Detected</div>
            <div>Function: ${functionName}</div>
            <div>Calls: ${count} in 1 second</div>
            <button onclick="this.parentElement.remove()" style="
                background: white;
                color: #ff4444;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                margin-top: 8px;
                cursor: pointer;
            ">Dismiss</button>
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
     * Start monitoring common functions
     */
    startMonitoring() {
        // Monitor render functions
        this.monitorFunction('renderCurrentView', () => {
            return {
                activeTab: document.querySelector('.nav-tab.active')?.id,
                employees: this.workforceManager.employees.length,
                schedules: this.workforceManager.schedules.length
            };
        });

        // Monitor debounced render
        this.monitorFunction('debouncedRender', () => {
            return {
                initialLoadComplete: this.workforceManager.initialLoadComplete,
                isResetting: this.workforceManager.isResetting
            };
        });

        // Monitor data consistency validation
        this.monitorFunction('validateDataConsistency', () => {
            return {
                isValidating: this.workforceManager.dataConsistencyManager?.isValidating,
                lastValidationTime: this.workforceManager.dataConsistencyManager?.lastValidationTime
            };
        });

        // Monitor real-time listeners
        this.monitorFunction('onEmployeesChange', () => {
            return {
                skipFirstListenerEvents: this.workforceManager.skipFirstListenerEvents,
                isResetting: this.workforceManager.isResetting
            };
        });

        this.monitorFunction('onSchedulesChange', () => {
            return {
                skipFirstListenerEvents: this.workforceManager.skipFirstListenerEvents,
                isResetting: this.workforceManager.isResetting
            };
        });
    }

    /**
     * Monitor a specific function
     */
    monitorFunction(functionName, detailsProvider) {
        const originalFunction = this.workforceManager[functionName];
        if (originalFunction && typeof originalFunction === 'function') {
            this.workforceManager[functionName] = (...args) => {
                this.track(functionName, detailsProvider ? detailsProvider() : {});
                return originalFunction.apply(this.workforceManager, args);
            };
        }
    }

    /**
     * Get current call statistics
     */
    getStats() {
        const stats = {};
        for (const [functionName, count] of this.callCounts.entries()) {
            const lastCall = this.lastCallTimes.get(functionName);
            const timeSinceLastCall = Date.now() - lastCall;
            stats[functionName] = {
                count,
                lastCall: new Date(lastCall).toISOString(),
                timeSinceLastCall: `${timeSinceLastCall}ms`
            };
        }
        return stats;
    }

    /**
     * Reset all counters
     */
    reset() {
        this.callCounts.clear();
        this.lastCallTimes.clear();
        console.log('🔍 Loop detection counters reset');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugLoopDetector;
} else {
    window.DebugLoopDetector = DebugLoopDetector;
}
