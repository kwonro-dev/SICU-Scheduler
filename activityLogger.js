/**
 * Activity Logger - Simple activity tracking for the schedule manager
 * Tracks user actions and provides basic audit trail functionality
 */
class ActivityLogger {
    constructor(workforceManager) {
        console.log('📝 ActivityLogger constructor called');
        console.log('📝 WorkforceManager:', workforceManager);
        console.log('📝 FirebaseManager:', workforceManager?.firebaseManager);
        console.log('📝 AuthManager:', workforceManager?.authManager || window.authManager);

        this.workforceManager = workforceManager;
        this.firebaseManager = workforceManager.firebaseManager;
        this.authManager = workforceManager.authManager || window.authManager;
        this.activities = [];
        this.maxLocalActivities = 1000; // Keep last 1000 activities in memory

        console.log('📝 ActivityLogger created successfully');
    }

    /**
     * Log a user activity
     * @param {string} action - The action performed (e.g., 'create_employee', 'update_shift')
     * @param {string} entityType - Type of entity affected (e.g., 'employee', 'shift', 'role')
     * @param {string} entityId - ID of the affected entity
     * @param {Object} details - Additional details about the action
     * @param {Object} changes - What changed (before/after values)
     */
    async logActivity(action, entityType, entityId, details = {}, changes = {}) {
        try {
            // Get current user info (in case it changed since logger was created)
            const currentUser = this.getCurrentUser();

            // Debug logging for user info
            if (!currentUser) {
                console.warn('📝 ActivityLogger: No current user found, using "unknown"');
                console.log('📝 this.authManager:', this.authManager);
                console.log('📝 this.authManager?.user:', this.authManager?.user);
                console.log('📝 WorkforceManager authManager:', this.workforceManager.authManager);
            } else {
                console.log('📝 ActivityLogger: User found:', currentUser.email, 'UID:', currentUser.uid);
            }
            
            const activity = {
                id: this.generateId(),
                timestamp: new Date().toISOString(),
                userId: currentUser?.uid || 'unknown',
                userEmail: currentUser?.email || 'unknown',
                action: action,
                entityType: entityType,
                entityId: entityId,
                details: details,
                changes: changes,
                ipAddress: await this.getClientIP() || 'unknown'
            };

            // Add to local array
            this.activities.unshift(activity);
            
            // Keep only the most recent activities in memory
            if (this.activities.length > this.maxLocalActivities) {
                this.activities = this.activities.slice(0, this.maxLocalActivities);
            }

            // Periodically clean up old activities from Firebase (every 50 new activities)
            if (this.activities.length % 50 === 0) {
                console.log('🧹 Periodic cleanup check...');
                setTimeout(() => this.cleanupOldActivities(), 1000); // Run cleanup after a delay
            }

            // Save to Firebase
            await this.saveToFirebase(activity);

            console.log('📝 Activity logged:', activity);
            return activity;
        } catch (error) {
            console.error('❌ Failed to log activity:', error);
            // Don't throw - logging shouldn't break the main functionality
        }
    }

    /**
     * Save activity to Firebase
     * @param {Object} activity - Activity object to save
     */
    async saveToFirebase(activity) {
        try {
            if (!this.firebaseManager.currentOrgId) {
                await this.firebaseManager.initialize();
            }

            const activityRef = this.firebaseManager.db
                .collection('organizations')
                .doc(this.firebaseManager.currentOrgId)
                .collection('activities')
                .doc(activity.id);

            await activityRef.set(activity);
        } catch (error) {
            console.error('❌ Failed to save activity to Firebase:', error);
        }
    }

    /**
     * Get recent activities
     * @param {number} limit - Maximum number of activities to return
     * @param {string} filter - Filter by action type (optional)
     * @returns {Array} Array of recent activities
     */
    getRecentActivities(limit = 50, filter = null) {
        let activities = this.activities;
        
        if (filter) {
            activities = activities.filter(activity => 
                activity.action.includes(filter) || 
                activity.entityType.includes(filter)
            );
        }

        return activities.slice(0, limit);
    }

