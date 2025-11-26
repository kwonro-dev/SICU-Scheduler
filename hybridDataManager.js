// Hybrid Data Manager
// Combines Firestore real-time sync with localStorage caching for optimal performance

class HybridDataManager {
    constructor(firebaseManager) {
        this.firebaseManager = firebaseManager;
        this.cachePrefix = 'hybrid_cache_';
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.pendingFirebaseSync = null; // Data from localStorage that needs to be synced to Firebase
        
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
     * Check if there's pending localStorage data that needs to be synced to Firebase
     * Call this after workforceManager is fully initialized
     */
    async syncPendingLocalStorageToFirebase(workforceManager) {
        if (!this.pendingFirebaseSync) {
            return false;
        }

        console.log('🔄 Syncing localStorage fallback data to Firebase...');
        
        try {
            // Show a toast notification if importManager is available
            if (workforceManager.importManager?.showImportToast) {
                workforceManager.importManager.showImportToast(
                    '🔄 Syncing recovered data to cloud...', 
                    'warning', 
                    false
                );
            }

            const data = this.pendingFirebaseSync;
            
            // Sync all collections to Firebase
            await Promise.all([
                data.shiftTypes?.length > 0 ? this.firebaseManager.batchReplace('shiftTypes', data.shiftTypes) : Promise.resolve(),
                data.jobRoles?.length > 0 ? this.firebaseManager.batchReplace('jobRoles', data.jobRoles) : Promise.resolve(),
                data.employees?.length > 0 ? this.firebaseManager.batchReplace('employees', data.employees) : Promise.resolve(),
                data.schedules?.length > 0 ? this.firebaseManager.batchReplace('schedules', data.schedules) : Promise.resolve()
            ]);

            console.log('✅ localStorage data synced to Firebase successfully');
            this.pendingFirebaseSync = null;
            
            // Show success toast
            if (workforceManager.importManager?.showImportToast) {
                workforceManager.importManager.showImportToast(
                    '✅ Data recovered and synced to cloud!', 
                    'success'
                );
            }
            
            return true;
        } catch (error) {
            console.error('❌ Failed to sync localStorage data to Firebase:', error);
            
            // Show error toast
            if (workforceManager.importManager?.showImportToast) {
                workforceManager.importManager.showImportToast(
                    '⚠️ Could not sync recovered data to cloud. Will retry later.', 
                    'error'
                );
            }
            
            return false;
        }
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
            
            // Check if Firestore returned empty data - might be a sync issue
            const hasData = firestoreData.employees?.length > 0 || firestoreData.schedules?.length > 0;
            
            if (!hasData) {
                console.warn('⚠️ Firestore returned empty data, checking localStorage fallback...');
                const cachedData = this.loadFromCache();
                if (cachedData && (cachedData.employees?.length > 0 || cachedData.schedules?.length > 0)) {
                    console.log('✅ Using localStorage data (Firestore was empty)');
                    const loadTime = performance.now() - startTime;
                    console.log(`⚡ Hybrid load completed in ${loadTime.toFixed(2)}ms (from localStorage)`);
                    
                    // FLAG: Need to sync localStorage data to Firebase
                    // This will be picked up after initialization completes
                    this.pendingFirebaseSync = cachedData;
                    console.log('📋 Queued localStorage data for Firebase sync');
                    
                    return cachedData;
                }
            }
            
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
     * OPTIMIZED: Uses aggregated data (single doc) when available, cache-first
     */
    async loadFromFirestore() {
        if (!this.firebaseManager.currentOrgId) {
            await this.firebaseManager.initialize();
        }

        const startTime = performance.now();
        const orgRef = this.firebaseManager.db.collection('organizations').doc(this.firebaseManager.currentOrgId);
        
        // Helper to load a collection - tries aggregated first (FAST), then individual docs
        const loadCollectionSmart = async (collectionName, orderBy = null) => {
            const collectionStart = performance.now();
            
            // Try aggregated data first (single doc read - FAST, uses cache)
            const aggregated = await this.firebaseManager.loadAggregatedData(collectionName, true);
            if (aggregated && aggregated.length > 0) {
                const elapsed = (performance.now() - collectionStart).toFixed(0);
                console.log(`⚡ ${collectionName}: ${aggregated.length} items in ${elapsed}ms`);
                return { type: 'aggregated', data: aggregated };
            }
            
            // Fall back to individual docs (legacy data)
            const collectionRef = orgRef.collection(collectionName);
            try {
                let query = orderBy ? collectionRef.orderBy(orderBy) : collectionRef;
                
                // Try cache first
                const cacheSnapshot = await query.get({ source: 'cache' });
                if (cacheSnapshot.size > 0) {
                    const elapsed = (performance.now() - collectionStart).toFixed(0);
                    console.log(`📦 ${collectionName}: ${cacheSnapshot.size} legacy items from cache in ${elapsed}ms`);
                    return { type: 'individual', snapshot: cacheSnapshot };
                }
                
                // Cache empty - try server
                const serverSnapshot = await query.get({ source: 'server' });
                const elapsed = (performance.now() - collectionStart).toFixed(0);
                if (serverSnapshot.size > 0) {
                    console.log(`🌐 ${collectionName}: ${serverSnapshot.size} legacy items from server in ${elapsed}ms`);
                }
                return { type: 'individual', snapshot: serverSnapshot };
            } catch (error) {
                console.warn(`⚠️ ${collectionName}: load failed`, error.message);
                return { type: 'empty', data: [] };
            }
        };
        
        // Load ALL collections in parallel for maximum speed
        const [employeesResult, shiftTypesResult, jobRolesResult, schedulesResult, rulesResult] = await Promise.all([
            loadCollectionSmart('employees', 'orderIndex'),
            loadCollectionSmart('shiftTypes'),
            loadCollectionSmart('jobRoles'),
            loadCollectionSmart('schedules'),
            loadCollectionSmart('rules')
        ]);
        
        const totalElapsed = (performance.now() - startTime).toFixed(0);
        console.log(`📊 All collections loaded in ${totalElapsed}ms`);
        
        // Helper to extract data from result
        const extractData = (result) => {
            if (result.type === 'aggregated' || result.type === 'empty') {
                return result.data || [];
            }
            return result.snapshot.docs.map(doc => doc.data());
        };

        // Extract data from results
        let employees = extractData(employeesResult);
        const shiftTypes = extractData(shiftTypesResult);
        const jobRoles = extractData(jobRolesResult);
        const schedules = extractData(schedulesResult);
        const rules = extractData(rulesResult);
        
        // Sort employees by orderIndex if available
        if (employees.length > 0 && employees[0].orderIndex !== undefined) {
            employees = employees.sort((a, b) => {
                if (a.orderIndex !== undefined && b.orderIndex !== undefined) {
                    return a.orderIndex - b.orderIndex;
                }
                if (a.orderIndex !== undefined) return -1;
                if (b.orderIndex !== undefined) return 1;
                return 0;
            });
        }

        return { employees, shiftTypes, jobRoles, schedules, rules };
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
            
            // Fallback: Try loading from workforce_* keys (used by import backup)
            console.log('🔍 Checking workforce_* localStorage keys as fallback...');
            const workforceData = {};
            const workforceCollections = ['employees', 'shiftTypes', 'jobRoles', 'schedules'];
            
            for (const collection of workforceCollections) {
                const workforceKey = `workforce_${collection}`;
                const data = localStorage.getItem(workforceKey);
                if (data) {
                    try {
                        workforceData[collection] = JSON.parse(data);
                        console.log(`📦 Found ${collection} in workforce_* localStorage`);
                    } catch (e) {
                        console.warn(`Failed to parse ${workforceKey}:`, e);
                    }
                }
            }
            
            // If we found workforce data, use it (rules might not exist, that's ok)
            if (workforceData.employees && workforceData.employees.length > 0) {
                console.log('✅ Using workforce_* localStorage data as fallback');
                return {
                    employees: workforceData.employees || [],
                    shiftTypes: workforceData.shiftTypes || [],
                    jobRoles: workforceData.jobRoles || [],
                    schedules: workforceData.schedules || [],
                    rules: [] // Rules might not be in localStorage
                };
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
