/**
 * Firebase Manager - Handles all Firestore database operations
 * Replaces localStorage with real-time database operations
 */
class FirebaseManager {
    constructor(authManager) {
        this.db = window.firebaseDb;
        this.auth = window.firebaseAuth;
        this.authManager = authManager;
        this.currentOrgId = null;
        this.listeners = new Map(); // Track real-time listeners
    }

    /**
     * Initialize with current user and organization
     */
    async initialize() {
        if (!this.authManager.user) {
            throw new Error('User not authenticated');
        }
        
        // For now, create a default organization for the user
        // Later we'll add proper organization management
        this.currentOrgId = await this.getOrCreateDefaultOrganization();
        console.log('FirebaseManager initialized with org:', this.currentOrgId);
    }

    /**
     * Get or create a shared organization for all users
     */
    async getOrCreateDefaultOrganization() {
        const userId = this.authManager.user.uid;
        const userEmail = this.authManager.user.email;

        try {
            // Use a fixed organization ID for the shared organization
            const SHARED_ORG_ID = 'shared-org-sicu-scheduler';
            
            // Try to get the shared organization
            const orgDoc = await this.db.collection('organizations').doc(SHARED_ORG_ID).get();
            
            if (orgDoc.exists) {
                console.log('Found existing shared organization:', SHARED_ORG_ID);
                
                // Update user document to reference this organization
                const userDoc = await this.db.collection('users').doc(userId).get();
                const userData = userDoc.exists ? userDoc.data() : {};
                
                await this.db.collection('users').doc(userId).set({
                    ...userData,
                    defaultOrgId: SHARED_ORG_ID,
                    organizations: [SHARED_ORG_ID]
                }, { merge: true });
                
                // Add user to organization members if not already there
                const orgData = orgDoc.data();
                if (!orgData.members || !orgData.members.includes(userId)) {
                    const members = orgData.members || [];
                    members.push(userId);
                    await this.db.collection('organizations').doc(SHARED_ORG_ID).update({
                        members: members
                    });
                    console.log('✅ Added user to shared organization members:', userId);
                } else {
                    console.log('✅ User already in shared organization members:', userId);
                }
                
                return SHARED_ORG_ID;
            }

            // Shared organization doesn't exist, create it
            console.log('Creating shared organization:', SHARED_ORG_ID);
            await this.db.collection('organizations').doc(SHARED_ORG_ID).set({
                name: 'SICU Schedule Manager - Shared Organization',
                createdAt: new Date().toISOString(),
                createdBy: userId,
                members: [userId],
                settings: {
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    defaultTimeInterval: 48
                }
            });

            // Update user document with default org
            await this.db.collection('users').doc(userId).set({
                defaultOrgId: SHARED_ORG_ID,
                organizations: [SHARED_ORG_ID]
            }, { merge: true });

            console.log('Shared organization created and user updated');
            return SHARED_ORG_ID;
        } catch (error) {
            console.error('Failed to get/create shared organization:', error);
            throw error;
        }
    }

    /**
     * Generic CRUD operations for any collection
     */
    async create(collection, data) {
        if (!this.currentOrgId) await this.initialize();
        
        const docRef = this.db.collection('organizations').doc(this.currentOrgId).collection(collection).doc();
        const docData = {
            ...data,
            id: docRef.id,
            createdAt: new Date().toISOString(),
            createdBy: this.authManager.user.uid,
            updatedAt: new Date().toISOString(),
            updatedBy: this.authManager.user.uid
        };
        
        await docRef.set(docData);
        return docData;
    }

    async read(collection, id = null) {
        if (!this.currentOrgId) await this.initialize();
        
        if (id) {
            const doc = await this.db.collection('organizations').doc(this.currentOrgId).collection(collection).doc(id).get();
            return doc.exists ? doc.data() : null;
        } else {
            const snapshot = await this.db.collection('organizations').doc(this.currentOrgId).collection(collection).get();
            return snapshot.docs.map(doc => doc.data());
        }
    }

