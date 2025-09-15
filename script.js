// Workforce Schedule Manager Application
/**
 * Main application class that manages the workforce scheduling system
 * Coordinates between all modules and handles data persistence
 */
class WorkforceScheduleManager {
    /**
     * Initialize the Workforce Schedule Manager application
     * Sets up all modules, loads data, and initializes the UI
     */
    constructor() {

        // Initialize Firebase manager
        this.authManager = window.authManager;
        this.firebaseManager = new FirebaseManager(this.authManager);
        
        // Initialize hybrid data manager for optimal performance
        this.hybridDataManager = new HybridDataManager(this.firebaseManager);
        
        // Initialize data manager
        this.dataManager = new DataManager(this);
        
        // Initialize activity manager
        this.activityManager = new ActivityManager(this);
        
        // Initialize test manager
        this.testManager = new TestManager(this);
        
        // Initialize initialization manager
        this.initializationManager = new InitializationManager(this);
        
        // Activity logger will be initialized after auth is ready
        this.activityLogger = null;

        // Snapshots will be created only when data is imported or user explicitly saves
        
        // Initialize data arrays (will be populated from Firestore)
        this.employees = [];
        this.shiftTypes = [];
        this.jobRoles = [];
        this.schedules = [];

        // Initialize change tracking
        this.shiftChanges = this.dataManager.loadData('shiftChanges') || [];
        this.changeHistory = this.dataManager.loadData('changeHistory') || [];

        // Initialize filter manager
        this.filterManager = new FilterManager(this);

        // Initialize currentWeekStart from localStorage or default to Monday of current week
        const savedStartDate = localStorage.getItem('calendarStartDate');
        if (savedStartDate) {
            // Create date at local midnight to avoid timezone issues
            const [year, month, day] = savedStartDate.split('-').map(Number);
            this.currentWeekStart = new Date(year, month - 1, day);
        } else {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Monday of current week
            this.currentWeekStart = startDate;
        }
        this.editingId = null;


        // Update custom role badge styles
        this.updateRoleBadgeStyles();

        // Initialize role filters (defer saveData until after auth)
        this.filterManager.updateRoleFilters(false);

        // Initialize modal manager
        if (typeof ModalManager === 'undefined') {
            throw new Error('ModalManager class is not available! Check if modalManager.js is loaded properly.');
        }

        try {
        this.modalManager = new ModalManager(this);
        } catch (error) {
            console.error('Error creating ModalManager instance:', error);
            throw error;
        }

        // Initialize UI manager
        if (typeof UIManager === 'undefined') {
            throw new Error('UIManager class is not available! Check if uiManager.js is loaded properly.');
        }

        try {
            this.uiManager = new UIManager(this);
        } catch (error) {
            console.error('Error creating UIManager instance:', error);
            throw error;
        }

        // Initialize Import manager
        if (typeof ImportManager === 'undefined') {
            throw new Error('ImportManager class is not available! Check if importManager.js is loaded properly.');
        }

        try {
            this.importManager = new ImportManager(this);
        } catch (error) {
            console.error('Error creating ImportManager instance:', error);
            throw error;
        }

        // Initialize Employee manager
        if (typeof EmployeeManager === 'undefined') {
            throw new Error('EmployeeManager class is not available! Check if EmployeeManager.js is loaded properly.');
        }

        try {
            this.employeeManager = new EmployeeManager(this);
        } catch (error) {
            console.error('Error creating EmployeeManager instance:', error);
            throw error;
        }

        // Initialize Calendar Renderer
        if (typeof CalendarRenderer === 'undefined') {
            throw new Error('CalendarRenderer class is not available! Check if calendarRenderer.js is loaded properly.');
        }

        try {
            this.calendarRenderer = new CalendarRenderer(this);
        } catch (error) {
            console.error('Error creating CalendarRenderer instance:', error);
            throw error;
        }

        // Initialize View Renderer
        if (typeof ViewRenderer === 'undefined') {
            throw new Error('ViewRenderer class is not available! Check if viewRenderer.js is loaded properly.');
        }

        try {
            this.viewRenderer = new ViewRenderer(this);
        } catch (error) {
            console.error('Error creating ViewRenderer instance:', error);
            throw error;
        }

        // Firebase will be initialized after user authentication

        // Initialize event listeners AFTER uiManager is set
        this.initializeEventListeners();

        // Initialize Snapshot manager
        if (typeof SnapshotManager !== 'undefined') {
            this.snapshotManager = new SnapshotManager(this);
            this.updateSnapshotUI && this.updateSnapshotUI();
        }

        // Initialize Data Consistency Manager
        if (typeof DataConsistencyManager !== 'undefined') {
            this.dataConsistencyManager = new DataConsistencyManager(this);
            this.dataConsistencyManager.startSyncMonitoring();
        }

        // Initialize Data Consistency Tests
        if (typeof DataConsistencyTests !== 'undefined') {
            this.dataConsistencyTests = new DataConsistencyTests(this);
        }

        // Initialize Safe Data Consistency Tests
        if (typeof SafeDataConsistencyTests !== 'undefined') {
            this.safeDataConsistencyTests = new SafeDataConsistencyTests(this);
        }

        // Initialize Rule Engine
        if (typeof RuleEngine !== 'undefined') {
            this.ruleEngine = new RuleEngine(this);
            // Note: ruleEngine.initialize() will be called after auth is ready
            console.log('✅ Rule Engine created (will initialize after auth)');
        }

        // Initialize Rule Manager after Rule Engine is ready
        if (typeof RuleManager !== 'undefined' && this.ruleEngine) {
            try {
                this.ruleManager = new RuleManager(this);
                this.ruleManager.initialize(this.ruleEngine);
                
                // Make ruleManager globally accessible for inline onclick handlers
                window.ruleManager = this.ruleManager;
                
            } catch (error) {
                console.error('❌ Error initializing Rule Manager in constructor:', error);
        this.ruleManager = null;
            }
        } else {
            console.warn('⚠️ Cannot initialize Rule Manager - missing dependencies');
            this.ruleManager = null;
        }

        // Initialize Debug Loop Detector (only in development)
        if (typeof DebugLoopDetector !== 'undefined' && window.location.hostname === 'localhost') {
            this.debugLoopDetector = new DebugLoopDetector(this);
            this.debugLoopDetector.enable();
        }

        // Don't render calendar yet - wait for data to be loaded
        // this.switchView('calendar'); // Moved to after data loading

        // Set up modal controls now that modalManager is initialized
        this.modalManager.setupModalControls();

        // Add button handlers
        document.getElementById('addUserBtn').addEventListener('click', () => this.modalManager.openEmployeeModal());
        document.getElementById('addShiftBtn').addEventListener('click', () => this.modalManager.openShiftModal());
        document.getElementById('addRoleBtn').addEventListener('click', () => this.modalManager.openRoleModal());

        // Form handlers
        document.getElementById('employeeForm').addEventListener('submit', async (e) => await this.modalManager.handleEmployeeSubmit(e));
        document.getElementById('shiftForm').addEventListener('submit', async (e) => await this.modalManager.handleShiftSubmit(e));
        document.getElementById('roleForm').addEventListener('submit', async (e) => await this.modalManager.handleRoleSubmit(e));
    }

