// Data Manager Module
// Handles all data operations including loading, saving, and data integrity

class DataManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
    }

    /**
     * Load data using hybrid approach (Firestore + cache + offline persistence)
     */
    async loadDataHybrid() {
        const startTime = performance.now();
        console.log('🚀 Hybrid data loading started...');

        try {
            // Use hybrid data manager for optimal performance
            const data = await this.workforceManager.hybridDataManager.loadData();
            
            // Assign data to instance variables
            console.log('📊 Assigning loaded data to workforceManager:', {
                employees: data.employees?.length || 0,
                shiftTypes: data.shiftTypes?.length || 0,
                jobRoles: data.jobRoles?.length || 0,
                schedules: data.schedules?.length || 0,
                rules: data.rules?.length || 0
            });
            
            this.workforceManager.employees = data.employees || [];
            this.workforceManager.shiftTypes = data.shiftTypes || [];
            this.workforceManager.jobRoles = data.jobRoles || [];
            this.workforceManager.schedules = data.schedules || [];
            
            // Load rules into rule engine if available
            if (data.rules && this.workforceManager.ruleEngine) {
                this.workforceManager.ruleEngine.rules = data.rules;
                console.log(`✅ Loaded ${data.rules.length} rules into rule engine`);
            }

            const loadTime = performance.now() - startTime;
            console.log(`⚡ Hybrid load completed in ${loadTime.toFixed(2)}ms`);
            console.log('📊 Hybrid data loaded:', {
                employees: this.workforceManager.employees.length,
                shiftTypes: this.workforceManager.shiftTypes.length,
                jobRoles: this.workforceManager.jobRoles.length,
                schedules: this.workforceManager.schedules.length,
                rules: this.workforceManager.ruleEngine?.rules?.length || 0,
                loadTime: `${loadTime.toFixed(2)}ms`
            });

            // Show cache statistics
            const cacheStats = this.workforceManager.hybridDataManager.getCacheStats();
            console.log('💾 Cache statistics:', cacheStats);

            // Set optimal start date if no saved date exists
            if (this.workforceManager.initializationManager) {
                this.workforceManager.initializationManager.setOptimalStartDate();
            }

        } catch (error) {
            console.error('❌ Hybrid data loading failed:', error);
            throw error;
        }
    }

    // Load data from Firestore (fallback method)
    async loadDataFromFirestore() {
        try {
            console.log('📊 Loading data from Firestore with optimized single query...');
            const startTime = performance.now();
            
            // Use optimized single query for much better performance
            const allData = await this.workforceManager.firebaseManager.getAllData();
            
            const loadTime = performance.now() - startTime;
            console.log(`⚡ Firestore load completed in ${loadTime.toFixed(2)}ms`);
            
            this.workforceManager.employees = allData.employees;
            this.workforceManager.shiftTypes = allData.shiftTypes;
            this.workforceManager.jobRoles = allData.jobRoles;
            this.workforceManager.schedules = allData.schedules;
            
            console.log('📊 Data assigned to instance variables:', {
                employees: this.workforceManager.employees.length,
                shiftTypes: this.workforceManager.shiftTypes.length,
                jobRoles: this.workforceManager.jobRoles.length,
                schedules: this.workforceManager.schedules.length
            });
            
            // Debug: Check if schedules are actually loaded
            if (this.workforceManager.schedules.length === 0) {
                console.error('❌ No schedules loaded from Firestore!');
                console.log('🔍 All data from Firestore:', allData);
            } else {
                console.log('✅ Schedules loaded successfully:', this.workforceManager.schedules.slice(0, 3));
            }
                
            console.log('📊 Data loaded from Firestore:', {
                employees: this.workforceManager.employees.length,
                shiftTypes: this.workforceManager.shiftTypes.length,
                jobRoles: this.workforceManager.jobRoles.length,
                schedules: this.workforceManager.schedules.length,
                loadTime: `${loadTime.toFixed(2)}ms`
            });
            
            // Performance comparison with localStorage
            if (this.workforceManager.employees.length > 0) {
                console.log('🔍 Performance Analysis:');
                console.log(`   Firestore: ${loadTime.toFixed(2)}ms for ${this.workforceManager.employees.length + this.workforceManager.shiftTypes.length + this.workforceManager.jobRoles.length + this.workforceManager.schedules.length} total items`);
                console.log(`   Expected localStorage: ~1-5ms for same data`);
                console.log(`   Network overhead: ${(loadTime - 3).toFixed(2)}ms (${((loadTime - 3) / loadTime * 100).toFixed(1)}%)`);
            }

            // Set optimal start date if no saved date exists
            if (this.workforceManager.initializationManager) {
                this.workforceManager.initializationManager.setOptimalStartDate();
            }
        } catch (error) {
            console.error('Failed to load data from Firestore:', error);
            throw error;
        }
    }

    // Fallback to localStorage
    loadDataFromLocalStorage() {
        console.log('Falling back to localStorage...');
        const startTime = performance.now();
        
        this.workforceManager.employees = this.loadData('employees') || [];
        this.workforceManager.shiftTypes = this.loadData('shiftTypes') || [];
        this.workforceManager.jobRoles = this.loadData('jobRoles') || [];
        this.workforceManager.schedules = this.loadData('schedules') || [];
        
        const loadTime = performance.now() - startTime;
        console.log(`⚡ localStorage load completed in ${loadTime.toFixed(2)}ms`);
        console.log('📊 Data loaded from localStorage:', {
            employees: this.workforceManager.employees.length,
            shiftTypes: this.workforceManager.shiftTypes.length,
            jobRoles: this.workforceManager.jobRoles.length,
            schedules: this.workforceManager.schedules.length,
            loadTime: `${loadTime.toFixed(2)}ms`
        });

        // Set optimal start date if no saved date exists
        if (this.workforceManager.initializationManager) {
            this.workforceManager.initializationManager.setOptimalStartDate();
        }
    }

    /**
     * Load data from localStorage
     * @param {string} key - The key to load data for
     * @returns {*} The parsed data or null if not found
     */
    loadData(key) {
        const saved = localStorage.getItem(`workforce_${key}`);
        console.log(`Loading ${key} from localStorage:`, saved ? 'Found' : 'Not found');
        const parsed = saved ? JSON.parse(saved) : null;
        console.log(`Parsed ${key}:`, parsed);
        return parsed;
    }

    /**
     * Save data to Firestore (or localStorage as fallback)
     * @param {string} key - The key to save data under
     * @param {*} data - The data to save
     * @param {boolean} skipRealtime - Skip real-time updates during bulk operations
     */
    async saveData(key, data, skipRealtime = false) {
        try {
            if (this.workforceManager.firebaseManager) {
                // For bulk operations (like imports), clear and recreate
                // For individual operations, this method should be called with full arrays
                if (skipRealtime) {
                    await this.saveToFirestoreBulk(key, data);
                } else {
                    await this.saveToFirestore(key, data);
                }
                console.log(`✅ Saved ${key} to Firestore`);
            } else {
                // Fallback to localStorage
                console.log(`Saving ${key} to localStorage (fallback):`, data);
                localStorage.setItem(`workforce_${key}`, JSON.stringify(data));
            }
        } catch (error) {
            console.error(`Failed to save ${key}:`, error);
            // Fallback to localStorage
            localStorage.setItem(`workforce_${key}`, JSON.stringify(data));
        }
    }

    /**
     * Bulk save that minimizes real-time listener triggers
     */
    async saveToFirestoreBulk(key, data) {
        console.log(`🚀 Starting bulk save for ${key} with ${data.length} items...`);
        
        // Use batch replacement for maximum efficiency
        await this.workforceManager.firebaseManager.batchReplace(key, data);
        
        console.log(`✅ Bulk save completed for ${key}`);
    }

    /**
     * Save data array to Firestore by clearing and recreating
     */
    async saveToFirestore(key, data) {
        // Clear existing data
        await this.clearCollection(key);

        // Create all items fresh
        switch (key) {
            case 'employees':
                for (const employee of data) {
                    await this.workforceManager.firebaseManager.createEmployee(employee);
                }
                break;
            case 'shiftTypes':
                for (const shiftType of data) {
                    await this.workforceManager.firebaseManager.createShiftType(shiftType);
                }
                break;
            case 'jobRoles':
                for (const jobRole of data) {
                    await this.workforceManager.firebaseManager.createJobRole(jobRole);
                }
                break;
            case 'schedules':
                for (const schedule of data) {
                    await this.workforceManager.firebaseManager.createSchedule(schedule);
                }
                break;
        }
    }

    /**
     * Clear a collection (used for bulk updates)
     */
    async clearCollection(collectionName) {
        if (!this.workforceManager.firebaseManager) {
            console.log(`No Firebase manager available for clearing ${collectionName}`);
            return;
        }

        try {
            console.log(`🔍 Reading existing items from ${collectionName}...`);
            const existingItems = await this.workforceManager.firebaseManager.read(collectionName);
            console.log(`Found ${existingItems.length} items in ${collectionName}`);
            
            if (existingItems.length === 0) {
                console.log(`✅ ${collectionName} is already empty`);
                return;
            }

            // Use batch deletion for much better performance
            console.log(`🚀 Starting batch deletion of ${existingItems.length} items from ${collectionName}...`);
            await this.workforceManager.firebaseManager.batchDelete(collectionName, existingItems);
            console.log(`✅ Batch cleared ${existingItems.length} items from ${collectionName}`);
        } catch (error) {
            console.error(`❌ Failed to clear ${collectionName}:`, error);
        }
    }

    // Clear localStorage after migration
    clearLocalStorage() {
        localStorage.removeItem('workforce_employees');
        localStorage.removeItem('workforce_shiftTypes');
        localStorage.removeItem('workforce_jobRoles');
        localStorage.removeItem('workforce_schedules');
        console.log('🧹 Cleared localStorage after migration');
    }

    // Ensure job roles are properly assigned to employees after data load
    ensureJobRoleAssignments() {
        console.log('🔍 Ensuring job role assignments are correct...');
        
        let updatedCount = 0;
        this.workforceManager.employees.forEach(employee => {
            // Check if employee has a valid job role
            if (employee.jobRole) {
                const roleExists = this.workforceManager.jobRoles.find(role => role.id === employee.jobRole);
                if (!roleExists) {
                    console.warn(`Employee ${employee.name} has invalid job role ${employee.jobRole}, clearing it`);
                    employee.jobRole = null;
                    updatedCount++;
                }
            }
        });
        
        if (updatedCount > 0) {
            console.log(`🔧 Fixed ${updatedCount} invalid job role assignments`);
            // Save the corrected employees data
            this.saveData('employees', this.workforceManager.employees);
        } else {
            console.log('✅ All job role assignments are valid');
        }
    }

    // Clean up employee data by removing deprecated fields
    cleanEmployeeData(saveToFirestore = true) {
        if (this.workforceManager.employees && this.workforceManager.employees.length > 0) {
            this.workforceManager.employees.forEach(employee => {
                // Remove deprecated fields
                delete employee.email;
                delete employee.phone;
                delete employee.hireDate;
                delete employee.status;
            });

            // Only save to Firestore if requested (not during initialization)
            if (saveToFirestore) {
                this.saveData('employees', this.workforceManager.employees);
                console.log('🧹 Cleaned up employee data - removed email, phone, hireDate, and status fields');
            } else {
                console.log('🧹 Cleaned up employee data in memory - removed email, phone, hireDate, and status fields');
            }
        }
    }
}
