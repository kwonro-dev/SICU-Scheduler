// Incremental Loader Module
// Loads data in priority order for faster perceived performance

class IncrementalLoader {
    constructor(firebaseManager) {
        this.firebaseManager = firebaseManager;
        this.loadingProgress = {
            employees: false,
            shiftTypes: false,
            jobRoles: false,
            schedules: false
        };
    }

    /**
     * Load data in priority order for faster perceived performance
     * 1. Job roles (needed for employee badges)
     * 2. Employees (needed for calendar rows)
     * 3. Shift types (needed for shift colors)
     * 4. Schedules (needed for calendar data)
     */
    async loadIncremental(onProgress) {
        const startTime = performance.now();
        const result = {};

        try {
            // Phase 1: Load job roles first (smallest, needed for UI)
            console.log('📋 Phase 1: Loading job roles...');
            const jobRolesSnapshot = await this.firebaseManager.db
                .collection('organizations').doc(this.firebaseManager.currentOrgId)
                .collection('jobRoles').get();
            result.jobRoles = jobRolesSnapshot.docs.map(doc => doc.data());
            this.loadingProgress.jobRoles = true;
            onProgress && onProgress({ phase: 'jobRoles', data: result, progress: 25 });

            // Phase 2: Load employees (needed for calendar structure)
            console.log('👥 Phase 2: Loading employees...');
            const employeesSnapshot = await this.firebaseManager.db
                .collection('organizations').doc(this.firebaseManager.currentOrgId)
                .collection('employees').get();
            result.employees = employeesSnapshot.docs.map(doc => doc.data());
            this.loadingProgress.employees = true;
            onProgress && onProgress({ phase: 'employees', data: result, progress: 50 });

            // Phase 3: Load shift types (needed for shift colors)
            console.log('⏰ Phase 3: Loading shift types...');
            const shiftTypesSnapshot = await this.firebaseManager.db
                .collection('organizations').doc(this.firebaseManager.currentOrgId)
                .collection('shiftTypes').get();
            result.shiftTypes = shiftTypesSnapshot.docs.map(doc => doc.data());
            this.loadingProgress.shiftTypes = true;
            onProgress && onProgress({ phase: 'shiftTypes', data: result, progress: 75 });

            // Phase 4: Load schedules (largest, needed for calendar data)
            console.log('📅 Phase 4: Loading schedules...');
            const schedulesSnapshot = await this.firebaseManager.db
                .collection('organizations').doc(this.firebaseManager.currentOrgId)
                .collection('schedules').get();
            result.schedules = schedulesSnapshot.docs.map(doc => doc.data());
            this.loadingProgress.schedules = true;
            onProgress && onProgress({ phase: 'schedules', data: result, progress: 100 });

            const totalTime = performance.now() - startTime;
            console.log(`⚡ Incremental load completed in ${totalTime.toFixed(2)}ms`);
            
            return result;
        } catch (error) {
            console.error('Incremental loading failed:', error);
            throw error;
        }
    }

    /**
     * Check if we have enough data to render the UI
     */
    canRenderUI() {
        return this.loadingProgress.jobRoles && this.loadingProgress.employees;
    }

    /**
     * Check if we have all data loaded
     */
    isComplete() {
        return Object.values(this.loadingProgress).every(Boolean);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IncrementalLoader;
} else {
    window.IncrementalLoader = IncrementalLoader;
}
