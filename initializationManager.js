// Initialization Manager Module
// Handles all application initialization and setup

class InitializationManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
    }

    // Initialize Firebase and load data
    async initializeFirebase() {
        this.workforceManager.initStartTime = performance.now();
        console.log('🚀 Starting Firebase initialization...');
        
        try {
            await this.workforceManager.firebaseManager.initialize();

            // Check if we need to migrate from localStorage (only once)
            const hasLocalData = localStorage.getItem('workforce_employees') ||
                                localStorage.getItem('workforce_shiftTypes') ||
                                localStorage.getItem('workforce_jobRoles') ||
                                localStorage.getItem('workforce_schedules');

            // Check if Firestore already has data (skip migration if it does)
            const existingEmployees = await this.workforceManager.firebaseManager.getEmployees();
            const shouldMigrate = hasLocalData && existingEmployees.length === 0;

            if (shouldMigrate) {
                console.log('Found localStorage data and empty Firestore, migrating...');
                await this.workforceManager.firebaseManager.migrateFromLocalStorage();
                // Clear localStorage after successful migration
                this.workforceManager.dataManager.clearLocalStorage();
            }

            // Load data using hybrid approach (Firestore + cache + offline persistence)
            console.log('🔄 Loading data with hybrid approach...');
            console.log('🔐 Current user context:', {
                uid: this.workforceManager.authManager?.user?.uid,
                email: this.workforceManager.authManager?.user?.email,
                isAdmin: this.workforceManager.authManager?.adminEmails?.has(this.workforceManager.authManager?.user?.email?.toLowerCase())
            });
            await this.workforceManager.dataManager.loadDataHybrid();
            console.log('✅ Data loaded from Firestore:', {
                employees: this.workforceManager.employees.length,
                shiftTypes: this.workforceManager.shiftTypes.length,
                jobRoles: this.workforceManager.jobRoles.length,
                schedules: this.workforceManager.schedules.length
            });

            // Clean up employee data after loading (before setting up listeners)
            this.workforceManager.dataManager.cleanEmployeeData(false);

            // Ensure job roles are properly assigned to employees
            this.workforceManager.dataManager.ensureJobRoleAssignments();

            // Update role badge styles after data is loaded (BEFORE rendering calendar)
            this.workforceManager.updateRoleBadgeStyles();

            // Set calendar start date to first date in dataset if no saved date exists
            this.setOptimalStartDate();

            // Initialize rule engine after data is loaded
            if (this.workforceManager.ruleEngine) {
                await this.workforceManager.ruleEngine.initialize();
                console.log('✅ Rule Engine initialized with data');
            }

            // Now that data is loaded, render the calendar
            console.log('🎨 Rendering calendar with loaded data...');
            console.log('🔐 User context before calendar render:', {
                uid: this.workforceManager.authManager?.user?.uid,
                email: this.workforceManager.authManager?.user?.email,
                isAdmin: this.workforceManager.authManager?.adminEmails?.has(this.workforceManager.authManager?.user?.email?.toLowerCase())
            });
            this.workforceManager.switchView('calendar');

            // Create role filter buttons after data is loaded
            this.workforceManager.filterManager.createRoleFilterButtons();

            // Set up real-time listeners AFTER initial load to prevent duplicate renders
            console.log('🔄 Setting up real-time listeners...');
            this.setupRealtimeListeners();
            console.log('✅ Real-time listeners set up');

            // Mark initial load as complete to enable real-time rendering
            this.workforceManager.initialLoadComplete = true;

            // Clear the skipFirstListenerEvents flag AFTER data is loaded and listeners are set up
            this.workforceManager.skipFirstListenerEvents = false;
            console.log('🔄 Real-time listeners now active - will respond to actual changes');

            // Trigger the debounced render for the initial view
            console.log('🔄 Triggering initial render through debounced path...');
            this.workforceManager.debouncedRender();

            // Measure total initialization time
            const totalTime = performance.now() - this.workforceManager.initStartTime;
            console.log(`✅ Firebase initialized successfully in ${totalTime.toFixed(2)}ms`);
        } catch (error) {
            console.error('❌ Firebase initialization failed:', error);
            // Fallback to localStorage if Firebase fails
            this.workforceManager.dataManager.loadDataFromLocalStorage();
            // Clean up employee data after loading
            this.workforceManager.dataManager.cleanEmployeeData(false);
            // Ensure job roles are properly assigned
            this.workforceManager.dataManager.ensureJobRoleAssignments();
            // Update role badge styles after data is loaded (BEFORE rendering calendar)
            this.workforceManager.updateRoleBadgeStyles();
            // Set calendar start date to first date in dataset if no saved date exists
            this.setOptimalStartDate();
            
            // Initialize rule engine after data is loaded
            if (this.workforceManager.ruleEngine) {
                await this.workforceManager.ruleEngine.initialize();
                console.log('✅ Rule Engine initialized with data (fallback path)');
            }
            // Create role filter buttons after data is loaded
            this.workforceManager.filterManager.createRoleFilterButtons();
            // Set up real-time listeners for fallback
            this.setupRealtimeListeners();
            // Mark initial load as complete
            this.workforceManager.initialLoadComplete = true;
            // Clear the skipFirstListenerEvents flag AFTER data is loaded and listeners are set up
            this.workforceManager.skipFirstListenerEvents = false;
            console.log('🔄 Real-time listeners now active (fallback) - will respond to actual changes');
            // Trigger the debounced render for the initial view
            console.log('🔄 Triggering initial render through debounced path (fallback)...');
            this.workforceManager.debouncedRender();
        }
    }

    // Set up real-time listeners
    setupRealtimeListeners() {
        // Flag to prevent premature rendering during initial load
        this.workforceManager.initialLoadComplete = false;
        
        // Flag to skip first listener events (they're just the initial data)
        this.workforceManager.skipFirstListenerEvents = true;
        
        // Debounce re-renders to prevent loops during bulk operations
        let renderTimeout;
        let isRendering = false; // Flag to prevent multiple simultaneous renders
        
        this.workforceManager.debouncedRender = () => {
            // Don't render until initial load is complete
            if (!this.workforceManager.initialLoadComplete) {
                console.log('🔄 Skipping render - initial load not complete');
                return;
            }
            
            // Prevent multiple simultaneous renders
            if (isRendering) {
                console.log('🔄 Skipping render - already rendering');
                return;
            }
            
            clearTimeout(renderTimeout);
            renderTimeout = setTimeout(() => {
                isRendering = true;
                const renderStart = performance.now();
                console.log('🔄 Debounced render triggered - checking data state...');
                console.log('Current data counts:', {
                    employees: this.workforceManager.employees.length,
                    shiftTypes: this.workforceManager.shiftTypes.length,
                    jobRoles: this.workforceManager.jobRoles.length,
                    schedules: this.workforceManager.schedules.length
                });
                
                try {
                    // Only render if we have data or if this is the initial render
                    if (this.workforceManager.employees.length > 0 || this.workforceManager.schedules.length > 0) {
                        this.workforceManager.renderCurrentView();
                    } else {
                        console.log('🔄 Skipping render - no data available yet');
                    }
                } finally {
                    isRendering = false;
                    const renderTime = performance.now() - renderStart;
                    console.log(`🔄 Debounced render completed in ${renderTime.toFixed(2)}ms`);
                }
            }, 25); // Reduced to 25ms debounce for better responsiveness
        };

        // Listen for employee changes
        this.workforceManager.firebaseManager.onEmployeesChange((employees) => {
            console.log('📊 Employee listener triggered:', {
                isResetting: this.workforceManager.isResetting,
                isRestoringSnapshot: this.workforceManager.isRestoringSnapshot,
                skipFirstListenerEvents: this.workforceManager.skipFirstListenerEvents,
                currentCount: this.workforceManager.employees.length,
                newCount: employees.length,
                initialLoadComplete: this.workforceManager.initialLoadComplete
            });
            
            if (this.workforceManager.isResetting) return; // Skip updates during reset
            if (this.workforceManager.isRestoringSnapshot) {
                console.log('📊 Skipping employee listener - isRestoringSnapshot:', this.workforceManager.isRestoringSnapshot);
                return; // Skip updates during snapshot restore
            }
            if (this.workforceManager.skipFirstListenerEvents) {
                console.log('📊 Skipping first employee listener event (initial data load)');
                return; // Skip first event (initial data load)
            }
            if (JSON.stringify(this.workforceManager.employees) === JSON.stringify(employees)) {
                console.log('📊 Skipping employee listener - no changes detected');
                return; // Skip if no change
            }
            
            // Check if this is just a shiftType update (which happens during shift assignments)
            const currentEmployees = this.workforceManager.employees;
            
            // First check if arrays are same length
            if (currentEmployees.length !== employees.length) {
                this.workforceManager.employees = employees;
                this.workforceManager.debouncedRender();
                return;
            }
            
            // Create maps for easier comparison
            const currentMap = new Map(currentEmployees.map(emp => [emp.id, emp]));
            const updatedMap = new Map(employees.map(emp => [emp.id, emp]));
            
            let hasNonShiftTypeChanges = false;
            let shiftTypeChanges = 0;
            
            // Check each employee
            for (const [id, current] of currentMap) {
                const updated = updatedMap.get(id);
                if (!updated) {
                    hasNonShiftTypeChanges = true;
                    break;
                }
                
                // Compare all fields except shiftType and metadata fields
                const currentWithoutShiftType = { ...current };
                const updatedWithoutShiftType = { ...updated };
                delete currentWithoutShiftType.shiftType;
                delete updatedWithoutShiftType.shiftType;
                // Also exclude metadata fields that don't affect UI
                delete currentWithoutShiftType.updatedAt;
                delete updatedWithoutShiftType.updatedAt;
                delete currentWithoutShiftType.createdAt;
                delete updatedWithoutShiftType.createdAt;
                delete currentWithoutShiftType.shifts;
                delete updatedWithoutShiftType.shifts;
                
                // Use a more robust comparison that ignores property order
                const currentKeys = Object.keys(currentWithoutShiftType).sort();
                const updatedKeys = Object.keys(updatedWithoutShiftType).sort();
                
                // Check if keys are different
                if (currentKeys.length !== updatedKeys.length || !currentKeys.every(key => updatedKeys.includes(key))) {
                    hasNonShiftTypeChanges = true;
                    break;
                }
                
                // Check if values are different (ignoring property order)
                const hasValueChanges = currentKeys.some(key => 
                    currentWithoutShiftType[key] !== updatedWithoutShiftType[key]
                );
                
                if (hasValueChanges) {
                    hasNonShiftTypeChanges = true;
                    break;
                }
                
                // Count shiftType changes
                if (current.shiftType !== updated.shiftType) {
                    shiftTypeChanges++;
                }
            }
            
            if (!hasNonShiftTypeChanges && shiftTypeChanges > 0) {
                // Only shiftType changed - skip render (schedules listener will handle it)
                this.workforceManager.employees = employees;
                return;
            }
            
            // If no changes detected, just update data without rendering
            if (!hasNonShiftTypeChanges && shiftTypeChanges === 0) {
                this.workforceManager.employees = employees;
                return;
            }
            
            // Actual employee changes detected - trigger render
            this.workforceManager.employees = employees;
            this.workforceManager.debouncedRender();
        });

        // Listen for shift type changes
        this.workforceManager.firebaseManager.onShiftTypesChange((shiftTypes) => {
            if (this.workforceManager.isResetting) return; // Skip updates during reset
            if (this.workforceManager.isRestoringSnapshot) {
                console.log('📊 Skipping shift types listener during snapshot restore');
                return; // Skip updates during snapshot restore
            }
            if (this.workforceManager.skipFirstListenerEvents) {
                console.log('📊 Skipping first shift types listener event (initial data load)');
                return; // Skip first event (initial data load)
            }
            if (JSON.stringify(this.workforceManager.shiftTypes) === JSON.stringify(shiftTypes)) return; // Skip if no change
            console.log('📊 Shift types updated from Firestore - triggering render');
            this.workforceManager.shiftTypes = shiftTypes;
            this.workforceManager.debouncedRender();
        });

        // Listen for job role changes
        this.workforceManager.firebaseManager.onJobRolesChange((jobRoles) => {
            if (this.workforceManager.isResetting) return; // Skip updates during reset
            if (this.workforceManager.isRestoringSnapshot) {
                console.log('📊 Skipping job roles listener during snapshot restore');
                return; // Skip updates during snapshot restore
            }
            if (this.workforceManager.skipFirstListenerEvents) {
                console.log('📊 Skipping first job roles listener event (initial data load)');
                return; // Skip first event (initial data load)
            }
            if (JSON.stringify(this.workforceManager.jobRoles) === JSON.stringify(jobRoles)) return; // Skip if no change
            console.log('📊 Job roles updated from Firestore - triggering render');
            this.workforceManager.jobRoles = jobRoles;
            this.workforceManager.debouncedRender();
        });

        // Listen for schedule changes
        this.workforceManager.firebaseManager.onSchedulesChange((schedules) => {
            if (this.workforceManager.isResetting) return; // Skip updates during reset
            if (this.workforceManager.isRestoringSnapshot) {
                console.log('📊 Skipping schedules listener during snapshot restore');
                return; // Skip updates during snapshot restore
            }
            if (this.workforceManager.skipFirstListenerEvents) {
                console.log('📊 Skipping first schedules listener event (initial data load)');
                return; // Skip first event (initial data load)
            }
            if (JSON.stringify(this.workforceManager.schedules) === JSON.stringify(schedules)) return; // Skip if no change
            this.workforceManager.schedules = schedules;
            this.workforceManager.debouncedRender();
        });
        
        // Flag is now cleared immediately after data loading is complete
    }

    bindFileHandlers() {
        console.log('Binding file handlers...');

        // XLSX import
        const xlsxInput = document.getElementById('xlsxImportFile');
        if (xlsxInput) {
            console.log('Found XLSX input element');
            xlsxInput.addEventListener('change', (e) => {
                console.log('XLSX file selected:', e.target.files[0]);
                console.log('ImportManager available:', !!this.workforceManager.importManager);
                if (this.workforceManager.importManager && typeof this.workforceManager.importManager.handleXLSXImport === 'function') {
                    console.log('Calling ImportManager.handleXLSXImport');
                    this.workforceManager.importManager.handleXLSXImport(e);
                } else {
                    console.error('ImportManager or handleXLSXImport method not available');
                }
            });
        } else {
            console.error('XLSX input element not found');
        }

        // Time interval selector
        const timeIntervalSelect = document.getElementById('timeInterval');
        if (timeIntervalSelect) {
            // Set initial value from localStorage
            const savedInterval = localStorage.getItem('timeInterval');
            if (savedInterval) {
                timeIntervalSelect.value = savedInterval;
            }

            timeIntervalSelect.addEventListener('change', (event) => {
                const newInterval = parseInt(event.target.value);
                localStorage.setItem('timeInterval', newInterval);
                this.workforceManager.calendarRenderer.renderScheduleMatrix();
            });
        } else {
            console.error('❌ Time interval selector not found');
        }

        // Calendar start date selector
        const startDateInput = document.getElementById('calendarStartDate');
        if (startDateInput) {

            // Set initial value from localStorage
            const savedStartDate = localStorage.getItem('calendarStartDate');
            if (savedStartDate) {
                startDateInput.value = savedStartDate;
            } else {
                // Set to current start date
                startDateInput.value = this.workforceManager.currentWeekStart.toISOString().split('T')[0];
            }

            startDateInput.addEventListener('change', (event) => {
                const newStartDate = event.target.value;
                if (newStartDate) {
                    // Create date at local midnight to avoid timezone issues
                    const [year, month, day] = newStartDate.split('-').map(Number);
                    const localDate = new Date(year, month - 1, day);

                    localStorage.setItem('calendarStartDate', newStartDate);
                    this.workforceManager.currentWeekStart = localDate;
                    this.workforceManager.calendarRenderer.renderScheduleMatrix();
                }
            });
        } else {
            console.error('❌ Calendar start date input not found');
        }
    }

    /**
     * Set the calendar start date to the first date in the dataset if no saved date exists
     */
    setOptimalStartDate() {
        // Check if there's already a saved start date
        const savedStartDate = localStorage.getItem('calendarStartDate');
        if (savedStartDate) {
            console.log('📅 Using saved start date:', savedStartDate);
            return;
        }

        // If no saved date and we have schedule data, use the first date
        if (this.workforceManager.schedules && this.workforceManager.schedules.length > 0) {
            const importedDates = this.workforceManager.schedules
                .map(s => s.date)
                .filter(Boolean)
                .sort();
            
            if (importedDates.length > 0) {
                const firstDate = importedDates[0];
                console.log('📅 Setting start date to first date in dataset:', firstDate);
                
                // Create date at local midnight to avoid timezone issues
                const [year, month, day] = firstDate.split('-').map(Number);
                this.workforceManager.currentWeekStart = new Date(year, month - 1, day);
                localStorage.setItem('calendarStartDate', firstDate);
                
                // Update the calendar start date input field if it exists
                const startDateInput = document.getElementById('calendarStartDate');
                if (startDateInput) {
                    startDateInput.value = firstDate;
                }
            }
        }
    }
}
