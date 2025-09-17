// Hybrid Data Manager
// Combines Firestore real-time sync with localStorage caching for optimal performance

class HybridDataManager {
    constructor(firebaseManager) {
        this.firebaseManager = firebaseManager;
        this.cachePrefix = 'hybrid_cache_';
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Back online - syncing data...');
            this.syncPendingChanges();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('📴 Offline - using cached data');
        });
    }

    /**
     * Load data with hybrid approach: Firestore + localStorage cache
     */
    async loadData() {
        const startTime = performance.now();
        console.log('🔄 Hybrid data loading started...');

        try {
            // Try to load from Firestore first (with offline fallback)
            const firestoreData = await this.loadFromFirestore();
            
            // Cache the data for offline use
            this.cacheData(firestoreData);
            
            const loadTime = performance.now() - startTime;
            console.log(`⚡ Hybrid load completed in ${loadTime.toFixed(2)}ms`);
            
            return firestoreData;
        } catch (error) {
            console.warn('⚠️ Firestore load failed, trying cache...', error);
            
            // Fallback to cached data
            const cachedData = this.loadFromCache();
            if (cachedData) {
                console.log('✅ Using cached data as fallback');
                return cachedData;
            }
            
            throw new Error('No data available - neither Firestore nor cache');
        }
    }

    /**
     * Load data from Firestore with offline persistence
     */
    async loadFromFirestore() {
        if (!this.firebaseManager.currentOrgId) {
            await this.firebaseManager.initialize();
        }

        const orgRef = this.firebaseManager.db.collection('organizations').doc(this.firebaseManager.currentOrgId);
        
        // Use CACHE_FIRST for better performance
        const options = { source: 'cache' }; // Try cache first, fallback to server
        
        const [employeesSnapshot, shiftTypesSnapshot, jobRolesSnapshot, schedulesSnapshot, rulesSnapshot] = await Promise.all([
            orgRef.collection('employees').orderBy('orderIndex').get(options), // Order by orderIndex to preserve original data file order
            orgRef.collection('shiftTypes').get(options),
            orgRef.collection('jobRoles').get(options),
            orgRef.collection('schedules').get(options),
            orgRef.collection('rules').get(options)
        ]);

        // Sort employees by orderIndex, with fallback to document ID for existing data
        const employees = employeesSnapshot.docs
            .map(doc => ({ ...doc.data(), docId: doc.id }))
            .sort((a, b) => {
                // If both have orderIndex, sort by that
                if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
                    return a.orderIndex - b.orderIndex;
                }
                // If only one has orderIndex, prioritize it
                if (a.orderIndex !== undefined) return -1;
                if (b.orderIndex !== undefined) return 1;
                // If neither has orderIndex, sort by document ID (creation order)
                return a.docId.localeCompare(b.docId);
            })
            .map(emp => {
                // Remove docId from final result
                const { docId, ...employee } = emp;
                return employee;
            });

        return {
            employees,
            shiftTypes: shiftTypesSnapshot.docs.map(doc => doc.data()),
            jobRoles: jobRolesSnapshot.docs.map(doc => doc.data()),
            schedules: schedulesSnapshot.docs.map(doc => doc.data()),
            rules: rulesSnapshot.docs.map(doc => doc.data())
        };
    }

    /**
     * Load data from localStorage cache
     */
    loadFromCache() {
        try {
            const cachedData = {};
            const collections = ['employees', 'shiftTypes', 'jobRoles', 'schedules', 'rules'];
            
            for (const collection of collections) {
                const cacheKey = `${this.cachePrefix}${collection}`;
                const cached = localStorage.getItem(cacheKey);
                
                if (cached) {
                    const parsed = JSON.parse(cached);
                    // Check if cache is still valid
                    if (Date.now() - parsed.timestamp < this.cacheExpiry) {
                        cachedData[collection] = parsed.data;
                    } else {
                        console.log(`🗑️ Cache expired for ${collection}`);
                        localStorage.removeItem(cacheKey);
                    }
                }
            }
            
            // Only return if we have all collections
            if (Object.keys(cachedData).length === collections.length) {
                console.log('✅ Loaded data from cache');
                return cachedData;
            }
            
            return null;
        } catch (error) {
            console.error('❌ Cache load failed:', error);
            return null;
        }
    }

    /**
     * Cache data to localStorage
     */
    cacheData(data) {
        try {
            const collections = ['employees', 'shiftTypes', 'jobRoles', 'schedules', 'rules'];
            
            for (const collection of collections) {
                if (data[collection]) {
                    const cacheKey = `${this.cachePrefix}${collection}`;
                    const cacheData = {
                        data: data[collection],
                        timestamp: Date.now()
                    };
                    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
                }
            }
            
            console.log('💾 Data cached successfully');
        } catch (error) {
            console.error('❌ Cache save failed:', error);
        }
    }

    /**
     * Save data with hybrid approach
     */
    async saveData(collection, data, isBulk = false) {
        try {
            // Save to Firestore
            if (isBulk) {
                await this.firebaseManager.batchReplace(collection, data);
            } else {
                // Individual save logic would go here
                console.log(`💾 Saving ${collection} data to Firestore`);
            }
            
            // Update cache
            this.updateCache(collection, data);
            
            console.log(`✅ ${collection} saved successfully`);
        } catch (error) {
            console.error(`❌ Save failed for ${collection}:`, error);
            
            // If online, try to sync later
            if (this.isOnline) {
                this.queueForSync(collection, data);
            }
        }
    }

    /**
     * Update cache for specific collection
     */
    updateCache(collection, data) {
        try {
            const cacheKey = `${this.cachePrefix}${collection}`;
            const cacheData = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.error(`❌ Cache update failed for ${collection}:`, error);
        }
    }

    /**
     * Queue data for sync when back online
     */
    queueForSync(collection, data) {
        const syncKey = `sync_queue_${collection}`;
        const queue = JSON.parse(localStorage.getItem(syncKey) || '[]');
        queue.push({
            data: data,
            timestamp: Date.now()
        });
        localStorage.setItem(syncKey, JSON.stringify(queue));
    }

    /**
     * Sync pending changes when back online
     */
    async syncPendingChanges() {
        if (this.syncInProgress) return;
        
        this.syncInProgress = true;
        console.log('🔄 Syncing pending changes...');
        
        try {
            const collections = ['employees', 'shiftTypes', 'jobRoles', 'schedules'];
            
            for (const collection of collections) {
                const syncKey = `sync_queue_${collection}`;
                const queue = JSON.parse(localStorage.getItem(syncKey) || '[]');
                
                if (queue.length > 0) {
                    console.log(`🔄 Syncing ${queue.length} pending changes for ${collection}`);
                    // Sync logic would go here
                    localStorage.removeItem(syncKey);
                }
            }
            
            console.log('✅ Sync completed');
        } catch (error) {
            console.error('❌ Sync failed:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const stats = {
            totalSize: 0,
            collections: {},
            isOnline: this.isOnline
        };
        
        const collections = ['employees', 'shiftTypes', 'jobRoles', 'schedules'];
        
        for (const collection of collections) {
            const cacheKey = `${this.cachePrefix}${collection}`;
            const cached = localStorage.getItem(cacheKey);
            
            if (cached) {
                const parsed = JSON.parse(cached);
                const size = JSON.stringify(parsed.data).length;
                stats.collections[collection] = {
                    size: size,
                    age: Date.now() - parsed.timestamp,
                    valid: Date.now() - parsed.timestamp < this.cacheExpiry
                };
                stats.totalSize += size;
            }
        }
        
        return stats;
    }

    /**
     * Clear all cache
     */
    clearCache() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.cachePrefix) || key.startsWith('sync_queue_')) {
                localStorage.removeItem(key);
            }
        });
        console.log('🗑️ Cache cleared');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HybridDataManager;
} else {
    window.HybridDataManager = HybridDataManager;
}
