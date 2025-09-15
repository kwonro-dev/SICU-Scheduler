// Activity Manager Module
// Handles all activity logging and activity view rendering

class ActivityManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.activityLogger = null;
    }

    /**
     * Initialize activity logger after auth is ready
     */
    async initializeActivityLogger() {
        console.log('📝 initializeActivityLogger called');
        console.log('📝 Current activity logger:', this.activityLogger);
        console.log('📝 AuthManager user:', window.authManager?.user);
        console.log('📝 User uid:', window.authManager?.user?.uid);
        console.log('📝 User email:', window.authManager?.user?.email);
        
        if (!this.activityLogger) {
            // Check if user is fully authenticated
            const authManager = window.authManager;
            if (!authManager?.user?.uid || !authManager?.user?.email) {
                console.warn('⚠️ User not fully authenticated, skipping activity logger initialization');
                console.log('🔐 AuthManager in initializeActivityLogger:', authManager);
                return;
            }
            console.log('📝 Initializing activity logger...');
            console.log('📝 AuthManager user:', authManager?.user);
            console.log('📝 AuthManager user email:', authManager?.user?.email);
            console.log('📝 AuthManager user uid:', authManager?.user?.uid);
            console.log('📝 AuthManager state:', authManager);
            
            this.activityLogger = new ActivityLogger(this.workforceManager);
            console.log('📝 Activity logger created:', this.activityLogger);

            // Update user info in the logger (this should happen after authManager is attached)
            console.log('📝 Calling updateUserInfo after creation...');
            this.activityLogger.updateUserInfo();
            
            // Ensure Firebase is initialized before loading activities
            if (!this.workforceManager.firebaseManager.currentOrgId) {
                console.log('📝 Firebase not initialized, initializing...');
                await this.workforceManager.firebaseManager.initialize();
            }
            
            // Load existing activities from Firebase
            console.log('📝 Loading activities on startup...');
            await this.loadActivitiesOnStartup();
            console.log('📝 Activities loaded:', this.activityLogger.activities.length);
            
            // Log app initialization
            this.activityLogger.logActivity(
                'app_initialized',
                'system',
                'app_start',
                { version: '1.0.0', timestamp: new Date().toISOString() }
            );
            
            console.log('📝 Activity logger initialized');
        } else {
            console.log('📝 Activity logger already initialized');
        }
    }

    /**
     * Load activities from Firebase on startup
     */
    async loadActivitiesOnStartup() {
        try {
            console.log('📝 loadActivitiesOnStartup called');
            console.log('📝 Activity logger:', this.activityLogger);
            if (this.activityLogger) {
                await this.activityLogger.loadActivitiesFromFirebase();
                console.log('📝 Activities loaded from Firebase on startup:', this.activityLogger.activities.length);

                // If we loaded the maximum number, clean up older entries from Firebase
                if (this.activityLogger.activities.length >= 1000) {
                    console.log('📝 Maximum activities loaded, cleaning up old entries...');
                    await this.activityLogger.cleanupOldActivities();
                }
            } else {
                console.warn('⚠️ No activity logger available for loading activities');
            }
        } catch (error) {
            console.error('❌ Failed to load activities on startup:', error);
        }
    }

    /**
     * Ensure activity logger is initialized before logging
     */
    async ensureActivityLogger() {
        if (!this.activityLogger) {
            console.log('📝 Ensuring activity logger is initialized...');
            if (window.authManager?.user) {
                await this.initializeActivityLogger();
            } else {
                console.warn('⚠️ Cannot initialize activity logger - no user available');
                // Try to initialize when user becomes available
                setTimeout(() => {
                    if (window.authManager?.user && !this.activityLogger) {
                        console.log('📝 Retrying activity logger initialization...');
                        this.initializeActivityLogger();
                    }
                }, 1000);
            }
        }
    }

    /**
     * Render the activity view
     */
    async renderActivityView() {
        console.log('📝 Rendering activity view...');
        
        const activityStats = document.getElementById('activityStats');
        const activityFeed = document.getElementById('activityFeed');
        
        if (!activityStats || !activityFeed) {
            console.error('❌ Activity view elements not found');
            return;
        }

        // Initialize activity logger if not already done
        if (!this.activityLogger) {
            console.log('📝 Activity logger not found, initializing...');
            
            // Check if user is authenticated before initializing
            // Try to get authManager from window or this object
            const authManager = window.authManager;
            console.log('🔐 Checking authManager in renderActivityView...');
            console.log('🔐 window.authManager:', window.authManager);
            console.log('🔐 final authManager:', authManager);
            if (!authManager?.user?.uid || !authManager?.user?.email) {
                console.warn('⚠️ User not authenticated, cannot initialize activity logger');
                console.log('🔐 AuthManager state:', authManager);
                console.log('🔐 User object:', authManager?.user);
                console.log('🔐 Window authManager:', window.authManager);
                activityFeed.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-user-lock"></i>
                        <h3>Authentication Required</h3>
                        <p>Please log in to view the activity log.</p>
                        <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 10px;">
                            <i class="fas fa-refresh"></i> Refresh Page
                        </button>
                    </div>
                `;
                return;
            }
            
            await this.initializeActivityLogger();
            if (!this.activityLogger) {
                console.error('❌ Failed to initialize activity logger');
                activityFeed.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Activity Logger Not Available</h3>
                        <p>Unable to initialize activity logger. Please refresh the page.</p>
                    </div>
                `;
                return;
            }
        }

        try {
            // Load activities from Firebase if not already loaded
            if (this.activityLogger.activities.length === 0) {
                await this.activityLogger.loadActivitiesFromFirebase();
            }

            // Render statistics
            this.renderActivityStats(activityStats);
            
            // Render activity feed
            this.renderActivityFeed(activityFeed);
            
            // Set up event listeners
            this.setupActivityEventListeners();
            
        } catch (error) {
            console.error('❌ Error rendering activity view:', error);
            activityFeed.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error Loading Activities</h3>
                    <p>Unable to load activity log. Please try again.</p>
                </div>
            `;
        }
    }

    /**
     * Render activity statistics
     */
    renderActivityStats(container) {
        if (!this.activityLogger) {
            container.innerHTML = '<div class="stat-card"><div class="stat-value">0</div><div class="stat-label">Loading...</div></div>';
            return;
        }
        
        const stats = this.activityLogger.getStatistics();
        
        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.totalActivities}</div>
                <div class="stat-label">Total Activities</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Object.keys(stats.activitiesByUser).length}</div>
                <div class="stat-label">Active Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.activitiesByAction.create_employee || 0}</div>
                <div class="stat-label">Employees Created</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.activitiesByAction.assign_shift || 0}</div>
                <div class="stat-label">Shift Assignments</div>
            </div>
        `;
    }

    /**
     * Render activity feed
     */
    renderActivityFeed(container) {
        if (!this.activityLogger) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i> Loading activity log...
                </div>
            `;
            return;
        }
        
        const activities = this.activityLogger.getRecentActivities(50);
        
        if (activities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No Activities Yet</h3>
                    <p>Activity will appear here as you use the application.</p>
                </div>
            `;
            return;
        }

        const activitiesHtml = activities.map(activity => {
            const iconClass = this.getActivityIconClass(activity.action);
            const time = new Date(activity.timestamp).toLocaleString();
            
            return `
                <div class="activity-item">
                    <div class="activity-icon ${iconClass}">
                        <i class="fas ${this.getActivityIcon(activity.action)}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-message">${this.activityLogger.formatActivity(activity)}</div>
                        <div class="activity-meta">
                            <span class="activity-time">${time}</span>
                            <span class="activity-user">${activity.userEmail}</span>
                            <span class="activity-entity">${activity.entityType}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = activitiesHtml;
    }

    /**
     * Get icon class for activity type
     */
    getActivityIconClass(action) {
        if (action.includes('create')) return 'create';
        if (action.includes('update')) return 'update';
        if (action.includes('delete')) return 'delete';
        if (action.includes('assign')) return 'assign';
        if (action.includes('import')) return 'import';
        if (action.includes('export')) return 'export';
        return 'update';
    }

    /**
     * Get icon for activity type
     */
    getActivityIcon(action) {
        if (action.includes('employee')) return 'fa-user';
        if (action.includes('shift')) return 'fa-clock';
        if (action.includes('role')) return 'fa-user-tag';
        if (action.includes('assign')) return 'fa-hand-point-right';
        if (action.includes('import')) return 'fa-file-import';
        if (action.includes('export')) return 'fa-file-export';
        return 'fa-edit';
    }

    /**
     * Set up activity view event listeners
     */
    setupActivityEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshActivityBtn');
        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                if (this.activityLogger) {
                    await this.activityLogger.loadActivitiesFromFirebase();
                    await this.renderActivityView();
                }
            };
        }

        // Filter dropdown
        const filterSelect = document.getElementById('activityFilter');
        if (filterSelect) {
            filterSelect.onchange = () => {
                if (this.activityLogger) {
                    const filter = filterSelect.value;
                    const activities = this.activityLogger.getRecentActivities(50, filter);
                    this.renderFilteredActivities(activities);
                }
            };
        }
    }

    /**
     * Render filtered activities
     */
    renderFilteredActivities(activities) {
        const activityFeed = document.getElementById('activityFeed');
        if (!activityFeed) return;

        if (activities.length === 0) {
            activityFeed.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-filter"></i>
                    <h3>No Matching Activities</h3>
                    <p>No activities match the selected filter.</p>
                </div>
            `;
            return;
        }

        const activitiesHtml = activities.map(activity => {
            const iconClass = this.getActivityIconClass(activity.action);
            const time = new Date(activity.timestamp).toLocaleString();
            
            return `
                <div class="activity-item">
                    <div class="activity-icon ${iconClass}">
                        <i class="fas ${this.getActivityIcon(activity.action)}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-message">${this.activityLogger.formatActivity(activity)}</div>
                        <div class="activity-meta">
                            <span class="activity-time">${time}</span>
                            <span class="activity-user">${activity.userEmail}</span>
                            <span class="activity-entity">${activity.entityType}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        activityFeed.innerHTML = activitiesHtml;
    }
}