    async update(collection, id, data) {
        if (!this.currentOrgId) await this.initialize();
        
        const updateData = {
            ...data,
            updatedAt: new Date().toISOString(),
            updatedBy: this.authManager.user.uid
        };
        
        await this.db.collection('organizations').doc(this.currentOrgId).collection(collection).doc(id).update(updateData);
        return { id, ...updateData };
    }

    async delete(collection, id) {
        if (!this.currentOrgId) await this.initialize();
        
        await this.db.collection('organizations').doc(this.currentOrgId).collection(collection).doc(id).delete();
        return true;
    }

    /**
     * Batch delete multiple items for much better performance
     */
    async batchDelete(collection, items) {
        if (!this.currentOrgId) await this.initialize();
        
        if (!items || items.length === 0) return;

        // Firestore batch operations are limited to 500 operations per batch
        const batchSize = 500;
        const batches = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = this.db.batch();
            const batchItems = items.slice(i, i + batchSize);
            
            batchItems.forEach(item => {
                const docRef = this.db.collection('organizations').doc(this.currentOrgId).collection(collection).doc(item.id);
                batch.delete(docRef);
            });
            
            batches.push(batch.commit());
        }
        
        // Execute all batches in parallel for maximum speed
        await Promise.all(batches);
        console.log(`✅ Batch deleted ${items.length} items from ${collection}`);
    }

    /**
     * Batch replace entire collection - FAST single-document approach for large collections
     * Stores data as aggregated documents to minimize Firestore operations
     */
    async batchReplace(collection, newItems) {
        if (!this.currentOrgId) await this.initialize();
        
        console.log(`🚀 Fast replacing ${collection} with ${newItems.length} items...`);
        const startTime = performance.now();
        
        // For large collections (schedules), use aggregated document storage
        // This turns 1000+ operations into just 1-2 operations!
        if (collection === 'schedules' && newItems.length > 100) {
            await this.saveAggregatedData(collection, newItems);
        } else if (collection === 'employees' || collection === 'shiftTypes' || collection === 'jobRoles') {
            // For smaller collections, use aggregated storage too for speed
            await this.saveAggregatedData(collection, newItems);
        } else {
            // Fallback to individual docs for small collections
            await this.batchReplaceIndividual(collection, newItems);
        }
        
        const elapsed = performance.now() - startTime;
        console.log(`✅ ${collection} replaced in ${elapsed.toFixed(0)}ms`);
    }

    /**
     * Save data as aggregated documents (FAST - single write operation)
     * Stores array of items in chunks to stay under Firestore 1MB doc limit
     */
    async saveAggregatedData(collection, items) {
        const orgRef = this.db.collection('organizations').doc(this.currentOrgId);
        const aggregateRef = orgRef.collection('aggregated').doc(collection);
        
        // Firestore doc limit is 1MB. Each schedule is ~200 bytes, so ~4000 per doc is safe
        // For safety, chunk at 3000 items per document
        const CHUNK_SIZE = 3000;
        
        if (items.length <= CHUNK_SIZE) {
            // Single document - fastest case
            await aggregateRef.set({
                items: items,
                count: items.length,
                updatedAt: new Date().toISOString(),
                chunked: false
            });
            console.log(`📦 Saved ${items.length} ${collection} in single aggregated doc`);
        } else {
            // Multiple chunks needed
            const chunks = [];
            for (let i = 0; i < items.length; i += CHUNK_SIZE) {
                chunks.push(items.slice(i, i + CHUNK_SIZE));
            }
            
            // Write all chunks in parallel
            const batch = this.db.batch();
            batch.set(aggregateRef, {
                count: items.length,
                chunkCount: chunks.length,
                updatedAt: new Date().toISOString(),
                chunked: true
            });
            
            chunks.forEach((chunk, index) => {
                const chunkRef = orgRef.collection('aggregated').doc(`${collection}_chunk_${index}`);
                batch.set(chunkRef, { items: chunk, index: index });
            });
            
            await batch.commit();
            console.log(`📦 Saved ${items.length} ${collection} in ${chunks.length} chunks`);
        }
    }

    /**
     * Load aggregated data (FAST - single read operation)
     * OPTIMIZED: Uses cache-first approach for faster loading
     */
    async loadAggregatedData(collection, useCache = true) {
        const orgRef = this.db.collection('organizations').doc(this.currentOrgId);
        const aggregateRef = orgRef.collection('aggregated').doc(collection);
        
        try {
            let doc;
            
            if (useCache) {
                // Try cache first for instant loading
                try {
                    doc = await aggregateRef.get({ source: 'cache' });
                    if (!doc.exists) {
                        // Cache miss - try server
                        doc = await aggregateRef.get({ source: 'server' });
                    }
                } catch (cacheError) {
                    // Cache failed - try server
                    doc = await aggregateRef.get({ source: 'server' });
                }
            } else {
                doc = await aggregateRef.get();
            }
            
            if (!doc.exists) {
                return null; // No aggregated data, fall back to individual docs
            }
            
            const data = doc.data();
            
            if (!data.chunked) {
                // Single document - fast path
                return data.items || [];
            } else {
                // Multiple chunks - load all in parallel
                const chunkPromises = [];
                const source = useCache ? { source: 'cache' } : {};
                
                for (let i = 0; i < data.chunkCount; i++) {
                    const chunkRef = orgRef.collection('aggregated').doc(`${collection}_chunk_${i}`);
                    chunkPromises.push(
                        chunkRef.get(source).catch(() => chunkRef.get({ source: 'server' }))
                    );
                }
                
                const chunkDocs = await Promise.all(chunkPromises);
                const allItems = [];
                chunkDocs.sort((a, b) => (a.data()?.index || 0) - (b.data()?.index || 0));
                chunkDocs.forEach(chunkDoc => {
                    if (chunkDoc.exists && chunkDoc.data()?.items) {
                        allItems.push(...chunkDoc.data().items);
                    }
                });
                
                return allItems;
            }
        } catch (error) {
            console.warn(`No aggregated data for ${collection}:`, error.message);
            return null;
        }
    }

    /**
     * Original batch replace for individual documents (slower, kept as fallback)
     */
    async batchReplaceIndividual(collection, newItems) {
        // Get existing items count first (lightweight query)
        const existingSnapshot = await this.db.collection('organizations').doc(this.currentOrgId).collection(collection).get();
        const existingCount = existingSnapshot.size;
        
        if (existingCount === 0) {
            if (newItems.length > 0) {
                await this.batchCreate(collection, newItems);
            }
        } else {
            const existingItems = existingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            await this.batchDelete(collection, existingItems);
            
            if (newItems.length > 0) {
                await this.batchCreate(collection, newItems);
            }
        }
    }

    /**
     * Batch create multiple items for maximum efficiency
     */
    async batchCreate(collection, items) {
        if (!this.currentOrgId) await this.initialize();
        
        if (!items || items.length === 0) return;

        // Firestore batch operations are limited to 500 operations per batch
        const batchSize = 500;
        const batches = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = this.db.batch();
            const batchItems = items.slice(i, i + batchSize);
            
            batchItems.forEach(item => {
                const docRef = this.db.collection('organizations').doc(this.currentOrgId).collection(collection).doc(item.id);
                batch.set(docRef, item);
            });
            
            batches.push(batch.commit());
        }
        
        // Execute all batches in parallel for maximum speed
        await Promise.all(batches);
        console.log(`✅ Batch created ${items.length} items in ${collection}`);
    }

    /**
     * Get all data with hybrid approach: Firestore + offline persistence + cache
     * OPTIMIZED: Tries aggregated data first (single doc), falls back to individual docs
     */
    async getAllData() {
        if (!this.currentOrgId) await this.initialize();
        
        const startTime = performance.now();
        console.log('🚀 Loading all data (aggregated-first approach)...');
        
        // Get all collections in parallel but with a single organization query
        const orgRef = this.db.collection('organizations').doc(this.currentOrgId);
        
        // Helper to load a collection - tries aggregated first, then individual docs
        const loadCollectionSmart = async (collectionName) => {
            // Try aggregated data first (FAST - single doc read)
            const aggregated = await this.loadAggregatedData(collectionName);
            if (aggregated && aggregated.length > 0) {
                console.log(`⚡ ${collectionName}: loaded ${aggregated.length} items from aggregated doc`);
                return aggregated;
            }
            
            // Fall back to individual docs (slower, for legacy data)
            try {
                // Try cache first
                const cacheSnapshot = await orgRef.collection(collectionName).get({ source: 'cache' });
                if (cacheSnapshot.size > 0) {
                    console.log(`📦 ${collectionName}: loaded ${cacheSnapshot.size} items from individual docs (cache)`);
                    return cacheSnapshot.docs.map(doc => doc.data());
                }
                // Cache is empty, fall back to server
                console.log(`🌐 ${collectionName}: loading from server...`);
                const serverSnapshot = await orgRef.collection(collectionName).get({ source: 'server' });
                return serverSnapshot.docs.map(doc => doc.data());
            } catch (error) {
                console.warn(`⚠️ ${collectionName}: failed to load`, error);
                return [];
            }
        };
        
        try {
            const [employees, shiftTypes, jobRoles, schedules] = await Promise.all([
                loadCollectionSmart('employees'),
                loadCollectionSmart('shiftTypes'),
                loadCollectionSmart('jobRoles'),
                loadCollectionSmart('schedules')
            ]);
            
            const result = { employees, shiftTypes, jobRoles, schedules };
            
            const loadTime = performance.now() - startTime;
            console.log(`⚡ Data load completed in ${loadTime.toFixed(0)}ms`);
            console.log('📊 Loaded:', {
                employees: result.employees.length,
                shiftTypes: result.shiftTypes.length,
                jobRoles: result.jobRoles.length,
                schedules: result.schedules.length
            });
            
            return result;
        } catch (error) {
            console.error('Failed to load all data:', error);
            throw error;
        }
    }

    /**
     * Real-time listeners
     */
    onCollectionChange(collection, callback) {
        if (!this.currentOrgId) {
            console.warn('Cannot set up listener: no organization');
            return;
        }

        // Listen to AGGREGATED data (single doc) - matches our new storage format
        const aggregateRef = this.db.collection('organizations').doc(this.currentOrgId)
            .collection('aggregated').doc(collection);
        
        let hasReceivedData = false; // Track if we've ever received real data
        
        const listener = aggregateRef.onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                if (data.chunked) {
                    // Chunked data - need to load all chunks (rare, only for very large datasets)
                    this.loadAggregatedData(collection).then(items => {
                        if (items && items.length > 0) {
                            hasReceivedData = true;
                            callback(items);
                        }
                    });
                } else {
                    // Single doc - fast path
                    const items = data.items || [];
                    if (items.length > 0) {
                        hasReceivedData = true;
                        callback(items);
                    } else if (hasReceivedData) {
                        // Only send empty if we previously had data (actual deletion)
                        callback([]);
                    }
                    // Otherwise: empty aggregated doc but no prior data - don't overwrite
                }
            } else {
                // No aggregated data exists - check for legacy individual docs
                // But ONLY if we haven't received real data before (don't overwrite with legacy)
                if (!hasReceivedData) {
                    this.db.collection('organizations').doc(this.currentOrgId).collection(collection)
                        .get().then(snapshot => {
                            if (snapshot.size > 0) {
                                hasReceivedData = true;
                                const data = snapshot.docs.map(doc => doc.data());
                                callback(data);
                            }
                            // If both empty and no prior data, don't callback - let localStorage data stay
                        });
                }
            }
        });

        this.listeners.set(collection, listener);
        return listener;
    }

    /**
     * Remove a specific listener
     */
    removeListener(collection) {
        const listener = this.listeners.get(collection);
        if (listener) {
            listener();
            this.listeners.delete(collection);
        }
    }

    /**
     * Remove all listeners
     */
    removeAllListeners() {
        this.listeners.forEach(listener => listener());
        this.listeners.clear();
    }

    /**
     * Employee-specific operations
     */
    async createEmployee(employeeData) {
        return await this.create('employees', employeeData);
    }

    async getEmployees() {
        return await this.read('employees');
    }

    async updateEmployee(id, employeeData) {
        return await this.update('employees', id, employeeData);
    }

    async deleteEmployee(id) {
        return await this.delete('employees', id);
    }

    onEmployeesChange(callback) {
        return this.onCollectionChange('employees', callback);
    }

    /**
     * Shift Types operations
     */
    async createShiftType(shiftData) {
        return await this.create('shiftTypes', shiftData);
    }

    async getShiftTypes() {
        return await this.read('shiftTypes');
    }

    async updateShiftType(id, shiftData) {
        return await this.update('shiftTypes', id, shiftData);
    }

    async deleteShiftType(id) {
        return await this.delete('shiftTypes', id);
    }

    onShiftTypesChange(callback) {
        return this.onCollectionChange('shiftTypes', callback);
    }

    /**
     * Job Roles operations
     */
    async createJobRole(roleData) {
        return await this.create('jobRoles', roleData);
    }

    async getJobRoles() {
        return await this.read('jobRoles');
    }

    async updateJobRole(id, roleData) {
        return await this.update('jobRoles', id, roleData);
    }

    async deleteJobRole(id) {
        return await this.delete('jobRoles', id);
    }

    onJobRolesChange(callback) {
        return this.onCollectionChange('jobRoles', callback);
    }

    /**
     * Schedules operations
     */
    async createSchedule(scheduleData) {
        return await this.create('schedules', scheduleData);
    }

    async getSchedules() {
        return await this.read('schedules');
    }

    async updateSchedule(id, scheduleData) {
        return await this.update('schedules', id, scheduleData);
    }

    async deleteSchedule(id) {
        return await this.delete('schedules', id);
    }

    onSchedulesChange(callback) {
        return this.onCollectionChange('schedules', callback);
    }

    /**
     * Migration helper - migrate localStorage data to Firestore
     */
    async migrateFromLocalStorage() {
        console.log('Starting migration from localStorage to Firestore...');
        
        try {
            // Migrate employees
            const localEmployees = JSON.parse(localStorage.getItem('workforce_employees') || '[]');
            if (localEmployees.length > 0) {
                console.log(`Migrating ${localEmployees.length} employees...`);
                for (const employee of localEmployees) {
                    await this.createEmployee(employee);
                }
                console.log('Employees migrated successfully');
            }

            // Migrate shift types
            const localShiftTypes = JSON.parse(localStorage.getItem('workforce_shiftTypes') || '[]');
            if (localShiftTypes.length > 0) {
                console.log(`Migrating ${localShiftTypes.length} shift types...`);
                for (const shiftType of localShiftTypes) {
                    await this.createShiftType(shiftType);
                }
                console.log('Shift types migrated successfully');
            }

            // Migrate job roles
            const localJobRoles = JSON.parse(localStorage.getItem('workforce_jobRoles') || '[]');
            if (localJobRoles.length > 0) {
                console.log(`Migrating ${localJobRoles.length} job roles...`);
                for (const jobRole of localJobRoles) {
                    await this.createJobRole(jobRole);
                }
                console.log('Job roles migrated successfully');
            }

            // Migrate schedules
            const localSchedules = JSON.parse(localStorage.getItem('workforce_schedules') || '[]');
            if (localSchedules.length > 0) {
                console.log(`Migrating ${localSchedules.length} schedules...`);
                for (const schedule of localSchedules) {
                    await this.createSchedule(schedule);
                }
                console.log('Schedules migrated successfully');
            }

            console.log('Migration completed successfully!');
            return true;
        } catch (error) {
            console.error('Migration failed:', error);
            return false;
        }
    }
}
