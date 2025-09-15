// SnapshotManager - handles saving a reference snapshot of the current schedule and restoring it later
class SnapshotManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.snapshotKey = 'workforce_schedule_snapshot_v1';
        this.isFiltering = false;
        this.cache = new Map(); // Cache for parsed snapshots
        this.compressionEnabled = false; // Disable compression to prevent hanging
    }

    // Create a deep snapshot of current active data
    async saveSnapshot() {
        const startTime = performance.now();
        
        try {
            
            // Use structured cloning for better performance, with fallback to JSON cloning
            let snapshot;
            try {
                snapshot = {
                    createdAt: new Date().toISOString(),
                    employees: structuredClone(this.workforceManager.employees || []),
                    shiftTypes: structuredClone(this.workforceManager.shiftTypes || []),
                    jobRoles: structuredClone(this.workforceManager.jobRoles || []),
                    schedules: structuredClone(this.workforceManager.schedules || []),
                    currentWeekStart: this._formatDateForStorage(this.workforceManager.currentWeekStart)
                };
            } catch (cloneError) {
                snapshot = {
                    createdAt: new Date().toISOString(),
                    employees: JSON.parse(JSON.stringify(this.workforceManager.employees || [])),
                    shiftTypes: JSON.parse(JSON.stringify(this.workforceManager.shiftTypes || [])),
                    jobRoles: JSON.parse(JSON.stringify(this.workforceManager.jobRoles || [])),
                    schedules: JSON.parse(JSON.stringify(this.workforceManager.schedules || [])),
                    currentWeekStart: this._formatDateForStorage(this.workforceManager.currentWeekStart)
                };
            }

            // Compress large snapshots (with timeout to prevent hanging)
            let serializedSnapshot;
            if (this.compressionEnabled && this._shouldCompress(snapshot)) {
                try {
                    // Add timeout to prevent hanging
                    const compressionPromise = this._compressSnapshot(snapshot);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Compression timeout')), 5000)
                    );
                    
                    serializedSnapshot = await Promise.race([compressionPromise, timeoutPromise]);
                    snapshot.compressed = true;
                } catch (error) {
                    serializedSnapshot = JSON.stringify(snapshot);
                    snapshot.compressed = false;
                }
                } else {
                serializedSnapshot = JSON.stringify(snapshot);
                snapshot.compressed = false;
            }

            localStorage.setItem(this.snapshotKey, serializedSnapshot);
            
            // Cache the parsed snapshot for faster subsequent loads
            this.cache.set(this.snapshotKey, snapshot);
            
            const saveTime = performance.now() - startTime;
            
            // Verify the snapshot was actually saved
            const verification = localStorage.getItem(this.snapshotKey);
            if (!verification) {
                throw new Error('Snapshot verification failed - data not saved to localStorage');
            }
            
            return snapshot;
            
        } catch (error) {
            throw error;
        }
    }

    // Load snapshot object from storage with error handling and caching
    async loadSnapshot() {
        try {
            // Check cache first for faster subsequent loads
            if (this.cache.has(this.snapshotKey)) {
                console.log('📸 Loading snapshot from cache');
                return this.cache.get(this.snapshotKey);
            }

            const raw = localStorage.getItem(this.snapshotKey);
            if (!raw) {
                return null;
            }

            // Handle compressed snapshots
            let snapshot;
            try {
                snapshot = JSON.parse(raw);
                if (snapshot.compressed) {
                    snapshot = await this._decompressSnapshot(raw);
                }
            } catch (parseError) {
                console.error('❌ Error parsing snapshot:', parseError);
                // Try to recover with fallback
                this._handleCorruptedSnapshot();
                return null;
            }

            // Validate snapshot structure
            if (!this._validateSnapshot(snapshot)) {
                console.error('❌ Invalid snapshot structure');
                this._handleCorruptedSnapshot();
                return null;
            }

            // Cache the parsed snapshot
            this.cache.set(this.snapshotKey, snapshot);
            
            console.log('📸 Snapshot loaded and validated successfully');
            return snapshot;

        } catch (error) {
            console.error('❌ Error loading snapshot:', error);
            this._handleCorruptedSnapshot();
            return null;
        }
    }

    // Synchronous version for cases where async is not possible
    loadSnapshotSync() {
        try {
            // Check cache first for faster subsequent loads
            if (this.cache.has(this.snapshotKey)) {
                return this.cache.get(this.snapshotKey);
            }

            const raw = localStorage.getItem(this.snapshotKey);
            if (!raw) {
                return null;
            }

            // Handle compressed snapshots (only simple compression for sync)
            let snapshot;
            try {
                snapshot = JSON.parse(raw);
                if (snapshot.c) {
                    // Simple compressed format
                    snapshot = {
                        createdAt: snapshot.t,
                        employees: snapshot.e,
                        shiftTypes: snapshot.s,
                        jobRoles: snapshot.j,
                        schedules: snapshot.sch,
                        currentWeekStart: snapshot.w
                    };
                }
            } catch (parseError) {
                console.error('❌ Error parsing snapshot (sync):', parseError);
                this._handleCorruptedSnapshot();
                return null;
            }

            // Validate snapshot structure
            if (!this._validateSnapshot(snapshot)) {
                console.error('❌ Invalid snapshot structure (sync)');
                this._handleCorruptedSnapshot();
                return null;
            }

            // Cache the parsed snapshot
            this.cache.set(this.snapshotKey, snapshot);
            
            return snapshot;

        } catch (error) {
            console.error('❌ Error loading snapshot (sync):', error);
            this._handleCorruptedSnapshot();
            return null;
        }
    }

    // Restore snapshot into active state with optimizations
    async restoreSnapshot() {
        const startTime = performance.now();
        const snapshot = await this.loadSnapshot();
        
        if (!snapshot) {
            console.log('📸 No snapshot found to restore');
            return false;
        }

        console.log('📸 Starting optimized snapshot restore...');
        console.log('📸 Snapshot data:', {
            employees: snapshot.employees?.length || 0,
            shiftTypes: snapshot.shiftTypes?.length || 0,
            jobRoles: snapshot.jobRoles?.length || 0,
            schedules: snapshot.schedules?.length || 0
        });

        // Set flag to prevent real-time listener updates during restore
        this.workforceManager.isRestoringSnapshot = true;

        // Use incremental loading - only update changed data
        const loadStartTime = performance.now();
        const changes = this._calculateIncrementalChanges(snapshot);
        const loadTime = performance.now() - loadStartTime;
        console.log(`📸 Incremental changes calculated in ${loadTime.toFixed(2)}ms:`, changes);

        // Check if this is essentially a full replacement (too many changes for incremental approach)
        const totalChanges = changes.employees.added.length + changes.employees.modified.length + changes.employees.removed.length +
                           changes.shiftTypes.added.length + changes.shiftTypes.modified.length + changes.shiftTypes.removed.length +
                           changes.jobRoles.added.length + changes.jobRoles.modified.length + changes.jobRoles.removed.length +
                           changes.schedules.added.length + changes.schedules.modified.length + changes.schedules.removed.length;

        // Always use incremental approach - only sync what actually changed
        console.log(`📸 Syncing incremental changes to Firebase (${totalChanges} total changes)...`);
        await this._syncIncrementalChangesToFirebase(changes);

        // Apply changes locally after Firebase sync (Firebase listeners are disabled, no UI conflicts)
        console.log('📸 Applying incremental changes locally...');
        this._applyIncrementalChanges(changes);

        // Restore calendar start
        if (snapshot.currentWeekStart) {
            const [y, m, d] = snapshot.currentWeekStart.split('-').map(Number);
            this.workforceManager.currentWeekStart = new Date(y, m - 1, d);
            localStorage.setItem('calendarStartDate', snapshot.currentWeekStart);
            const startDateInput = document.getElementById('calendarStartDate');
            if (startDateInput) startDateInput.value = snapshot.currentWeekStart;
        }

        console.log('📸 Snapshot restore completed');

        // Trigger UI updates while Firebase listeners are still disabled
        console.log('📸 Triggering UI updates for snapshot restore...');
        // Always do a full calendar render after snapshot restore to ensure UI is updated
        console.log('📸 Performing full calendar render after snapshot restore...');
        this.workforceManager.calendarRenderer.renderScheduleMatrix();
        
        // Note: Keep isRestoringSnapshot flag set - it will be cleared after user dismisses the alert

        const totalTime = performance.now() - startTime;
        console.log(`📸 Total restore time: ${totalTime.toFixed(2)}ms`);
        return true;
    }

    hasSnapshot() {
        return !!localStorage.getItem(this.snapshotKey);
    }

    /**
     * Clear snapshot cache (useful for memory management)
     */
    clearCache() {
        this.cache.clear();
        console.log('📸 Snapshot cache cleared');
    }

    /**
     * Invalidate snapshot cache when data changes
     */
    invalidateSnapshotCache() {
        this.cache.delete(this.snapshotKey);
        console.log('📸 Snapshot cache invalidated due to data changes');
    }

    /**
     * Enable or disable compression
     */
    setCompressionEnabled(enabled) {
        this.compressionEnabled = enabled;
        console.log(`📸 Compression ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Simple save method without compression or complex features
     */
    saveSnapshotSimple() {
        console.log('🔄 Starting simple snapshot save...');
        const startTime = performance.now();
        
        try {
            const snapshot = {
                createdAt: new Date().toISOString(),
                employees: JSON.parse(JSON.stringify(this.workforceManager.employees || [])),
                shiftTypes: JSON.parse(JSON.stringify(this.workforceManager.shiftTypes || [])),
                jobRoles: JSON.parse(JSON.stringify(this.workforceManager.jobRoles || [])),
                schedules: JSON.parse(JSON.stringify(this.workforceManager.schedules || [])),
                currentWeekStart: this._formatDateForStorage(this.workforceManager.currentWeekStart)
            };

            // Pre-calculate difference maps for faster loading
            console.log('🔄 Pre-calculating difference maps...');
            const diffStartTime = performance.now();
            snapshot.differenceMaps = this._preCalculateDifferenceMaps(snapshot);
            const diffTime = performance.now() - diffStartTime;
            console.log(`📊 Difference maps calculated in ${diffTime.toFixed(2)}ms`);

            const serializedSnapshot = JSON.stringify(snapshot);
            localStorage.setItem(this.snapshotKey, serializedSnapshot);
            
            // Cache the parsed snapshot
            this.cache.set(this.snapshotKey, snapshot);
            
            const saveTime = performance.now() - startTime;
            console.log(`📸 Simple snapshot saved in ${saveTime.toFixed(2)}ms`);
            console.log(`📸 Snapshot size: ${serializedSnapshot.length} bytes`);
            
            return snapshot;
        } catch (error) {
            console.error('❌ Error in simple snapshot save:', error);
            throw error;
        }
    }

    /**
     * Get snapshot statistics for debugging
     */
    getSnapshotStats() {
        const raw = localStorage.getItem(this.snapshotKey);
        if (!raw) return null;

        const size = raw.length;
        const cached = this.cache.has(this.snapshotKey);
        
        // Try to parse and get data counts
        let dataCounts = {};
        try {
            const parsed = JSON.parse(raw);
            if (parsed.c) {
                // Simple compressed format
                dataCounts = {
                    employees: parsed.e?.length || 0,
                    shiftTypes: parsed.s?.length || 0,
                    jobRoles: parsed.j?.length || 0,
                    schedules: parsed.sch?.length || 0
                };
            } else {
                // Normal format
                dataCounts = {
                    employees: parsed.employees?.length || 0,
                    shiftTypes: parsed.shiftTypes?.length || 0,
                    jobRoles: parsed.jobRoles?.length || 0,
                    schedules: parsed.schedules?.length || 0
                };
            }
        } catch (error) {
            console.warn('Could not parse snapshot for stats:', error);
        }
        
        return {
            size: size,
            sizeKB: Math.round(size / 1024 * 100) / 100,
            cached: cached,
            compressionEnabled: this.compressionEnabled,
            compressed: raw.includes('"c":true') || raw.includes('"compressed":true'),
            dataCounts: dataCounts
        };
    }

    _formatDateForStorage(date) {
        if (!(date instanceof Date) || isNaN(date)) return null;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Helper methods for optimization

    /**
     * Determine if snapshot should be compressed based on size
     */
    _shouldCompress(snapshot) {
        const size = JSON.stringify(snapshot).length;
        return size > 100000; // Compress if larger than 100KB
    }

    /**
     * Simple compression using built-in compression (if available) or custom method
     */
    async _compressSnapshot(snapshot) {
        try {
            // Try using native compression if available
            if (typeof CompressionStream !== 'undefined') {
                return await this._nativeCompress(snapshot);
            } else {
                // Fallback to simple string compression
                return this._simpleCompress(snapshot);
            }
        } catch (error) {
            console.warn('⚠️ Compression failed, using uncompressed:', error);
            return JSON.stringify(snapshot);
        }
    }

    /**
     * Native compression using CompressionStream API
     */
    async _nativeCompress(snapshot) {
        try {
            const jsonString = JSON.stringify(snapshot);
            const encoder = new TextEncoder();
            const stream = new CompressionStream('deflate-raw');
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();
            
            await writer.write(encoder.encode(jsonString));
            await writer.close();
            
            const chunks = [];
            let done = false;
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) chunks.push(value);
            }
            
            const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let offset = 0;
            for (const chunk of chunks) {
                compressed.set(chunk, offset);
                offset += chunk.length;
            }
            
            return JSON.stringify({
                compressed: true,
                data: Array.from(compressed)
            });
        } catch (error) {
            console.warn('⚠️ Native compression failed:', error);
            throw error;
        }
    }

    /**
     * Simple compression by removing redundant whitespace and using shorter keys
     */
    _simpleCompress(snapshot) {
        // Remove extra whitespace and use shorter property names
        const compressed = {
            c: true, // compressed flag
            t: snapshot.createdAt,
            e: snapshot.employees,
            s: snapshot.shiftTypes,
            j: snapshot.jobRoles,
            sch: snapshot.schedules,
            w: snapshot.currentWeekStart
        };
        return JSON.stringify(compressed);
    }

    /**
     * Decompress snapshot data
     */
    async _decompressSnapshot(raw) {
        try {
            const parsed = JSON.parse(raw);
            
            if (parsed.compressed && Array.isArray(parsed.data)) {
                // Native compressed data
                return await this._nativeDecompress(parsed);
            } else if (parsed.c) {
                // Simple compressed data
                return {
                    createdAt: parsed.t,
                    employees: parsed.e,
                    shiftTypes: parsed.s,
                    jobRoles: parsed.j,
                    schedules: parsed.sch,
                    currentWeekStart: parsed.w
                };
            } else {
                // Not compressed
                return parsed;
            }
        } catch (error) {
            console.error('❌ Error decompressing snapshot:', error);
            throw error;
        }
    }

    /**
     * Native decompression using DecompressionStream API
     */
    async _nativeDecompress(compressedData) {
        const uint8Array = new Uint8Array(compressedData.data);
        const stream = new DecompressionStream('deflate-raw');
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();
        
        writer.write(uint8Array);
        writer.close();
        
        const chunks = [];
        let done = false;
        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) chunks.push(value);
        }
        
        const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
            decompressed.set(chunk, offset);
            offset += chunk.length;
        }
        
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decompressed));
    }

    /**
     * Validate snapshot structure
     */
    _validateSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') {
            console.error('❌ Snapshot validation failed: not an object');
            return false;
        }
        
        const requiredFields = ['employees', 'shiftTypes', 'jobRoles', 'schedules'];
        for (const field of requiredFields) {
            if (!Array.isArray(snapshot[field])) {
                console.error(`❌ Invalid snapshot: ${field} is not an array (type: ${typeof snapshot[field]})`);
                return false;
            }
        }
        
        return true;
    }

    /**
     * Handle corrupted snapshot by clearing it
     */
    _handleCorruptedSnapshot() {
        console.warn('⚠️ Clearing corrupted snapshot');
        localStorage.removeItem(this.snapshotKey);
        this.cache.delete(this.snapshotKey);
    }

    /**
     * Pre-calculate difference maps during save for faster loading
     */
    _preCalculateDifferenceMaps(snapshot) {
        const maps = {
            employeeMap: new Map(),
            shiftTypeMap: new Map(),
            jobRoleMap: new Map(),
            scheduleMap: new Map()
        };

        // Create lookup maps for faster comparison during restore
        snapshot.employees.forEach(emp => {
            maps.employeeMap.set(emp.id, emp);
        });

        snapshot.shiftTypes.forEach(shift => {
            maps.shiftTypeMap.set(shift.id, shift);
        });

        snapshot.jobRoles.forEach(role => {
            maps.jobRoleMap.set(role.id, role);
        });

        snapshot.schedules.forEach(schedule => {
            const key = `${schedule.employeeId}_${schedule.date}`;
            maps.scheduleMap.set(key, schedule);
        });

        return maps;
    }

    /**
     * Calculate incremental changes between current and snapshot data
     */
    _calculateIncrementalChanges(snapshot) {
        const changes = {
            employees: { added: [], modified: [], removed: [] },
            shiftTypes: { added: [], modified: [], removed: [] },
            jobRoles: { added: [], modified: [], removed: [] },
            schedules: { added: [], modified: [], removed: [] }
        };

        // Compare employees
        const currentEmployees = this.workforceManager.employees || [];
        const snapshotEmployees = snapshot.employees || [];
        
        // Find added/modified employees
        snapshotEmployees.forEach(snapEmp => {
            const currentEmp = currentEmployees.find(emp => emp.id === snapEmp.id);
            if (!currentEmp) {
                changes.employees.added.push(snapEmp);
            } else if (!this._deepCompareObjects(currentEmp, snapEmp)) {
                changes.employees.modified.push(snapEmp);
            }
        });

        // Find removed employees
        currentEmployees.forEach(currentEmp => {
            if (!snapshotEmployees.find(emp => emp.id === currentEmp.id)) {
                changes.employees.removed.push(currentEmp.id);
            }
        });

        // Compare shift types
        const currentShiftTypes = this.workforceManager.shiftTypes || [];
        const snapshotShiftTypes = snapshot.shiftTypes || [];
        
        snapshotShiftTypes.forEach(snapShift => {
            const currentShift = currentShiftTypes.find(shift => shift.id === snapShift.id);
            if (!currentShift) {
                changes.shiftTypes.added.push(snapShift);
            } else if (!this._deepCompareObjects(currentShift, snapShift)) {
                changes.shiftTypes.modified.push(snapShift);
            }
        });

        currentShiftTypes.forEach(currentShift => {
            if (!snapshotShiftTypes.find(shift => shift.id === currentShift.id)) {
                changes.shiftTypes.removed.push(currentShift.id);
            }
        });

        // Compare job roles
        const currentJobRoles = this.workforceManager.jobRoles || [];
        const snapshotJobRoles = snapshot.jobRoles || [];
        
        snapshotJobRoles.forEach(snapRole => {
            const currentRole = currentJobRoles.find(role => role.id === snapRole.id);
            if (!currentRole) {
                changes.jobRoles.added.push(snapRole);
            } else if (!this._deepCompareObjects(currentRole, snapRole)) {
                changes.jobRoles.modified.push(snapRole);
            }
        });

        currentJobRoles.forEach(currentRole => {
            if (!snapshotJobRoles.find(role => role.id === currentRole.id)) {
                changes.jobRoles.removed.push(currentRole.id);
            }
        });

        // Compare schedules (most important for performance) - use optimized lookup
        const currentSchedules = this.workforceManager.schedules || [];
        const snapshotSchedules = snapshot.schedules || [];
        
        // Use pre-calculated maps if available for faster lookup
        let scheduleMap = new Map();
        if (snapshot.differenceMaps?.scheduleMap && Object.keys(snapshot.differenceMaps.scheduleMap).length > 0) {
            // Convert the stored map (might be plain object from JSON) to a proper Map
            if (snapshot.differenceMaps.scheduleMap instanceof Map) {
                scheduleMap = snapshot.differenceMaps.scheduleMap;
            } else {
                // Convert plain object to Map
                Object.entries(snapshot.differenceMaps.scheduleMap).forEach(([key, value]) => {
                    scheduleMap.set(key, value);
                });
            }
        } else {
            // Fallback: create map on-the-fly
            snapshotSchedules.forEach(schedule => {
                const key = `${schedule.employeeId}_${schedule.date}`;
                scheduleMap.set(key, schedule);
            });
        }
        
        let modifiedCount = 0;
        snapshotSchedules.forEach(snapSchedule => {
            const key = `${snapSchedule.employeeId}_${snapSchedule.date}`;
            const currentSchedule = currentSchedules.find(sched => 
                sched.employeeId === snapSchedule.employeeId && sched.date === snapSchedule.date
            );
            if (!currentSchedule) {
                changes.schedules.added.push(snapSchedule);
            } else if (!this._deepCompareObjects(currentSchedule, snapSchedule)) {
                if (modifiedCount < 3) {
                    console.log(`🔍 Schedule ${snapSchedule.employeeId} on ${snapSchedule.date} marked as modified:`);
                    console.log('Current:', JSON.stringify(currentSchedule, null, 2));
                    console.log('Snapshot:', JSON.stringify(snapSchedule, null, 2));
                }
                changes.schedules.modified.push(snapSchedule);
                modifiedCount++;
            }
        });
        console.log(`📊 Total schedules marked as modified: ${modifiedCount}`);

        // Find removed schedules: current schedules that don't exist in snapshot
        currentSchedules.forEach(currentSchedule => {
            const key = `${currentSchedule.employeeId}_${currentSchedule.date}`;
            if (!scheduleMap.has(key)) {
                changes.schedules.removed.push({
                    employeeId: currentSchedule.employeeId,
                    date: currentSchedule.date
                });
            }
        });

        return changes;
    }

    /**
     * Compare objects focusing only on essential fields, handling missing fields gracefully
     */
    _deepCompareObjects(obj1, obj2) {
        // Quick reference check
        if (obj1 === obj2) return true;
        if (!obj1 || !obj2) return false;
        if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

        // Define essential fields for each type of object
        let essentialFields = [];
        
        // Determine essential fields based on object structure
        if (obj1.id && obj1.name !== undefined) {
            // Employee or similar object
            essentialFields = ['id', 'name', 'roleId', 'shiftType'];
        } else if (obj1.id && obj1.employeeId !== undefined && obj1.date !== undefined) {
            // Schedule object - exclude ID as it changes when schedules are recreated
            essentialFields = ['employeeId', 'shiftId', 'date', 'shiftType'];
        } else if (obj1.id && obj1.name !== undefined && obj1.color !== undefined) {
            // Shift type or job role object
            essentialFields = ['id', 'name', 'color'];
        } else {
            // Fallback: compare all fields except metadata
            essentialFields = Object.keys(obj1).filter(key => 
                !['updatedAt', 'createdAt', 'lastModified', 'timestamp', 'updatedBy', 'shifts'].includes(key)
            );
        }

        // Compare only essential fields that exist in both objects
        for (const key of essentialFields) {
            // Skip if field doesn't exist in both objects
            if (!(key in obj1) || !(key in obj2)) continue;
            
            // Compare values
            if (obj1[key] !== obj2[key]) {
                if (essentialFields.includes('employeeId') && essentialFields.includes('date')) {
                    // This is a schedule comparison - log the difference
                    console.log(`🔍 Schedule comparison failed on field ${key}: "${obj1[key]}" vs "${obj2[key]}"`);
                }
                return false;
            }
        }

        return true;
    }

    /**
     * Sync incremental changes to Firebase without triggering full rebuild
     */
    async _syncIncrementalChangesToFirebase(changes) {
        console.log('🔄 Syncing incremental changes to Firebase...');
        
        // Validate changes before attempting sync
        if (!changes || typeof changes !== 'object') {
            throw new Error('Invalid changes object provided to Firebase sync');
        }
        
        try {
            // Sync employee changes
            if (changes.employees.added.length > 0) {
                console.log(`📝 Adding ${changes.employees.added.length} employees to Firebase...`);
                for (const employee of changes.employees.added) {
                    try {
                        await this.workforceManager.firebaseManager.createEmployee(employee);
                    } catch (error) {
                        console.error(`❌ Failed to create employee ${employee.id}:`, error);
                        throw new Error(`Failed to create employee: ${employee.name || employee.id}`);
                    }
                }
            }
            
            if (changes.employees.modified.length > 0) {
                console.log(`📝 Updating ${changes.employees.modified.length} employees in Firebase...`);
                for (const employee of changes.employees.modified) {
                    try {
                        await this.workforceManager.firebaseManager.updateEmployee(employee.id, employee);
                    } catch (error) {
                        console.error(`❌ Failed to update employee ${employee.id}:`, error);
                        throw new Error(`Failed to update employee: ${employee.name || employee.id}`);
                    }
                }
            }
            
            if (changes.employees.removed.length > 0) {
                console.log(`📝 Removing ${changes.employees.removed.length} employees from Firebase...`);
                for (const employeeId of changes.employees.removed) {
                    try {
                        await this.workforceManager.firebaseManager.deleteEmployee(employeeId);
                    } catch (error) {
                        console.error(`❌ Failed to delete employee ${employeeId}:`, error);
                        throw new Error(`Failed to delete employee: ${employeeId}`);
                    }
                }
            }

            // Sync shift type changes
            if (changes.shiftTypes.added.length > 0) {
                console.log(`📝 Adding ${changes.shiftTypes.added.length} shift types to Firebase...`);
                for (const shiftType of changes.shiftTypes.added) {
                    await this.workforceManager.firebaseManager.createShiftType(shiftType);
                }
            }
            
            if (changes.shiftTypes.modified.length > 0) {
                console.log(`📝 Updating ${changes.shiftTypes.modified.length} shift types in Firebase...`);
                for (const shiftType of changes.shiftTypes.modified) {
                    await this.workforceManager.firebaseManager.updateShiftType(shiftType.id, shiftType);
                }
            }
            
            if (changes.shiftTypes.removed.length > 0) {
                console.log(`📝 Removing ${changes.shiftTypes.removed.length} shift types from Firebase...`);
                for (const shiftTypeId of changes.shiftTypes.removed) {
                    await this.workforceManager.firebaseManager.deleteShiftType(shiftTypeId);
                }
            }

            // Sync job role changes
            if (changes.jobRoles.added.length > 0) {
                console.log(`📝 Adding ${changes.jobRoles.added.length} job roles to Firebase...`);
                for (const jobRole of changes.jobRoles.added) {
                    await this.workforceManager.firebaseManager.createJobRole(jobRole);
                }
            }
            
            if (changes.jobRoles.modified.length > 0) {
                console.log(`📝 Updating ${changes.jobRoles.modified.length} job roles in Firebase...`);
                for (const jobRole of changes.jobRoles.modified) {
                    await this.workforceManager.firebaseManager.updateJobRole(jobRole.id, jobRole);
                }
            }
            
            if (changes.jobRoles.removed.length > 0) {
                console.log(`📝 Removing ${changes.jobRoles.removed.length} job roles from Firebase...`);
                for (const jobRoleId of changes.jobRoles.removed) {
                    await this.workforceManager.firebaseManager.deleteJobRole(jobRoleId);
                }
            }

            // Sync schedule changes
            if (changes.schedules.added.length > 0) {
                console.log(`📝 Adding ${changes.schedules.added.length} schedules to Firebase...`);
                for (let i = 0; i < changes.schedules.added.length; i++) {
                    const schedule = changes.schedules.added[i];
                    try {
                        // Remove the ID and metadata fields so Firebase can generate new ones
                        const { id, createdAt, createdBy, updatedAt, updatedBy, ...scheduleData } = schedule;
                        console.log(`🔍 Creating new schedule data:`, scheduleData);
                        await this.workforceManager.firebaseManager.createSchedule(scheduleData);
                        
                        // Add small delay every 10 operations to prevent overwhelming Firebase
                        if ((i + 1) % 10 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    } catch (error) {
                        console.error(`❌ Failed to create schedule ${schedule.employeeId}-${schedule.date}:`, error);
                        console.error(`❌ Schedule data that failed:`, schedule);
                        // Don't throw here, just log and continue - this prevents one bad schedule from breaking the entire restore
                        console.warn(`⚠️ Skipping schedule creation due to error, continuing with restore...`);
                    }
                }
            }
            
            if (changes.schedules.modified.length > 0) {
                console.log(`📝 Updating ${changes.schedules.modified.length} schedules in Firebase...`);
                for (let i = 0; i < changes.schedules.modified.length; i++) {
                    const schedule = changes.schedules.modified[i];
                    try {
                        await this.workforceManager.firebaseManager.updateSchedule(schedule.id, schedule);
                        
                        // Add small delay every 10 operations to prevent overwhelming Firebase
                        if ((i + 1) % 10 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    } catch (error) {
                        // If update fails because schedule doesn't exist, try to create it instead
                        if (error.message && error.message.includes('No document to update')) {
                            console.log(`📝 Schedule ${schedule.id} doesn't exist, creating instead...`);
                            try {
                                // Remove the ID and metadata fields so Firebase can generate new ones
                                const { id, createdAt, createdBy, updatedAt, updatedBy, ...scheduleData } = schedule;
                                console.log(`🔍 Creating schedule data:`, scheduleData);
                                await this.workforceManager.firebaseManager.createSchedule(scheduleData);
                                console.log(`📝 Created schedule: ${schedule.employeeId} on ${schedule.date}`);
                            } catch (createError) {
                                console.error(`❌ Failed to create schedule ${schedule.employeeId}:`, createError);
                                console.error(`❌ Schedule data that failed:`, schedule);
                                // Don't throw here, just log and continue - this prevents one bad schedule from breaking the entire restore
                                console.warn(`⚠️ Skipping schedule creation due to error, continuing with restore...`);
                            }
                        } else {
                            console.error(`❌ Failed to update schedule ${schedule.id}:`, error);
                            // Don't throw here, just log and continue - this prevents one bad schedule from breaking the entire restore
                            console.warn(`⚠️ Skipping schedule update due to error, continuing with restore...`);
                        }
                    }
                }
            }
            
            if (changes.schedules.removed.length > 0) {
                console.log(`📝 Removing ${changes.schedules.removed.length} schedules from Firebase...`);
                for (const scheduleInfo of changes.schedules.removed) {
                    // Find the schedule to get its ID (before it gets removed locally)
                    const schedule = this.workforceManager.schedules.find(s => 
                        s.employeeId === scheduleInfo.employeeId && s.date === scheduleInfo.date
                    );
                    if (schedule) {
                        try {
                            await this.workforceManager.firebaseManager.deleteSchedule(schedule.id);
                        } catch (error) {
                            console.error(`❌ Failed to delete schedule ${schedule.id}:`, error);
                            throw new Error(`Failed to delete schedule: ${scheduleInfo.employeeId} on ${scheduleInfo.date}`);
                        }
                    } else {
                        console.warn(`⚠️ Could not find schedule to delete: ${scheduleInfo.employeeId} on ${scheduleInfo.date}`);
                    }
                }
            }

            console.log('✅ Incremental changes synced to Firebase successfully');
        } catch (error) {
            console.error('❌ Error syncing incremental changes to Firebase:', error);
            throw error;
        }
    }

    /**
     * Apply incremental changes to workforce manager data
     */
    _applyIncrementalChanges(changes) {
        console.log('🔄 Applying incremental changes...');

        // Apply employee changes
        if (changes.employees.added.length > 0 || changes.employees.modified.length > 0 || changes.employees.removed.length > 0) {
            console.log(`📝 Employee changes: +${changes.employees.added.length} ~${changes.employees.modified.length} -${changes.employees.removed.length}`);
            
            // Remove deleted employees
            this.workforceManager.employees = this.workforceManager.employees.filter(emp => 
                !changes.employees.removed.includes(emp.id)
            );
            
            // Add new employees
            changes.employees.added.forEach(emp => {
                this.workforceManager.employees.push(emp);
            });
            
            // Update modified employees
            changes.employees.modified.forEach(modifiedEmp => {
                const index = this.workforceManager.employees.findIndex(emp => emp.id === modifiedEmp.id);
                if (index !== -1) {
                    this.workforceManager.employees[index] = modifiedEmp;
                }
            });
        }

        // Apply shift type changes
        if (changes.shiftTypes.added.length > 0 || changes.shiftTypes.modified.length > 0 || changes.shiftTypes.removed.length > 0) {
            console.log(`📝 Shift type changes: +${changes.shiftTypes.added.length} ~${changes.shiftTypes.modified.length} -${changes.shiftTypes.removed.length}`);
            
            this.workforceManager.shiftTypes = this.workforceManager.shiftTypes.filter(shift => 
                !changes.shiftTypes.removed.includes(shift.id)
            );
            
            changes.shiftTypes.added.forEach(shift => {
                this.workforceManager.shiftTypes.push(shift);
            });
            
            changes.shiftTypes.modified.forEach(modifiedShift => {
                const index = this.workforceManager.shiftTypes.findIndex(shift => shift.id === modifiedShift.id);
                if (index !== -1) {
                    this.workforceManager.shiftTypes[index] = modifiedShift;
                }
            });
        }

        // Apply job role changes
        if (changes.jobRoles.added.length > 0 || changes.jobRoles.modified.length > 0 || changes.jobRoles.removed.length > 0) {
            console.log(`📝 Job role changes: +${changes.jobRoles.added.length} ~${changes.jobRoles.modified.length} -${changes.jobRoles.removed.length}`);
            
            this.workforceManager.jobRoles = this.workforceManager.jobRoles.filter(role => 
                !changes.jobRoles.removed.includes(role.id)
            );
            
            changes.jobRoles.added.forEach(role => {
                this.workforceManager.jobRoles.push(role);
            });
            
            changes.jobRoles.modified.forEach(modifiedRole => {
                const index = this.workforceManager.jobRoles.findIndex(role => role.id === modifiedRole.id);
                if (index !== -1) {
                    this.workforceManager.jobRoles[index] = modifiedRole;
                }
            });
        }

        // Apply schedule changes (most critical for performance)
        if (changes.schedules.added.length > 0 || changes.schedules.modified.length > 0 || changes.schedules.removed.length > 0) {
            console.log(`📝 Schedule changes: +${changes.schedules.added.length} ~${changes.schedules.modified.length} -${changes.schedules.removed.length}`);
            
            // Remove deleted schedules
            this.workforceManager.schedules = this.workforceManager.schedules.filter(sched => 
                !changes.schedules.removed.some(removed => 
                    removed.employeeId === sched.employeeId && removed.date === sched.date
                )
            );
            
            // Add new schedules
            changes.schedules.added.forEach(schedule => {
                this.workforceManager.schedules.push(schedule);
            });
            
            // Update modified schedules
            changes.schedules.modified.forEach(modifiedSchedule => {
                const index = this.workforceManager.schedules.findIndex(sched => 
                    sched.employeeId === modifiedSchedule.employeeId && sched.date === modifiedSchedule.date
                );
                if (index !== -1) {
                    this.workforceManager.schedules[index] = modifiedSchedule;
                }
            });
        }

        console.log('✅ Incremental changes applied successfully');
    }

    /**
     * Background Firebase sync (non-blocking)
     */
    async _backgroundSyncToFirebase() {
        try {
            const syncStartTime = performance.now();
            
            // Use batch operations if available, otherwise fallback to individual saves
            if (this.workforceManager.firebaseManager?.batchReplace) {
                const batchPromises = [
                    this.workforceManager.firebaseManager.batchReplace('employees', this.workforceManager.employees),
                    this.workforceManager.firebaseManager.batchReplace('shiftTypes', this.workforceManager.shiftTypes),
                    this.workforceManager.firebaseManager.batchReplace('jobRoles', this.workforceManager.jobRoles),
                    this.workforceManager.firebaseManager.batchReplace('schedules', this.workforceManager.schedules)
                ];
                
                await Promise.all(batchPromises);
            } else {
                // Fallback to individual saves
                this.workforceManager.dataManager.saveData('employees', this.workforceManager.employees);
                this.workforceManager.dataManager.saveData('shiftTypes', this.workforceManager.shiftTypes);
                this.workforceManager.dataManager.saveData('jobRoles', this.workforceManager.jobRoles);
                this.workforceManager.dataManager.saveData('schedules', this.workforceManager.schedules);
            }
            
            const syncTime = performance.now() - syncStartTime;
            console.log(`📸 Background Firebase sync completed in ${syncTime.toFixed(2)}ms`);
        } catch (error) {
            console.warn('⚠️ Background Firebase sync failed (non-critical):', error);
        }
    }

    /**
     * Update only the calendar cells that changed (targeted update)
     */
    _updateChangedCalendarCells() {
        try {
            // Get the current week dates
            const weekDates = this.workforceManager.calendarRenderer.getCurrentWeekDates();
            
            // Update each employee's shift cells for the current week
            this.workforceManager.employees.forEach(employee => {
                weekDates.forEach(date => {
                    const shiftCellId = `shift-${employee.id}-${date}`;
                    const shiftCell = document.getElementById(shiftCellId);
                    
                    if (shiftCell) {
                        // Find the schedule for this employee and date
                        const schedule = this.workforceManager.schedules.find(s => 
                            s.employeeId === employee.id && s.date === date
                        );
                        
                        if (schedule) {
                            // Find the shift type
                            const shiftType = this.workforceManager.shiftTypes.find(st => st.id === schedule.shiftId);
                            if (shiftType) {
                                // Update the cell content and styling
                                shiftCell.innerHTML = `
                                    <div class="shift-content" style="background-color: ${shiftType.color || '#3b82f6'}; color: white;">
                                        ${shiftType.name}
                                    </div>
                                `;
                                shiftCell.className = 'shift-cell has-shift';
                            }
                        } else {
                            // No schedule - clear the cell
                            shiftCell.innerHTML = '';
                            shiftCell.className = 'shift-cell';
                        }
                    }
                });
            });
            
            console.log('✅ Calendar cells updated successfully');
        } catch (error) {
            console.error('❌ Error updating calendar cells:', error);
        }
    }

    /**
     * Trigger minimal UI update for snapshot restore (no full calendar rebuild)
     */
    _triggerMinimalUIUpdate() {
        console.log('🔄 Starting minimal UI update for snapshot restore...');
        
        // Just update the essential UI elements without full calendar render
        try {
            // Update role badges and filters
            this.workforceManager.updateRoleBadgeStyles();
            this.workforceManager.filterManager.updateRoleFilters();
            
            // Update worker count summary without full calendar render
            const weekDates = this.workforceManager.calendarRenderer.getCurrentWeekDates();
            const workerCountData = this.workforceManager.calendarRenderer.preCalculateWorkerCounts(
                weekDates,
                new Map(this.workforceManager.schedules.map(schedule => [`${schedule.employeeId}_${schedule.date}`, schedule]))
            );
            this.workforceManager.calendarRenderer.renderWorkerCountSummaryWithData(weekDates, workerCountData);
            
            // Update the actual calendar cells that changed (targeted update, not full rebuild)
            console.log('📅 Updating changed calendar cells...');
            this._updateChangedCalendarCells();
            
            // Update other views
            if (this.workforceManager.viewRenderer) {
                this.workforceManager.viewRenderer.renderRolesView();
            }
            if (this.workforceManager.employeeManager) {
                this.workforceManager.employeeManager.renderUsersView();
            }
            
            console.log('✅ Minimal UI update completed');
        } catch (error) {
            console.error('❌ Error in minimal UI update:', error);
        }
    }

    /**
     * Progressive UI updates for better performance
     */
    _batchUIUpdates() {
        console.log('🔄 Starting progressive UI updates...');
        
        // Phase 1: Immediate updates (lightweight)
        requestAnimationFrame(() => {
            try {
                console.log('📱 Phase 1: Updating badges and filters...');
                this.workforceManager.updateRoleBadgeStyles();
                this.workforceManager.filterManager.updateRoleFilters();
                
                // Phase 2: Calendar rendering (most expensive)
                requestAnimationFrame(() => {
                    try {
                        console.log('📅 Phase 2: Rendering calendar...');
                        this.workforceManager.calendarRenderer.renderScheduleMatrix();
                        
                        // Phase 3: Other views (background)
                        requestAnimationFrame(() => {
                            try {
                                console.log('👥 Phase 3: Rendering other views...');
                                if (this.workforceManager.viewRenderer) {
                                    this.workforceManager.viewRenderer.renderRolesView();
                                }
                                if (this.workforceManager.employeeManager) {
                                    this.workforceManager.employeeManager.renderUsersView();
                                }
                                console.log('✅ All UI updates completed');
                            } catch (error) {
                                console.error('❌ Error in Phase 3 UI updates:', error);
                            }
                        });
                    } catch (error) {
                        console.error('❌ Error in Phase 2 UI updates:', error);
                    }
                });
            } catch (error) {
                console.error('❌ Error in Phase 1 UI updates:', error);
            }
        });
    }

    // Toggle filtering mode to show only changed shifts
    toggleFiltering() {
        this.isFiltering = !this.isFiltering;
        this.workforceManager.calendarRenderer.toggleShiftFiltering(this.isFiltering);
        
        // Update badge appearance
        const badge = document.getElementById('snapshotBadge');
        if (badge) {
            if (this.isFiltering) {
                badge.classList.add('filtering');
            } else {
                badge.classList.remove('filtering');
            }
            // Trigger mouseenter event to update tooltip
            badge.dispatchEvent(new Event('mouseenter'));
        }
    }
}

window.SnapshotManager = SnapshotManager;


