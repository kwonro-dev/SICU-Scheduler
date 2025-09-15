// Migration utility to consolidate all organizations into a single shared organization
// Run this in the browser console on your development computer to migrate existing data

async function migrateToSharedOrganization() {
    console.log('🔄 Starting migration to shared organization...');
    
    if (!window.workforceManager || !window.workforceManager.firebaseManager) {
        console.error('❌ WorkforceManager not available. Make sure you are signed in.');
        return;
    }
    
    const firebaseManager = window.workforceManager.firebaseManager;
    const db = firebaseManager.db;
    const SHARED_ORG_ID = 'shared-org-sicu-scheduler';
    
    try {
        // Get all organizations
        const orgsSnapshot = await db.collection('organizations').get();
        console.log(`Found ${orgsSnapshot.size} organizations`);
        
        if (orgsSnapshot.empty) {
            console.log('✅ No organizations found. Nothing to migrate.');
            return;
        }
        
        // Check if shared organization already exists
        const sharedOrgDoc = await db.collection('organizations').doc(SHARED_ORG_ID).get();
        
        let sharedOrgData = null;
        let allMembers = new Set();
        
        if (sharedOrgDoc.exists) {
            sharedOrgData = sharedOrgDoc.data();
            console.log('✅ Shared organization already exists');
            // Add existing members to the set
            if (sharedOrgData.members) {
                sharedOrgData.members.forEach(member => allMembers.add(member));
            }
        }
        
        // Process each organization
        for (const orgDoc of orgsSnapshot.docs) {
            const orgId = orgDoc.id;
            const orgData = orgDoc.data();
            
            if (orgId === SHARED_ORG_ID) {
                console.log(`⏭️ Skipping shared organization: ${orgId}`);
                continue;
            }
            
            console.log(`🔄 Processing organization: ${orgId}`);
            
            // Collect members
            if (orgData.members) {
                orgData.members.forEach(member => allMembers.add(member));
            }
            
            // Migrate data from this organization's subcollections
            const collections = ['employees', 'shiftTypes', 'jobRoles', 'schedules'];
            
            for (const collection of collections) {
                const subcollectionRef = db.collection('organizations').doc(orgId).collection(collection);
                const snapshot = await subcollectionRef.get();
                
                if (snapshot.empty) {
                    console.log(`  ⏭️ No ${collection} found in ${orgId}`);
                    continue;
                }
                
                console.log(`  📦 Migrating ${snapshot.size} ${collection} from ${orgId}`);
                
                // Create or update shared organization subcollection
                const sharedSubcollectionRef = db.collection('organizations').doc(SHARED_ORG_ID).collection(collection);
                const batch = db.batch();
                
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const newDocRef = sharedSubcollectionRef.doc(doc.id);
                    batch.set(newDocRef, data);
                });
                
                await batch.commit();
                console.log(`  ✅ Migrated ${snapshot.size} ${collection}`);
            }
            
            // Delete the old organization and its subcollections
            console.log(`🗑️ Deleting organization: ${orgId}`);
            
            // Delete subcollections first
            for (const collection of collections) {
                const subcollectionRef = db.collection('organizations').doc(orgId).collection(collection);
                const snapshot = await subcollectionRef.get();
                
                if (!snapshot.empty) {
                    const deleteBatch = db.batch();
                    snapshot.docs.forEach(doc => {
                        deleteBatch.delete(doc.ref);
                    });
                    await deleteBatch.commit();
                }
            }
            
            // Delete the organization document
            await db.collection('organizations').doc(orgId).delete();
            console.log(`✅ Deleted organization: ${orgId}`);
        }
        
        // Create or update the shared organization with all members
        if (!sharedOrgDoc.exists) {
            console.log('🆕 Creating shared organization...');
            await db.collection('organizations').doc(SHARED_ORG_ID).set({
                name: 'SICU Schedule Manager - Shared Organization',
                createdAt: new Date().toISOString(),
                createdBy: Array.from(allMembers)[0] || 'unknown',
                members: Array.from(allMembers),
                settings: {
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    defaultTimeInterval: 48
                }
            });
        } else {
            // Update existing shared organization with all members
            console.log('🔄 Updating shared organization members...');
            await db.collection('organizations').doc(SHARED_ORG_ID).update({
                members: Array.from(allMembers)
            });
        }
        
        // Update all users to reference the shared organization
        console.log('🔄 Updating user documents...');
        const usersSnapshot = await db.collection('users').get();
        const userUpdateBatch = db.batch();
        
        usersSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            userUpdateBatch.update(doc.ref, {
                defaultOrgId: SHARED_ORG_ID,
                organizations: [SHARED_ORG_ID]
            });
        });
        
        await userUpdateBatch.commit();
        
        console.log('✅ Migration completed successfully!');
        console.log(`📊 Final stats:`);
        console.log(`  - Shared organization: ${SHARED_ORG_ID}`);
        console.log(`  - Total members: ${allMembers.size}`);
        
        // Refresh the current app
        console.log('🔄 Refreshing app...');
        window.location.reload();
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

// Export for use
window.migrateToSharedOrganization = migrateToSharedOrganization;

console.log('📋 Migration utility loaded. Run migrateToSharedOrganization() to start migration.');
