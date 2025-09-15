// Debug script for non-admin user calendar rendering issue
// Run this in the browser console on the second computer when logged in as non-admin

console.log('🔍 Starting non-admin debugging...');

async function debugNonAdminIssue() {
    try {
        console.log('=== AUTHENTICATION STATUS ===');
        const user = firebase.auth().currentUser;
        console.log('Current user:', user ? {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified
        } : 'No user');
        
        if (!user) {
            console.error('❌ No authenticated user found');
            return;
        }
        
        console.log('=== FIREBASE MANAGER STATUS ===');
        const authManager = window.authManager;
        const firebaseManager = window.workforceManager?.firebaseManager;
        
        if (!firebaseManager) {
            console.error('❌ Firebase manager not found');
            return;
        }
        
        console.log('Current org ID:', firebaseManager.currentOrgId);
        console.log('Firebase manager initialized:', !!firebaseManager.db);
        
        console.log('=== ORGANIZATION MEMBERSHIP ===');
        const SHARED_ORG_ID = 'shared-org-sicu-scheduler';
        const orgRef = firebaseManager.db.collection('organizations').doc(SHARED_ORG_ID);
        const orgDoc = await orgRef.get();
        
        if (!orgDoc.exists) {
            console.error('❌ Shared organization does not exist');
            return;
        }
        
        const orgData = orgDoc.data();
        console.log('Organization data:', {
            name: orgData.name,
            members: orgData.members,
            isUserMember: orgData.members?.includes(user.uid) || false
        });
        
        console.log('=== USER DOCUMENT ===');
        const userDoc = await firebaseManager.db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('User document:', {
                email: userData.email,
                approved: userData.approved,
                defaultOrgId: userData.defaultOrgId,
                organizations: userData.organizations
            });
        } else {
            console.error('❌ User document does not exist');
        }
        
        console.log('=== DATA LOADING TEST ===');
        console.log('Testing data loading from shared organization...');
        
        try {
            const [employeesSnapshot, shiftTypesSnapshot, jobRolesSnapshot, schedulesSnapshot] = await Promise.all([
                orgRef.collection('employees').get(),
                orgRef.collection('shiftTypes').get(),
                orgRef.collection('jobRoles').get(),
                orgRef.collection('schedules').get()
            ]);
            
            console.log('Data loaded successfully:', {
                employees: employeesSnapshot.docs.length,
                shiftTypes: shiftTypesSnapshot.docs.length,
                jobRoles: jobRolesSnapshot.docs.length,
                schedules: schedulesSnapshot.docs.length
            });
            
            if (employeesSnapshot.docs.length === 0 && schedulesSnapshot.docs.length === 0) {
                console.warn('⚠️ No data found in shared organization - this explains why calendar is empty');
            } else {
                console.log('✅ Data is available - calendar should render');
            }
            
        } catch (dataError) {
            console.error('❌ Failed to load data from Firestore:', dataError);
        }
        
        console.log('=== WORKFORCE MANAGER STATUS ===');
        const workforceManager = window.workforceManager;
        if (workforceManager) {
            console.log('Workforce manager data:', {
                employees: workforceManager.employees?.length || 0,
                shiftTypes: workforceManager.shiftTypes?.length || 0,
                jobRoles: workforceManager.jobRoles?.length || 0,
                schedules: workforceManager.schedules?.length || 0,
                initialLoadComplete: workforceManager.initialLoadComplete
            });
        } else {
            console.error('❌ Workforce manager not found');
        }
        
        console.log('=== UI ELEMENTS ===');
        const appContainer = document.getElementById('appContainer');
        const authContainer = document.getElementById('authContainer');
        const pendingContainer = document.getElementById('pendingContainer');
        
        console.log('UI containers:', {
            appContainer: appContainer ? 'visible' : 'hidden',
            authContainer: authContainer ? 'visible' : 'hidden',
            pendingContainer: pendingContainer ? 'visible' : 'hidden'
        });
        
        console.log('=== RECOMMENDATIONS ===');
        if (!orgData.members?.includes(user.uid)) {
            console.log('🔧 Fix: Add user to organization members');
        }
        if (!userDoc.exists || !userDoc.data()?.approved) {
            console.log('🔧 Fix: Approve user in admin panel');
        }
        if (employeesSnapshot.docs.length === 0) {
            console.log('🔧 Fix: Import data as admin first');
        }
        
    } catch (error) {
        console.error('❌ Debug script failed:', error);
    }
}

// Run the debug script
debugNonAdminIssue();