    /**
     * Get activities for a specific entity
     * @param {string} entityType - Type of entity
     * @param {string} entityId - ID of entity
     * @returns {Array} Array of activities for the entity
     */
    getEntityActivities(entityType, entityId) {
        return this.activities.filter(activity => 
            activity.entityType === entityType && 
            activity.entityId === entityId
        );
    }

    /**
     * Get activities by user
     * @param {string} userId - User ID to filter by
     * @returns {Array} Array of activities by the user
     */
    getUserActivities(userId) {
        return this.activities.filter(activity => activity.userId === userId);
    }

    /**
     * Get activities within a date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Array} Array of activities within the date range
     */
    getActivitiesByDateRange(startDate, endDate) {
        return this.activities.filter(activity => {
            const activityDate = new Date(activity.timestamp);
            return activityDate >= startDate && activityDate <= endDate;
        });
    }

    /**
     * Load activities from Firebase
     * @param {number} limit - Maximum number of activities to load
     */
    async loadActivitiesFromFirebase(limit = 1000) {
        try {
            console.log('📝 Loading activities from Firebase...');
            console.log('📝 FirebaseManager:', this.firebaseManager);
            console.log('📝 Current org ID:', this.firebaseManager?.currentOrgId);
            
            if (!this.firebaseManager) {
                throw new Error('FirebaseManager not available');
            }
            
            if (!this.firebaseManager.currentOrgId) {
                console.log('📝 Initializing Firebase manager...');
                await this.firebaseManager.initialize();
            }

            console.log('📝 Querying activities collection...');
            const activitiesSnapshot = await this.firebaseManager.db
                .collection('organizations')
                .doc(this.firebaseManager.currentOrgId)
                .collection('activities')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            this.activities = activitiesSnapshot.docs.map(doc => doc.data());
            console.log(`📝 Loaded ${this.activities.length} activities from Firebase`);
        } catch (error) {
            console.error('❌ Failed to load activities from Firebase:', error);
            console.error('❌ Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
        }
    }

    /**
     * Get client IP address (simplified)
     * @returns {Promise<string>} Client IP or null
     */
    async getClientIP() {
        try {
            // Simple IP detection - in production you might want to use a service
            return 'local'; // For now, just return 'local'
        } catch (error) {
            return null;
        }
    }

    /**
     * Clean up old activities from Firebase to maintain limit
     * Keeps only the most recent 1000 activities
     */
    async cleanupOldActivities() {
        try {
            console.log('🧹 Cleaning up old activities from Firebase...');

            if (!this.firebaseManager?.currentOrgId) {
                console.warn('⚠️ Firebase not available for cleanup');
                return;
            }

            // Get all activity IDs ordered by timestamp (oldest first)
            const activitiesRef = this.firebaseManager.db
                .collection('organizations')
                .doc(this.firebaseManager.currentOrgId)
                .collection('activities');

            const snapshot = await activitiesRef
                .orderBy('timestamp', 'asc')
                .get();

            if (snapshot.size <= 1000) {
                console.log(`🧹 No cleanup needed. Only ${snapshot.size} activities exist.`);
                return;
            }

            const activitiesToDelete = snapshot.docs.slice(0, snapshot.size - 1000);
            console.log(`🧹 Deleting ${activitiesToDelete.length} old activities...`);

            // Delete old activities in batches
            const batchSize = 500;
            for (let i = 0; i < activitiesToDelete.length; i += batchSize) {
                const batch = this.firebaseManager.db.batch();
                const batchActivities = activitiesToDelete.slice(i, i + batchSize);

                batchActivities.forEach(doc => {
                    batch.delete(doc.ref);
                });

                await batch.commit();
                console.log(`🧹 Deleted batch of ${batchActivities.length} activities`);
            }

            console.log('✅ Activity cleanup completed');
        } catch (error) {
            console.error('❌ Failed to cleanup old activities:', error);
        }
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Update user information when auth state changes
     */
    updateUserInfo() {
        // This method can be called when auth state changes
        // to ensure future activities have correct user info
        console.log('📝 ActivityLogger: Updating user info...');
        console.log('📝 WorkforceManager authManager:', this.workforceManager.authManager);
        console.log('📝 Window authManager:', window.authManager);

        // Update authManager reference if needed
        if (this.workforceManager.authManager && this.workforceManager.authManager !== this.authManager) {
            console.log('📝 Updating authManager reference in activity logger');
            this.authManager = this.workforceManager.authManager;
        } else if (!this.authManager && window.authManager) {
            console.log('📝 Setting authManager from window');
            this.authManager = window.authManager;
        }

        console.log('📝 Current authManager:', this.authManager);
        console.log('📝 Current user:', this.authManager?.user);
    }

    /**
     * Get current user info with fallback
     */
    getCurrentUser() {
        const currentUser = this.authManager?.user;
        if (!currentUser) {
            console.warn('📝 No current user found in activity logger');
            console.log('📝 this.authManager:', this.authManager);
            console.log('📝 this.authManager?.user:', this.authManager?.user);
            return null;
        }
        console.log('📝 Found user in activity logger:', currentUser.email);
        return currentUser;
    }

    /**
     * Format activity for display
     * @param {Object} activity - Activity object
     * @returns {string} Formatted activity string
     */
    formatActivity(activity) {
        const time = new Date(activity.timestamp).toLocaleString();
        const user = activity.userEmail || 'Unknown User';
        
        let message = '';
        switch (activity.action) {
            case 'create_employee':
                message = `${user} created employee "${activity.details.name}"`;
                break;
            case 'update_employee':
                message = `${user} updated employee "${activity.details.name}"`;
                break;
            case 'delete_employee':
                message = `${user} deleted employee "${activity.details.name}"`;
                break;
            case 'create_shift':
                message = `${user} created shift "${activity.details.shiftName}"`;
                break;
            case 'update_shift':
                message = `${user} updated shift "${activity.details.shiftName}"`;
                break;
            case 'delete_shift':
                message = `${user} deleted shift "${activity.details.shiftName}"`;
                break;
            case 'assign_shift':
                message = `${user} assigned shift "${activity.details.shiftName}" to ${activity.details.employeeName} on ${activity.details.date}`;
                break;
            case 'unassign_shift':
                message = `${user} unassigned shift from ${activity.details.employeeName} on ${activity.details.date}`;
                break;
            case 'create_role':
                message = `${user} created role "${activity.details.roleName}"`;
                break;
            case 'update_role':
                message = `${user} updated role "${activity.details.roleName}"`;
                break;
            case 'delete_role':
                message = `${user} deleted role "${activity.details.roleName}"`;
                break;
            case 'import_data':
                message = `${user} imported data (${activity.details.recordCount} records)`;
                break;
            case 'export_data':
                message = `${user} exported data (${activity.details.recordCount} records)`;
                break;
            default:
                message = `${user} performed ${activity.action} on ${activity.entityType}`;
        }

        return `${time}: ${message}`;
    }

    /**
     * Get activity statistics
     * @returns {Object} Activity statistics
     */
    getStatistics() {
        const stats = {
            totalActivities: this.activities.length,
            activitiesByUser: {},
            activitiesByAction: {},
            activitiesByEntity: {},
            recentActivity: this.activities.length > 0 ? this.activities[0].timestamp : null
        };

        this.activities.forEach(activity => {
            // Count by user
            stats.activitiesByUser[activity.userEmail] = (stats.activitiesByUser[activity.userEmail] || 0) + 1;
            
            // Count by action
            stats.activitiesByAction[activity.action] = (stats.activitiesByAction[activity.action] || 0) + 1;
            
            // Count by entity type
            stats.activitiesByEntity[activity.entityType] = (stats.activitiesByEntity[activity.entityType] || 0) + 1;
        });

        return stats;
    }
}

// Export the class
window.ActivityLogger = ActivityLogger;
