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
     * Batch replace entire collection - much faster than clear + create
     * OPTIMIZED: Runs delete and create in parallel when possible
     */
    async batchReplace(collection, newItems) {
        if (!this.currentOrgId) await this.initialize();
        
        console.log(`🔄 Batch replacing ${collection} with ${newItems.length} items...`);
        
        // Get existing items count first (lightweight query)
        const existingSnapshot = await this.db.collection('organizations').doc(this.currentOrgId).collection(collection).get();
        const existingCount = existingSnapshot.size;
        
        if (existingCount === 0) {
            // OPTIMIZATION: No existing data, skip delete entirely
            console.log(`No existing items in ${collection}, creating ${newItems.length} new items...`);
            if (newItems.length > 0) {
                await this.batchCreate(collection, newItems);
            }
        } else {
            // Has existing data - need to delete first, then create
            console.log(`Found ${existingCount} existing items to delete`);
            const existingItems = existingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            await this.batchDelete(collection, existingItems);
            
            if (newItems.length > 0) {
                await this.batchCreate(collection, newItems);
            }
        }
        
        console.log(`✅ Batch replacement completed for ${collection}`);
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
     */
    async getAllData() {
        if (!this.currentOrgId) await this.initialize();
        
        const startTime = performance.now();
        console.log('🚀 Loading all data with hybrid approach...');
        
        try {
            // Use CACHE_FIRST for better performance with offline persistence
            const options = { source: 'cache' }; // Try cache first, fallback to server
            
            // Get all collections in parallel but with a single organization query
            const orgRef = this.db.collection('organizations').doc(this.currentOrgId);
            
            const [employeesSnapshot, shiftTypesSnapshot, jobRolesSnapshot, schedulesSnapshot] = await Promise.all([
                orgRef.collection('employees').get(options),
                orgRef.collection('shiftTypes').get(options),
                orgRef.collection('jobRoles').get(options),
                orgRef.collection('schedules').get(options)
            ]);
            
            const result = {
                employees: employeesSnapshot.docs.map(doc => doc.data()),
                shiftTypes: shiftTypesSnapshot.docs.map(doc => doc.data()),
                jobRoles: jobRolesSnapshot.docs.map(doc => doc.data()),
                schedules: schedulesSnapshot.docs.map(doc => doc.data())
            };
            
            // Debug: Check if schedules collection is empty
            if (result.schedules.length === 0) {
                console.error('❌ No schedules found in Firestore collection!');
                console.log('🔍 Schedules snapshot:', {
                    size: schedulesSnapshot.size,
                    empty: schedulesSnapshot.empty,
                    docs: schedulesSnapshot.docs.length
                });
            } else {
                console.log('✅ Schedules loaded from Firestore:', result.schedules.slice(0, 3));
            }
            
            const loadTime = performance.now() - startTime;
            console.log(`⚡ Single query load completed in ${loadTime.toFixed(2)}ms`);
            console.log('📊 Single query results:', {
                employees: result.employees.length,
                shiftTypes: result.shiftTypes.length,
                jobRoles: result.jobRoles.length,
                schedules: result.schedules.length,
                loadTime: `${loadTime.toFixed(2)}ms`
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

        const listener = this.db.collection('organizations').doc(this.currentOrgId).collection(collection)
            .onSnapshot(snapshot => {
                const data = snapshot.docs.map(doc => doc.data());
                callback(data);
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