    // Initialize Firebase and load data
    async initializeFirebase() {
        await this.initializationManager.initializeFirebase();
    }




    // Initialize all event listeners
    initializeEventListeners() {
        // Navigation tabs
        document.getElementById('calendarTab').addEventListener('click', () => this.switchView('calendar'));
        document.getElementById('rulesTab').addEventListener('click', () => {
            // Rule manager should already be initialized in constructor
            if (!this.ruleManager) {
                console.warn('⚠️ Rule manager not initialized, attempting to initialize...');
                if (typeof RuleManager !== 'undefined' && this.ruleEngine) {
                    try {
                this.ruleManager = new RuleManager(this);
                this.ruleManager.initialize(this.ruleEngine);
                window.ruleManager = this.ruleManager;
                    } catch (error) {
                        console.error('❌ Error initializing rule manager on tab click:', error);
                    }
                }
            }
            this.switchView('rules');
        });
        document.getElementById('usersTab').addEventListener('click', () => this.switchView('users'));
        document.getElementById('shiftsTab').addEventListener('click', () => this.switchView('shifts'));
        document.getElementById('rolesTab').addEventListener('click', () => this.switchView('roles'));
        document.getElementById('importTab').addEventListener('click', () => this.switchView('import'));
        document.getElementById('activityTab').addEventListener('click', () => this.switchView('activity'));
        document.getElementById('pmsGuideBtn').addEventListener('click', () => this.showPMSGuide());

        // PMS Guide panel controls
        const togglePmsPanel = document.getElementById('togglePmsPanel');
        const closePmsPanel = document.getElementById('closePmsPanel');
        if (togglePmsPanel) {
            togglePmsPanel.addEventListener('click', () => this.togglePmsPanel());
        }
        if (closePmsPanel) {
            closePmsPanel.addEventListener('click', () => this.closePmsPanel());
        }

        const resetBtn = document.getElementById('resetDataBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => await this.resetAllData());
        }
        // Data dropdown
        const dataMenuBtn = document.getElementById('dataMenuBtn');
        const dataMenu = document.getElementById('dataMenu');
        const dataSave = document.getElementById('dataSave');
        const dataRestore = document.getElementById('dataRestore');
        const dataReset = document.getElementById('dataReset');
        const dataClear = document.getElementById('dataClear');

        if (dataMenuBtn && dataMenu) {
            dataMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const expanded = dataMenuBtn.getAttribute('aria-expanded') === 'true';
                dataMenuBtn.setAttribute('aria-expanded', String(!expanded));
                dataMenu.classList.toggle('show', !expanded);
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!dataMenu.contains(e.target) && e.target !== dataMenuBtn) {
                    dataMenuBtn.setAttribute('aria-expanded', 'false');
                    dataMenu.classList.remove('show');
                }
            });
        }

        if (dataSave) {
            console.log('✅ Found dataSave element, binding click handler');
            dataSave.addEventListener('click', async (event) => {
                console.log('🔄 Save snapshot button clicked', event);
                event.preventDefault();
                event.stopPropagation();
                
                if (!this.snapshotManager) {
                    console.log('🔄 Creating snapshot manager');
                    this.snapshotManager = new SnapshotManager(this);
                }
                try {
                    console.log('🔄 Starting snapshot save...');
                    // Try simple save first to avoid hanging
                    try {
                        this.snapshotManager.saveSnapshotSimple();
                        console.log('✅ Simple snapshot save completed');
                    } catch (simpleError) {
                        console.warn('⚠️ Simple save failed, trying full save:', simpleError);
                        // Ensure compression is disabled to prevent hanging
                        this.snapshotManager.setCompressionEnabled(false);
                        await this.snapshotManager.saveSnapshot();
                        console.log('✅ Full snapshot save completed');
                    }
                    await showAlert('Reference snapshot saved.', 'Snapshot Saved');
                    
                    // Small delay to ensure localStorage is updated
                    setTimeout(() => {
                        console.log('🔄 Updating UI after save');
                        this.updateSnapshotUI && this.updateSnapshotUI();
                    }, 100);
                    
                    if (dataMenu) dataMenu.classList.remove('show');
                } catch (error) {
                    console.error('❌ Error saving snapshot:', error);
                    console.error('❌ Error stack:', error.stack);
                    await showAlert(`Error saving snapshot: ${error.message}. Please try again.`, 'Save Error');
                }
                if (dataMenuBtn) dataMenuBtn.setAttribute('aria-expanded', 'false');
            });
        } else {
            console.error('❌ dataSave element not found!');
        }

        if (dataRestore) {
            dataRestore.addEventListener('click', async () => {
                if (!this.snapshotManager) this.snapshotManager = new SnapshotManager(this);
                
                // Show loading state
                const originalHTML = dataRestore.innerHTML;
                dataRestore.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restoring...';
                dataRestore.disabled = true;
                
                // Show progress message
                console.log('📸 Starting snapshot restore...');
                
                // Show progress modal
                const progressModal = document.createElement('div');
                progressModal.style.cssText = `
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.7); display: flex; align-items: center;
                    justify-content: center; z-index: 10000; color: white;
                `;
                progressModal.innerHTML = `
                    <div style="background: white; color: black; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="margin-bottom: 10px;">📸 Restoring Snapshot...</div>
                        <div style="font-size: 14px; color: #666;">This may take a few seconds</div>
                    </div>
                `;
                document.body.appendChild(progressModal);
                
                try {
                    const ok = await this.snapshotManager.restoreSnapshot();
                    if (!ok) {
                        await showAlert('No snapshot found. Save one first.', 'No Snapshot');
                    } else {
                        console.log('✅ Snapshot restore completed successfully');
                        await showAlert('Reference snapshot restored to active schedule.', 'Restore Complete');
                        // Clear the restore flag after user dismisses the alert
                        this.isRestoringSnapshot = false;
                        
                        this.updateSnapshotUI && this.updateSnapshotUI();
                    }
                } catch (error) {
                    console.error('❌ Error restoring snapshot:', error);
                    await showAlert('Error restoring snapshot. Please try again.', 'Restore Error');
                    // Clear the restore flag after user dismisses the alert
                    this.isRestoringSnapshot = false;
                } finally {
                    // Remove progress modal
                    if (progressModal && progressModal.parentNode) {
                        progressModal.parentNode.removeChild(progressModal);
                    }
                    
                    // Restore button state
                    dataRestore.innerHTML = originalHTML;
                    dataRestore.disabled = false;
                    if (dataMenu) dataMenu.classList.remove('show');
                    if (dataMenuBtn) dataMenuBtn.setAttribute('aria-expanded', 'false');
                }
            });
        }

        if (dataReset) {
            dataReset.addEventListener('click', async () => {
                await this.resetAllData();
                if (dataMenu) dataMenu.classList.remove('show');
                if (dataMenuBtn) dataMenuBtn.setAttribute('aria-expanded', 'false');
            });
        }

        // Snapshot badge click handler for filtering
        const snapshotBadge = document.getElementById('snapshotBadge');
        if (snapshotBadge) {
            snapshotBadge.addEventListener('click', () => {
                if (this.snapshotManager && this.snapshotManager.hasSnapshot()) {
                    this.snapshotManager.toggleFiltering();
                }
            });
            
            // Restore hover tooltip functionality
            snapshotBadge.addEventListener('mouseenter', () => {
                if (this.snapshotManager && this.snapshotManager.hasSnapshot()) {
                    // Use cached snapshot for tooltip to avoid repeated loading
                    const snap = this.snapshotManager.cache.has(this.snapshotManager.snapshotKey) ? 
                        this.snapshotManager.cache.get(this.snapshotManager.snapshotKey) : 
                        this.snapshotManager.loadSnapshotSync();
                    if (snap && snap.createdAt) {
                        const date = new Date(snap.createdAt);
                        const formatted = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                        const filteringText = this.snapshotManager.isFiltering ? 
                            '\n\nCurrently filtering - click to show all' : 
                            '\n\nClick to filter and show only changed shifts';
                        snapshotBadge.title = `Snapshot saved: ${formatted}\nEmployees: ${snap.employees.length}\nShift Types: ${snap.shiftTypes.length}\nShifts: ${snap.schedules.length}${filteringText}`;
                    }
                }
            });
        }

        if (dataClear) {
            dataClear.addEventListener('click', async () => {
                await this.clearCalendarOnly();
                if (dataMenu) dataMenu.classList.remove('show');
                if (dataMenuBtn) dataMenuBtn.setAttribute('aria-expanded', 'false');
            });
        }

        // Data consistency test button
        const dataConsistencyTest = document.getElementById('dataConsistencyTest');
        if (dataConsistencyTest) {
            dataConsistencyTest.addEventListener('click', async () => {
                await this.testManager.runDataConsistencyTests();
                if (dataMenu) dataMenu.classList.remove('show');
                if (dataMenuBtn) dataMenuBtn.setAttribute('aria-expanded', 'false');
            });
        }

        // Safe data consistency test button (recommended)
        const safeDataConsistencyTest = document.getElementById('safeDataConsistencyTest');
        if (safeDataConsistencyTest) {
            safeDataConsistencyTest.addEventListener('click', async () => {
                await this.testManager.runSafeDataConsistencyTests();
                if (dataMenu) dataMenu.classList.remove('show');
                if (dataMenuBtn) dataMenuBtn.setAttribute('aria-expanded', 'false');
            });
        }

        // Sort dropdown
        const sortMenuBtn = document.getElementById('sortMenuBtn');
        const sortMenu = document.getElementById('sortMenu');
        const sortMenuLabel = document.getElementById('sortMenuLabel');
        if (sortMenuBtn && sortMenu) {
            const closeSortMenu = () => {
                sortMenu.classList.remove('show');
                sortMenuBtn.setAttribute('aria-expanded', 'false');
            };

            sortMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const expanded = sortMenuBtn.getAttribute('aria-expanded') === 'true';
                sortMenuBtn.setAttribute('aria-expanded', String(!expanded));
                sortMenu.classList.toggle('show', !expanded);
            });

            document.addEventListener('click', (e) => {
                if (!sortMenu.contains(e.target) && e.target !== sortMenuBtn) {
                    closeSortMenu();
                }
            });

            // Bind sort options
            sortMenu.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const sortValue = item.getAttribute('data-sort');
                    if (sortValue) {
                        this.filterManager.setSortOrder(sortValue);
                        // Update label text to match selected item
                        const text = item.textContent.trim();
                        if (sortMenuLabel) sortMenuLabel.textContent = text.replace(/^.*?\s/, '') || text; // keep label concise
                        closeSortMenu();
                    }
                });
            });

            // Initialize label from saved sort order
            const initialSort = this.filterManager.sortOrder || 'original';
            const initialItem = sortMenu.querySelector(`.dropdown-item[data-sort="${initialSort}"]`);
            if (initialItem && sortMenuLabel) {
                sortMenuLabel.textContent = initialItem.textContent.trim().replace(/^.*?\s/, '') || initialItem.textContent.trim();
            }
        }
        document.getElementById('scheduleForm').addEventListener('submit', (e) => this.handleScheduleSubmit(e));

        // File import handlers (will be bound after DOM is ready)
        this.initializationManager.bindFileHandlers();

        // Bind drag scroll functionality for calendar
        if (!this.uiManager) {
            console.error('UIManager is not initialized!');
            return;
        }
        this.uiManager.bindDragScroll();

        // Bind staffing issues panel controls
        this.uiManager.bindStaffingPanelControls();

        // Bind calendar filter controls
        this.uiManager.bindCalendarFilters();

        // Bind column toggle controls
        this.filterManager.bindColumnToggles();

        // Bind shift editing functionality
        this.uiManager.bindShiftEditing();
    }

    // Update snapshot status UI and toggle restore button
    updateSnapshotUI() {
        console.log('🔄 updateSnapshotUI called');
        const badgeEl = document.getElementById('snapshotBadge');
        const restoreBtn = document.getElementById('restoreSnapshotBtn');
        const dataRestore = document.getElementById('dataRestore');

        console.log('🔄 UI elements found:', {
            badgeEl: !!badgeEl,
            restoreBtn: !!restoreBtn,
            dataRestore: !!dataRestore
        });

        if (!this.snapshotManager && typeof SnapshotManager !== 'undefined') {
            this.snapshotManager = new SnapshotManager(this);
            console.log('🔄 Created new snapshot manager');
        }
        
        // Use cached snapshot if available to avoid repeated loading
        const snap = this.snapshotManager ? 
            (this.snapshotManager.cache.has(this.snapshotManager.snapshotKey) ? 
                this.snapshotManager.cache.get(this.snapshotManager.snapshotKey) : 
                this.snapshotManager.loadSnapshotSync()) : null;
        console.log('🔄 Snapshot loaded:', {
            exists: !!snap,
            hasCreatedAt: !!snap?.createdAt,
            dataCounts: snap ? {
                employees: snap.employees?.length || 0,
                shiftTypes: snap.shiftTypes?.length || 0,
                schedules: snap.schedules?.length || 0
            } : null
        });

        if (snap && snap.createdAt) {
            const date = new Date(snap.createdAt);
            const formatted = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            
            // Update badge
            if (badgeEl) {
                badgeEl.classList.add('has-snapshot');
                badgeEl.title = `Snapshot saved: ${formatted}\nEmployees: ${snap.employees.length}\nShift Types: ${snap.shiftTypes.length}\nShifts: ${snap.schedules.length}\n\nClick to filter and show only changed shifts`;
                console.log('✅ Badge updated with snapshot info');
            }
            
            // Enable restore buttons
            if (restoreBtn) {
                restoreBtn.disabled = false;
                restoreBtn.classList.add('active');
                console.log('✅ Restore button enabled');
            }
            if (dataRestore) {
                dataRestore.disabled = false;
                console.log('✅ Data restore button enabled');
            }
        } else {
            // Update badge
            if (badgeEl) {
                badgeEl.classList.remove('has-snapshot');
                badgeEl.title = 'No snapshot saved';
                console.log('❌ Badge updated - no snapshot');
            }
            
            // Disable restore buttons
            if (restoreBtn) {
                restoreBtn.disabled = true;
                restoreBtn.classList.remove('active');
                console.log('❌ Restore button disabled');
            }
            if (dataRestore) {
                dataRestore.disabled = true;
                console.log('❌ Data restore button disabled');
            }
        }
    }



    /**
     * Switch between different application views
     * @param {string} view - The view to switch to ('calendar', 'balance', 'users', 'shifts', 'roles', 'import')
     */
    switchView(view) {
        console.log('🔄 switchView called with view:', view, {
            user: this.authManager?.user?.email,
            isAdmin: this.authManager?.adminEmails?.has(this.authManager?.user?.email?.toLowerCase())
        });
        
        // Remove active class from all nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

        // Add active class to selected nav tab
        const selectedTab = document.getElementById(`${view}Tab`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }

        // Handle calendar view - CSS in HTML handles visibility through active class on container
        const calendarView = document.getElementById('calendarView');
        const staffingPanel = document.getElementById('staffingIssuesPanel');
        if (view === 'calendar') {
            // Show calendar view by adding active class to container
            if (calendarView) {
                calendarView.classList.add('active');
            }
            // Show staffing panel when on calendar view (but only if it hasn't been manually closed)
            if (staffingPanel && staffingPanel.style.display !== 'none') {
                staffingPanel.style.display = 'block';
            }
        } else {
            // Hide calendar view by removing active class from container
            if (calendarView) {
                calendarView.classList.remove('active');
            }
            // Keep staffing panel visible when not on calendar view (it can be positioned anywhere)
            // Don't hide it automatically - let user control its visibility
        }

        // Handle other views normally
        document.querySelectorAll('.view:not(#calendarView)').forEach(v => v.classList.remove('active'));

        // Add active class to selected view (if not calendar)
        if (view !== 'calendar') {
            const selectedView = document.getElementById(`${view}View`);
            if (selectedView) {
                selectedView.classList.add('active');
            }
        }

        this.renderCurrentView();
    }

    // Render the current view
    renderCurrentView() {
        const renderStartTime = performance.now();
        const activeTab = document.querySelector('.nav-tab.active');
        const view = activeTab ? activeTab.id.replace('Tab', '') : 'unknown';

        console.log('🎨 renderCurrentView called', {
            view: view,
            user: this.authManager?.user?.email,
            isAdmin: this.authManager?.adminEmails?.has(this.authManager?.user?.email?.toLowerCase()),
            activeTab: activeTab?.id
        });

        switch (view) {
            case 'calendar':
                // Ensure role badge styles are up to date before rendering calendar
                this.updateRoleBadgeStyles();
                this.calendarRenderer.renderScheduleMatrix(); 
                const calendarTime = performance.now() - renderStartTime;
                console.log(`📅 Calendar rendered in ${calendarTime.toFixed(2)}ms`);
                break;
            case 'rules': this.renderRulesView(); break;
            case 'users': this.employeeManager.renderUsersView(); break;
            case 'shifts': this.viewRenderer.renderShiftsView(); break;
            case 'roles': this.viewRenderer.renderRolesView(); break;
            case 'import': this.importManager.renderImportView(); break;
            case 'activity': this.activityManager.renderActivityView(); break;
        }
        
        const totalRenderTime = performance.now() - renderStartTime;
        console.log(`🎨 View '${view}' rendered in ${totalRenderTime.toFixed(2)}ms`);
    }

    // Toggle PMS Guide panel
    showPMSGuide() {
        const panel = document.getElementById('pmsGuidePanel');
        if (panel) {
            if (panel.style.display === 'none') {
                panel.style.display = 'block';
                panel.classList.remove('collapsed');
                this.initializePmsPanelDrag();
            } else {
                panel.style.display = 'none';
            }
        }
    }

    // Toggle PMS panel collapsed state
    togglePmsPanel() {
        const panel = document.getElementById('pmsGuidePanel');
        if (panel) {
            panel.classList.toggle('collapsed');
            const toggleBtn = document.getElementById('togglePmsPanel');
            if (toggleBtn) {
                const icon = toggleBtn.querySelector('i');
                if (icon) {
                    icon.className = panel.classList.contains('collapsed') ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
                }
            }
        }
    }

    // Close PMS panel
    closePmsPanel() {
        const panel = document.getElementById('pmsGuidePanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    // Initialize drag functionality for PMS panel
    initializePmsPanelDrag() {
        const panel = document.getElementById('pmsGuidePanel');
        const header = panel?.querySelector('.panel-header');
        
        if (!panel || !header) return;

        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        const dragStart = (e) => {
            if (e.target.closest('.panel-controls')) return; // Don't drag when clicking controls
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                panel.classList.add('dragging');
            }
        };

        const dragEnd = () => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            panel.classList.remove('dragging');
        };

        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        };

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('mousemove', drag);
    }

    // Reset all data
    async resetAllData() {
        if (await showConfirm('Are you sure you want to reset ALL data? This will delete all employees, shifts, schedules, and job roles.', 'Reset All Data')) {
            try {
                console.log('🧹 Starting complete data reset...');
                
                // Show progress indicator
                const progressDiv = document.createElement('div');
                progressDiv.id = 'resetProgress';
                progressDiv.style.cssText = `
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: #333; color: white; padding: 20px; border-radius: 8px;
                    z-index: 10000; font-family: Arial, sans-serif; text-align: center;
                `;
                progressDiv.innerHTML = `
                    <div style="margin-bottom: 10px;">🧹 Resetting all data...</div>
                    <div style="font-size: 12px; color: #ccc;">This may take a few seconds</div>
                `;
                document.body.appendChild(progressDiv);
                
                // Set flag to prevent real-time listener updates during bulk operation
                this.isResetting = true;

                // Clear Firestore collections if Firebase is available
                if (this.firebaseManager) {
                    console.log('🧹 Clearing Firestore collections in parallel...');
                    // Clear all collections in parallel for maximum speed
                    await Promise.all([
                        this.dataManager.clearCollection('employees'),
                        this.dataManager.clearCollection('shiftTypes'),
                        this.dataManager.clearCollection('jobRoles'),
                        this.dataManager.clearCollection('schedules')
                    ]);
                    console.log('✅ All Firestore collections cleared');
                }

            // Clear all data arrays
            this.employees = [];
            this.shiftTypes = [];
            this.jobRoles = [];
            this.schedules = [];

                // Clear localStorage (fallback)
            localStorage.removeItem('workforce_employees');
            localStorage.removeItem('workforce_shiftTypes');
            localStorage.removeItem('workforce_jobRoles');
            localStorage.removeItem('workforce_schedules');

            // Reset to initial state - Monday of current week
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Monday of current week
            this.currentWeekStart = startDate;

                // Wait a moment for any pending operations to complete
                await new Promise(resolve => setTimeout(resolve, 100));

                // Clear the resetting flag
                this.isResetting = false;

                // Force refresh all views
                console.log('🔄 Refreshing all views...');
            this.renderCurrentView();

                // Force calendar refresh
                if (this.calendarRenderer) {
                    this.calendarRenderer.renderScheduleMatrix();
                }

                // Remove progress indicator
                const progressEl = document.getElementById('resetProgress');
                if (progressEl) progressEl.remove();

                console.log('✅ Reset completed successfully');
            await showAlert('All data has been reset successfully!', 'Reset Complete');
            } catch (error) {
                console.error('❌ Error during reset:', error);
                this.isResetting = false; // Clear flag on error
                
                // Remove progress indicator on error
                const progressEl = document.getElementById('resetProgress');
                if (progressEl) progressEl.remove();
                
                await showAlert('Error occurred during reset. Please try again.', 'Reset Error');
            }
        }
    }

    // Clear only schedules (calendar) while keeping employees, shift types, and job roles
    async clearCalendarOnly() {
        if (await showConfirm('Clear calendar only? This will remove all shift assignments but keep Employees, Shift Types, and Job Roles.', 'Clear Calendar')) {
            try {
                // Set flag to prevent real-time listener updates during bulk operation
                this.isResetting = true;

                // Clear Firestore schedules collection if Firebase is available
                if (this.firebaseManager) {
                    console.log('🧹 Clearing Firestore schedules...');
                    await this.dataManager.clearCollection('schedules');
                    console.log('✅ Firestore schedules cleared');
                }

            // Clear schedules array
            this.schedules = [];

            // Persist only schedules change
            localStorage.removeItem('workforce_schedules');

                // Clear the resetting flag
                this.isResetting = false;

            // Re-render views impacted by schedules
            this.calendarRenderer.renderScheduleMatrix();
            this.viewRenderer.renderBalanceView && this.viewRenderer.renderBalanceView();

            await showAlert('Calendar cleared. All shift assignments have been removed.', 'Calendar Cleared');
            } catch (error) {
                console.error('❌ Error during calendar clear:', error);
                this.isResetting = false; // Clear flag on error
                await showAlert('Error occurred during calendar clear. Please try again.', 'Clear Error');
            }
        }
    }














    async deleteShiftType(shiftTypeId) {
        const shiftType = this.shiftTypes.find(s => s.id === shiftTypeId);
        if (!shiftType) return;

        if (await showConfirm(`Are you sure you want to delete the "${shiftType.name}" shift type? This will affect all associated schedules.`, 'Delete Shift Type')) {
            // Remove shift type
            this.shiftTypes = this.shiftTypes.filter(s => s.id !== shiftTypeId);
            // Remove associated schedules
            this.schedules = this.schedules.filter(s => s.shiftId !== shiftTypeId);

            // Save changes
            this.dataManager.saveData('shiftTypes', this.shiftTypes);
            this.dataManager.saveData('schedules', this.schedules);

            // Refresh views
            this.viewRenderer.renderShiftsView();
            this.calendarRenderer.renderScheduleMatrix();
        }
    }

    // Schedule manipulation methods for UI Manager

    // Assign a shift to an employee for a specific date



    // Add a custom shift type

    // Record a shift change for undo functionality
    recordShiftChange(employeeId, date, oldShiftId, newShiftId) {
        if (!this.changeHistory) {
            this.changeHistory = [];
        }

        const changeRecord = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            employeeId,
            date,
            oldShiftId,
            newShiftId,
            undone: false
        };

        this.changeHistory.push(changeRecord);

        // Keep only last 50 changes
        if (this.changeHistory.length > 50) {
            this.changeHistory = this.changeHistory.slice(-50);
        }

        // Save to localStorage
        this.dataManager.saveData('changeHistory', this.changeHistory);

    }


    // Job Role CRUD functions

    // Update custom role badge styles dynamically
    updateRoleBadgeStyles() {
        updateRoleBadgeStyles(this.jobRoles);
    }



    async deleteJobRole(roleId) {
        const role = this.jobRoles.find(r => r.id === roleId);
        if (!role) return;

        const employeeCount = this.employees.filter(e => e.roleId === roleId).length;

        if (await showConfirm(`Are you sure you want to delete the "${role.name}" role? This will affect ${employeeCount} employees.`, 'Delete Job Role')) {
            // Remove job role
            this.jobRoles = this.jobRoles.filter(r => r.id !== roleId);
            // Update employees to have no role
            this.employees.forEach(employee => {
                if (employee.roleId === roleId) {
                    employee.roleId = null;
                }
            });

            // Save changes
            this.dataManager.saveData('jobRoles', this.jobRoles);
            this.dataManager.saveData('employees', this.employees);

            // Update role filters to remove the deleted role
            this.filterManager.updateRoleFilters();

            // Refresh views
            this.viewRenderer.renderRolesView();
            this.employeeManager.renderUsersView();
            this.calendarRenderer.renderScheduleMatrix();
        }
    }











    /**
     * Individual CRUD operations that work with real-time sync
     */
    async addEmployee(employee) {
        if (this.firebaseManager) {
            const newEmployee = await this.firebaseManager.createEmployee(employee);
            this.employees.push(newEmployee);
            
            // Log activity
            await this.activityManager.ensureActivityLogger();
            if (this.activityManager.activityLogger) {
                await this.activityManager.activityLogger.logActivity(
                    'create_employee',
                    'employee',
                    newEmployee.id,
                    { name: newEmployee.name, role: newEmployee.role }
                );
            }
            
            return newEmployee;
        }
        return null;
    }

    async updateEmployee(id, updates) {
        if (this.firebaseManager) {
            const oldEmployee = this.employees.find(e => e.id === id);
            const updated = await this.firebaseManager.updateEmployee(id, updates);
            const index = this.employees.findIndex(e => e.id === id);
            if (index >= 0) {
                this.employees[index] = { ...this.employees[index], ...updates };
            }
            
            // Create a merged employee object for logging
            const mergedEmployee = { ...oldEmployee, ...updates };
            
            // Log activity
            await this.activityManager.ensureActivityLogger();
            if (this.activityManager.activityLogger) {
                await this.activityManager.activityLogger.logActivity(
                    'update_employee',
                    'employee',
                    id,
                    { 
                        name: mergedEmployee?.name || 'Unknown',
                        role: mergedEmployee?.role || 'Unknown'
                    },
                    { before: oldEmployee, after: mergedEmployee }
                );
            }
            
            return updated;
        }
        return null;
    }

    async deleteEmployee(id) {
        if (this.firebaseManager) {
            const oldEmployee = this.employees.find(e => e.id === id);
            await this.firebaseManager.deleteEmployee(id);
            this.employees = this.employees.filter(e => e.id !== id);
            
            // Log activity
            await this.activityManager.ensureActivityLogger();
            if (this.activityManager.activityLogger) {
                await this.activityManager.activityLogger.logActivity(
                    'delete_employee',
                    'employee',
                    id,
                    { name: oldEmployee?.name || 'Unknown' }
                );
            }
            
            return true;
        }
        return false;
    }

    async addShiftType(shiftType) {
        if (this.firebaseManager) {
            const newShiftType = await this.firebaseManager.createShiftType(shiftType);
            this.shiftTypes.push(newShiftType);
            return newShiftType;
        }
        return null;
    }

    async updateShiftType(id, updates) {
        if (this.firebaseManager) {
            const updated = await this.firebaseManager.updateShiftType(id, updates);
            const index = this.shiftTypes.findIndex(st => st.id === id);
            if (index >= 0) {
                this.shiftTypes[index] = { ...this.shiftTypes[index], ...updates };
            }
            return updated;
        }
        return null;
    }

    async deleteShiftType(id) {
        if (this.firebaseManager) {
            await this.firebaseManager.deleteShiftType(id);
            this.shiftTypes = this.shiftTypes.filter(st => st.id !== id);
            return true;
        }
        return false;
    }

    async addJobRole(role) {
        if (this.firebaseManager) {
            const newRole = await this.firebaseManager.createJobRole(role);
            this.jobRoles.push(newRole);
            return newRole;
        }
        return null;
    }

    async updateJobRole(id, updates) {
        if (this.firebaseManager) {
            const updated = await this.firebaseManager.updateJobRole(id, updates);
            const index = this.jobRoles.findIndex(r => r.id === id);
            if (index >= 0) {
                this.jobRoles[index] = { ...this.jobRoles[index], ...updates };
            }
            return updated;
        }
        return null;
    }

    async deleteJobRole(id) {
        if (this.firebaseManager) {
            await this.firebaseManager.deleteJobRole(id);
            this.jobRoles = this.jobRoles.filter(r => r.id !== id);
            return true;
        }
        return false;
    }

    async addSchedule(schedule) {
        if (this.firebaseManager) {
            const newSchedule = await this.firebaseManager.createSchedule(schedule);
            this.schedules.push(newSchedule);
            return newSchedule;
        }
        return null;
    }

    async updateSchedule(id, updates) {
        if (this.firebaseManager) {
            const updated = await this.firebaseManager.updateSchedule(id, updates);
            const index = this.schedules.findIndex(s => s.id === id);
            if (index >= 0) {
                this.schedules[index] = { ...this.schedules[index], ...updates };
            }
            return updated;
        }
        return null;
    }

    async deleteSchedule(id) {
        if (this.firebaseManager) {
            await this.firebaseManager.deleteSchedule(id);
            this.schedules = this.schedules.filter(s => s.id !== id);
            return true;
        }
        return false;
    }





    /**
     * Render the rules management view
     */
    renderRulesView() {
        console.log('🔧 Rendering rules view...');
        
        if (!this.ruleManager) {
            console.warn('⚠️ Rule manager not available, initializing...');
            // Try to initialize rule manager if it's not available
            if (typeof RuleManager !== 'undefined' && this.ruleEngine) {
                this.ruleManager = new RuleManager(this);
                this.ruleManager.initialize(this.ruleEngine);
                
                // Make ruleManager globally accessible for inline onclick handlers
                window.ruleManager = this.ruleManager;
                
                console.log('✅ Rule manager initialized on demand');
            } else {
                console.error('❌ Cannot initialize rule manager - dependencies not available');
                console.log('RuleManager available:', typeof RuleManager !== 'undefined');
                console.log('Rule Engine available:', !!this.ruleEngine);
                return;
            }
        }

        // Render the rules list
        this.renderRulesList();
        
        console.log('✅ Rules view rendered');
    }


    /**
     * Render the rules list
     */
    renderRulesList() {
        const rulesList = document.getElementById('rulesList');
        if (!rulesList || !this.ruleEngine) return;

        const rules = this.ruleEngine.getRules();
        
        if (rules.length === 0) {
            rulesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-cogs"></i>
                    <h3>No Rules Created</h3>
                    <p>Create your first staffing rule to get started.</p>
                    <button class="btn btn-primary" onclick="window.ruleManager.showRuleBuilderModal()">
                        <i class="fas fa-plus"></i> Create First Rule
                    </button>
                </div>
            `;
            return;
        }

        // Render rules using the rule manager's method
        this.ruleManager.renderRuleList();
    }



    /**
     * Create a snapshot for testing dashed lines
     */
    async createTestSnapshot() {
        if (this.snapshotManager) {
            try {
                await this.snapshotManager.saveSnapshot();
                console.log('📸 Test snapshot created');
            } catch (error) {
                console.error('❌ Error creating test snapshot:', error);
            }
        } else {
            console.log('📸 Snapshot manager not available');
        }
    }

    /**
     * Auto-create snapshot if none exists
     */
    async autoCreateSnapshot() {
        if (this.snapshotManager && !this.snapshotManager.hasSnapshot()) {
            console.log('📸 No snapshot found, creating initial snapshot...');
            try {
                await this.snapshotManager.saveSnapshot();
                console.log('📸 Initial snapshot created successfully');
            } catch (error) {
                console.error('❌ Error creating initial snapshot:', error);
            }
        }
    }
}

// Initialize the application when DOM is loaded
let workforceManager;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    
    // Wait a bit for Firebase to initialize
    setTimeout(() => {
        try {
            console.log('🔐 Creating AuthManager...');
            window.authManager = new AuthManager();
        } catch (e) {
            console.warn('Auth not available, starting app without auth:', e.message);
            workforceManager = new WorkforceScheduleManager();
            window.workforceManager = workforceManager;
            setTimeout(() => {
                workforceManager.bindFileHandlers();
            }, 100);
        }
        
        // Add debug function to window for manual flag reset
        window.resetSnapshotFlag = () => {
            if (window.workforceManager) {
                window.workforceManager.isRestoringSnapshot = false;
                console.log('✅ isRestoringSnapshot flag reset to false');
            } else {
                console.log('❌ workforceManager not available');
            }
        };
        
        // Auto-reset flag if it's stuck
        if (window.workforceManager && window.workforceManager.isRestoringSnapshot) {
            console.log('⚠️ Auto-resetting stuck isRestoringSnapshot flag');
            window.workforceManager.isRestoringSnapshot = false;
        }

        // Rule Manager will be initialized after WorkforceScheduleManager is created
        // This is handled in the WorkforceScheduleManager constructor and AuthManager
    }, 100);
});
