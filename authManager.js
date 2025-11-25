class AuthManager {
    constructor() {
        // Check if Firebase is available
        if (!window.firebaseAuth || !window.firebaseDb) {
            throw new Error('Firebase not initialized. Make sure firebase-config.js is loaded first.');
        }
        
        this.auth = window.firebaseAuth;
        this.db = window.firebaseDb;
        this.user = null;
        this.adminEmails = new Set(["kwonro@gmail.com"]);
        this.appInitialized = false; // Flag to prevent multiple app initializations
        this.initAuthUI();
        this.observeAuthState();
    }

    initAuthUI() {
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const adminBtn = document.getElementById('adminBtn');
        const emailEl = document.getElementById('authEmail');
        const passEl = document.getElementById('authPassword');
        const errorEl = document.getElementById('authError');
        const successEl = document.getElementById('authSuccess');
        const forgotPasswordLink = document.getElementById('forgotPasswordLink');


        // Verification UI
        this.verifyContainer = document.getElementById('verifyContainer');
        this.verifyMessage = document.getElementById('verifyMessage');
        this.verifyError = document.getElementById('verifyError');
        this.verifySuccess = document.getElementById('verifySuccess');
        const resendBtn = document.getElementById('resendVerifyBtn');
        const refreshBtn = document.getElementById('refreshVerifyBtn');
        const verifySignOutBtn = document.getElementById('verifySignOutBtn');

        // Pending approval UI
        this.pendingContainer = document.getElementById('pendingContainer');
        this.pendingMessage = document.getElementById('pendingMessage');
        const pendingRefreshBtn = document.getElementById('pendingRefreshBtn');
        const pendingSignOutBtn = document.getElementById('pendingSignOutBtn');

        if (pendingRefreshBtn) {
            pendingRefreshBtn.onclick = () => this.checkApprovalStatus(true);
        }
        if (pendingSignOutBtn) {
            pendingSignOutBtn.onclick = async () => { try { await this.auth.signOut(); } catch (_) {} };
        }

        const showError = (msg) => {
            if (!errorEl) return;
            if (successEl) successEl.style.display = 'none';
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        };

        const showSuccess = (msg) => {
            if (!successEl) return;
            if (errorEl) errorEl.style.display = 'none';
            successEl.textContent = msg;
            successEl.style.display = 'block';
        };

        // Forgot Password handler
        if (forgotPasswordLink) {
            forgotPasswordLink.addEventListener('click', async (e) => {
                e.preventDefault();
                const email = emailEl ? emailEl.value.trim() : '';
                
                if (!email) {
                    showError('Please enter your email address first, then click "Forgot Password?"');
                    return;
                }
                
                try {
                    await this.auth.sendPasswordResetEmail(email);
                    showSuccess(`Password reset email sent to ${email}. Check your inbox (and spam folder).`);
                } catch (err) {
                    if (err.code === 'auth/user-not-found') {
                        showError('No account found with this email address. Please check your email or register a new account.');
                    } else if (err.code === 'auth/invalid-email') {
                        showError('Invalid email address format.');
                    } else if (err.code === 'auth/too-many-requests') {
                        showError('Too many requests. Please wait a few minutes before trying again.');
                    } else {
                        showError(this.humanizeError(err));
                    }
                }
            });
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                errorEl && (errorEl.style.display = 'none');
                try {
                    const email = emailEl.value.trim();
                    await this.auth.signInWithEmailAndPassword(email, passEl.value);
                    // Ensure user document exists in Firestore
                    await this.ensureUserDocument();
                } catch (e) {
                    // Provide clear error messages for login failures
                    if (e.code === 'auth/user-not-found') {
                        showError('No account found with this email address. Please check your email or register a new account.');
                    } else if (e.code === 'auth/wrong-password') {
                        showError('Incorrect password. Please try again.');
                    } else if (e.code === 'auth/invalid-email') {
                        showError('Invalid email address format.');
                    } else if (e.code === 'auth/too-many-requests') {
                        showError('Too many failed attempts. Please try again later.');
                    } else {
                        showError(this.humanizeError(e));
                    }
                }
            });
        }

        if (registerBtn) {
            registerBtn.addEventListener('click', async () => {
                errorEl && (errorEl.style.display = 'none');
                try {
                    const email = emailEl.value.trim();
                    const cred = await this.auth.createUserWithEmailAndPassword(email, passEl.value);
                    if (cred && cred.user) {
                        // Create user doc as pending
                        await this.db.collection('users').doc(cred.user.uid).set({
                            email,
                            createdAt: new Date().toISOString(),
                            approved: false,
                            approvedBy: null,
                            approvedAt: null,
                            roles: [],
                        }, { merge: true });

                        // Sign out and show pending gate (skip email verification for now)
                        await this.auth.signOut();
                        this.showPendingGate(email);
                    }
                } catch (e) {
                    if (e.code === 'auth/email-already-in-use') {
                        showError('Email already in use. Please use the Login button instead.');
                    } else {
                        showError(this.humanizeError(e));
                    }
                }
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await this.auth.signOut();
                } catch (e) {
                    console.warn('Logout failed', e);
                }
            });
        }

        if (adminBtn) {
            adminBtn.addEventListener('click', () => this.openAdminPanel());
        }
    }

    observeAuthState() {
        const authContainer = document.getElementById('authContainer');
        const appContainer = document.getElementById('appContainer');
        const logoutBtn = document.getElementById('logoutBtn');

        this.auth.onAuthStateChanged((user) => {
            this.user = user || null;
            console.log('🔐 Auth state changed - User object:', user);
            console.log('🔐 User details:', {
                uid: user?.uid,
                email: user?.email,
                displayName: user?.displayName,
                emailVerified: user?.emailVerified
            });
            
            if (this.user && this.user.uid && this.user.email) {
                console.log('🔐 User is fully authenticated:', this.user.email);
                // Admins can bypass approval; everyone else requires approval
                const isAdmin = this.adminEmails.has((this.user.email || '').toLowerCase());
                if (!isAdmin) {
                    // Check admin approval (skip email verification for now)
                    this.checkApprovalStatus();
                    return;
                }
                if (authContainer) authContainer.style.display = 'none';
                if (this.verifyContainer) this.verifyContainer.style.display = 'none';
                if (this.pendingContainer) this.pendingContainer.style.display = 'none';
                if (appContainer) appContainer.style.display = '';
                if (logoutBtn) logoutBtn.style.display = '';
                const adminBtn = document.getElementById('adminBtn');
                if (adminBtn) adminBtn.style.display = '';
                // Bootstrap app if not already created and not already initialized
                if (!window.workforceManager && !this.appInitialized) {
                    // Small delay to ensure all scripts are loaded
                    setTimeout(() => {
                        try {
                            if (typeof ModalManager !== 'undefined' &&
                                typeof UIManager !== 'undefined' &&
                                typeof ImportManager !== 'undefined' &&
                                typeof EmployeeManager !== 'undefined' &&
                                typeof CalendarRenderer !== 'undefined' &&
                                typeof ViewRenderer !== 'undefined') {
                                
                                // Double-check user is still authenticated
                                if (!this.user || !this.user.uid || !this.user.email) {
                                    console.warn('🔐 User not fully authenticated, skipping app initialization');
                                    return;
                                }
                                
                                console.log('🔐 Creating WorkforceScheduleManager...');
                                window.workforceManager = new WorkforceScheduleManager();
                                window.workforceManager.authManager = this; // Attach authManager
                                console.log('🔐 AuthManager attached to workforceManager:', window.workforceManager.authManager);
                                this.appInitialized = true;
                                
                                // Initialize Firebase and activity logger asynchronously
                                (async () => {
                                    try {
                                        // Initialize Firebase now that user is authenticated
                                        console.log('🔐 User authenticated, initializing Firebase...');
                                        await window.workforceManager.initializeFirebase();
                                        
                                        // Small delay to ensure user object is fully set
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                        
                                        // Double-check user is still available
                                        console.log('🔐 Final user check:', this.user);
                                        if (!this.user || !this.user.uid || !this.user.email) {
                                            console.warn('🔐 User not available after delay, skipping activity logger');
                                            return;
                                        }
                                        
                                        // Initialize activity logger now that Firebase is ready
                                        console.log('🔐 Initializing activity logger...');
                                        await window.workforceManager.activityManager.initializeActivityLogger();
                                        
                                        // Update role filters now that Firebase is available
                                        window.workforceManager.filterManager.updateRoleFilters(true);

                                        // Update activity logger user info if it exists
                                        if (window.workforceManager.activityManager.activityLogger) {
                                            console.log('🔐 Updating activity logger user info after auth...');
                                            window.workforceManager.activityManager.activityLogger.updateUserInfo();
                                        }
                                    } catch (error) {
                                        console.error('❌ Error during post-auth initialization:', error);
                                    }
                                })();
                            } else {
                                console.error('Required classes not loaded yet, retrying...');
                                // Retry after another delay
                                setTimeout(() => {
                                    try {
                                        // Double-check user is still authenticated
                                        if (!this.user || !this.user.uid || !this.user.email) {
                                            console.warn('🔐 User not fully authenticated (retry), skipping app initialization');
                                            return;
                                        }
                                        
                                        console.log('🔐 Creating WorkforceScheduleManager (retry)...');
                                        window.workforceManager = new WorkforceScheduleManager();
                                        window.workforceManager.authManager = this; // Attach authManager
                                        this.appInitialized = true;
                                        
                                        // Initialize Firebase and activity logger asynchronously
                                        (async () => {
                                            try {
                                                // Initialize Firebase now that user is authenticated
                                                console.log('🔐 User authenticated, initializing Firebase (retry)...');
                                                await window.workforceManager.initializeFirebase();
                                                
                                                // Small delay to ensure user object is fully set
                                                await new Promise(resolve => setTimeout(resolve, 100));
                                                
                                                // Double-check user is still available
                                                console.log('🔐 Final user check (retry):', this.user);
                                                if (!this.user || !this.user.uid || !this.user.email) {
                                                    console.warn('🔐 User not available after delay (retry), skipping activity logger');
                                                    return;
                                                }
                                                
                                                // Initialize activity logger now that Firebase is ready
                                                console.log('🔐 Initializing activity logger (retry)...');
                                                await window.workforceManager.activityManager.initializeActivityLogger();
                                                
                                                // Update role filters now that Firebase is available
                                                window.workforceManager.filterManager.updateRoleFilters(true);

                                                // Update activity logger user info if it exists
                                                if (window.workforceManager.activityManager.activityLogger) {
                                                    console.log('🔐 Updating activity logger user info after auth (retry)...');
                                                    window.workforceManager.activityManager.activityLogger.updateUserInfo();
                                                }
                                            } catch (error) {
                                                console.error('❌ Error during post-auth initialization (retry):', error);
                                            }
                                        })();
                                    } catch (e) {
                                        console.error('Failed to init app after auth (retry)', e);
                                    }
                                }, 100);
                            }
                        } catch (e) {
                            console.error('Failed to init app after auth', e);
                        }
                    }, 50);
                }
            } else {
                if (appContainer) appContainer.style.display = 'none';
                if (authContainer) authContainer.style.display = '';
                if (this.verifyContainer) this.verifyContainer.style.display = 'none';
                if (this.pendingContainer) this.pendingContainer.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'none';
                const adminBtn = document.getElementById('adminBtn');
                if (adminBtn) adminBtn.style.display = 'none';
            }
        });
    }

    showPendingGate(email) {
        const authContainer = document.getElementById('authContainer');
        const appContainer = document.getElementById('appContainer');
        if (appContainer) appContainer.style.display = 'none';
        if (authContainer) authContainer.style.display = 'none';
        if (this.verifyContainer) this.verifyContainer.style.display = 'none';
        if (this.pendingContainer) this.pendingContainer.style.display = '';
        if (this.pendingMessage) this.pendingMessage.textContent = `Your account (${email}) is pending approval by an administrator.`;
    }

    showVerifyGate(email) {
        const authContainer = document.getElementById('authContainer');
        const appContainer = document.getElementById('appContainer');
        if (appContainer) appContainer.style.display = 'none';
        if (authContainer) authContainer.style.display = 'none';
        if (this.verifyContainer) this.verifyContainer.style.display = '';
        if (this.verifyMessage) this.verifyMessage.textContent = `We've sent a verification link to ${email}. Please verify to continue.`;

        const resendBtn = document.getElementById('resendVerifyBtn');
        const refreshBtn = document.getElementById('refreshVerifyBtn');
        const signOutBtn = document.getElementById('verifySignOutBtn');

        if (resendBtn) {
            resendBtn.onclick = async () => {
                this.verifyError && (this.verifyError.style.display = 'none');
                this.verifySuccess && (this.verifySuccess.style.display = 'none');
                try {
                    const current = this.auth.currentUser;
                    if (current) {
                        await current.sendEmailVerification();
                        if (this.verifySuccess) {
                            this.verifySuccess.textContent = 'Verification email sent again.';
                            this.verifySuccess.style.display = 'block';
                        }
                    } else {
                        // User signed out after registration; sign in silently if possible
                        if (this.verifyError) {
                            this.verifyError.textContent = 'Please log in again to resend verification.';
                            this.verifyError.style.display = 'block';
                        }
                    }
                } catch (e) {
                    if (this.verifyError) {
                        this.verifyError.textContent = this.humanizeError(e);
                        this.verifyError.style.display = 'block';
                    }
                }
            };
        }

        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                try {
                    await this.auth.currentUser?.reload();
                    // onAuthStateChanged will re-fire with updated emailVerified
                    if (this.auth.currentUser && this.auth.currentUser.emailVerified) {
                        // will be handled in observer
                    }
                } catch (e) {
                    if (this.verifyError) {
                        this.verifyError.textContent = this.humanizeError(e);
                        this.verifyError.style.display = 'block';
                    }
                }
            };
        }

        if (signOutBtn) {
            signOutBtn.onclick = async () => {
                try { await this.auth.signOut(); } catch (_) {}
            };
        }
    }

    async ensureUserDocument() {
        if (!this.user) return;
        try {
            const userRef = this.db.collection('users').doc(this.user.uid);
            const snap = await userRef.get();
            const userData = snap.exists ? snap.data() : {};
            const isAdmin = this.adminEmails.has((this.user.email || '').toLowerCase());
            
            console.log('🔐 Ensuring user document:', {
                uid: this.user.uid,
                email: this.user.email,
                isAdmin: isAdmin,
                existingUserData: userData,
                documentExists: snap.exists
            });
            
            if (!snap.exists || !userData.defaultOrgId) {
                // Use the same fixed organization ID for the shared organization
                const SHARED_ORG_ID = 'shared-org-sicu-scheduler';
                let sharedOrgId = SHARED_ORG_ID;
                
                // Check if shared organization exists
                const orgDoc = await this.db.collection('organizations').doc(SHARED_ORG_ID).get();
                
                if (!orgDoc.exists && isAdmin) {
                    // Only admins can create the initial shared organization
                    await this.db.collection('organizations').doc(SHARED_ORG_ID).set({
                        name: 'SICU Schedule Manager - Shared Organization',
                        createdAt: new Date().toISOString(),
                        createdBy: this.user.uid,
                        members: [this.user.uid],
                        settings: {
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                            defaultTimeInterval: 48
                        }
                    });
                }
                
                // Create or update user document
                // For non-admin users, ensure they are not approved unless explicitly approved by an admin
                const userUpdate = {
                    ...userData,
                    email: this.user.email,
                    createdAt: userData.createdAt || new Date().toISOString(),
                    roles: userData.roles || [],
                    defaultOrgId: sharedOrgId,
                    organizations: sharedOrgId ? [sharedOrgId] : userData.organizations || []
                };
                
                // Only set approval fields if user is admin or if they were previously approved by an admin
                if (isAdmin) {
                    userUpdate.approved = true;
                    userUpdate.approvedBy = this.user.email;
                    userUpdate.approvedAt = new Date().toISOString();
                } else {
                    // For non-admin users, only set approved to true if they were previously approved by an admin
                    // Otherwise, ensure they are not approved
                    if (userData.approved && userData.approvedBy && userData.approvedBy !== this.user.email) {
                        // User was previously approved by an admin, keep their approval status
                        userUpdate.approved = true;
                        userUpdate.approvedBy = userData.approvedBy;
                        userUpdate.approvedAt = userData.approvedAt;
                    } else {
                        // User is not approved or was self-approved (which shouldn't happen)
                        userUpdate.approved = false;
                        userUpdate.approvedBy = userData.approvedBy || null;
                        userUpdate.approvedAt = userData.approvedAt || null;
                    }
                }
                
                console.log('🔐 Updating user document with:', userUpdate);
                await userRef.set(userUpdate, { merge: true });
                
                // Add user to shared organization members (both admin and regular users)
                if (sharedOrgId) {
                    const orgRef = this.db.collection('organizations').doc(sharedOrgId);
                    const orgDoc = await orgRef.get();
                    if (orgDoc.exists) {
                        const orgData = orgDoc.data();
                        const members = orgData.members || [];
                        if (!members.includes(this.user.uid)) {
                            members.push(this.user.uid);
                            await orgRef.update({ members });
                            console.log(`✅ Added ${isAdmin ? 'admin' : 'regular'} user to shared organization members:`, this.user.uid);
                        } else {
                            console.log(`✅ User already in shared organization members:`, this.user.uid);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to ensure user document', e);
        }
    }

    async checkApprovalStatus(forceShowPending = false) {
        try {
            const authContainer = document.getElementById('authContainer');
            const appContainer = document.getElementById('appContainer');
            const adminBtn = document.getElementById('adminBtn');
            if (!this.user) return;
            
            // Ensure user document exists first
            await this.ensureUserDocument();
            
            const snap = await this.db.collection('users').doc(this.user.uid).get();
            const data = snap.exists ? snap.data() : {};
            const approved = !!data.approved;
            
            console.log('🔐 Checking approval status for user:', {
                uid: this.user.uid,
                email: this.user.email,
                isAdmin: this.adminEmails.has((this.user.email || '').toLowerCase()),
                approved: approved,
                userData: data,
                forceShowPending: forceShowPending
            });
            
            if (!approved || forceShowPending) {
                if (appContainer) appContainer.style.display = 'none';
                if (authContainer) authContainer.style.display = 'none';
                if (this.verifyContainer) this.verifyContainer.style.display = 'none';
                if (this.pendingContainer) this.pendingContainer.style.display = '';
                if (adminBtn) adminBtn.style.display = 'none';
            } else {
                console.log('🔐 User is approved, initializing app...');
                if (this.pendingContainer) this.pendingContainer.style.display = 'none';
                const logoutBtn = document.getElementById('logoutBtn');
                if (authContainer) authContainer.style.display = 'none';
                if (appContainer) appContainer.style.display = '';
                if (logoutBtn) logoutBtn.style.display = '';
                if (adminBtn) adminBtn.style.display = this.adminEmails.has((this.user.email || '').toLowerCase()) ? '' : 'none';
                
                // Initialize app for approved non-admin users
                if (!window.workforceManager && !this.appInitialized) {
                    // Small delay to ensure all scripts are loaded
                    setTimeout(() => {
                        try {
                            if (typeof ModalManager !== 'undefined' &&
                                typeof UIManager !== 'undefined' &&
                                typeof ImportManager !== 'undefined' &&
                                typeof EmployeeManager !== 'undefined' &&
                                typeof CalendarRenderer !== 'undefined' &&
                                typeof ViewRenderer !== 'undefined') {
                                
                                // Double-check user is still authenticated
                                if (!this.user || !this.user.uid || !this.user.email) {
                                    console.warn('🔐 User not fully authenticated, skipping app initialization');
                                    return;
                                }
                                
                                console.log('🔐 Creating WorkforceScheduleManager for approved user...');
                                window.workforceManager = new WorkforceScheduleManager();
                                window.workforceManager.authManager = this; // Attach authManager
                                console.log('🔐 AuthManager attached to workforceManager:', window.workforceManager.authManager);
                                this.appInitialized = true;
                                
                                // Initialize Firebase and activity logger asynchronously
                                (async () => {
                                    try {
                                        // Initialize Firebase now that user is authenticated
                                        console.log('🔐 User authenticated, initializing Firebase...');
                                        await window.workforceManager.initializeFirebase();
                                        
                                        // Small delay to ensure user object is fully set
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                        
                                        // Double-check user is still available
                                        console.log('🔐 Final user check:', this.user);
                                        if (!this.user || !this.user.uid || !this.user.email) {
                                            console.warn('🔐 User not available after delay, skipping activity logger');
                                            return;
                                        }
                                        
                                        // Initialize activity logger now that Firebase is ready
                                        console.log('🔐 Initializing activity logger...');
                                        await window.workforceManager.activityManager.initializeActivityLogger();
                                        
                                        // Update role filters now that Firebase is available
                                        window.workforceManager.filterManager.updateRoleFilters(true);

                                        // Update activity logger user info if it exists
                                        if (window.workforceManager.activityManager.activityLogger) {
                                            console.log('🔐 Updating activity logger user info after auth...');
                                            window.workforceManager.activityManager.activityLogger.updateUserInfo();
                                        }
                                    } catch (error) {
                                        console.error('❌ Error during post-auth initialization:', error);
                                    }
                                })();
                            } else {
                                console.error('Required classes not loaded yet, retrying...');
                                // Retry after another delay
                                setTimeout(() => {
                                    try {
                                        // Double-check user is still authenticated
                                        if (!this.user || !this.user.uid || !this.user.email) {
                                            console.warn('🔐 User not fully authenticated (retry), skipping app initialization');
                                            return;
                                        }
                                        
                                        console.log('🔐 Creating WorkforceScheduleManager for approved user (retry)...');
                                        window.workforceManager = new WorkforceScheduleManager();
                                        window.workforceManager.authManager = this; // Attach authManager
                                        this.appInitialized = true;
                                        
                                        // Initialize Firebase and activity logger asynchronously
                                        (async () => {
                                            try {
                                                // Initialize Firebase now that user is authenticated
                                                console.log('🔐 User authenticated, initializing Firebase (retry)...');
                                                await window.workforceManager.initializeFirebase();
                                                
                                                // Small delay to ensure user object is fully set
                                                await new Promise(resolve => setTimeout(resolve, 100));
                                                
                                                // Double-check user is still available
                                                console.log('🔐 Final user check (retry):', this.user);
                                                if (!this.user || !this.user.uid || !this.user.email) {
                                                    console.warn('🔐 User not available after delay (retry), skipping activity logger');
                                                    return;
                                                }
                                                
                                                // Initialize activity logger now that Firebase is ready
                                                console.log('🔐 Initializing activity logger (retry)...');
                                                await window.workforceManager.activityManager.initializeActivityLogger();
                                                
                                                // Update role filters now that Firebase is available
                                                window.workforceManager.filterManager.updateRoleFilters(true);

                                                // Update activity logger user info if it exists
                                                if (window.workforceManager.activityManager.activityLogger) {
                                                    console.log('🔐 Updating activity logger user info after auth (retry)...');
                                                    window.workforceManager.activityManager.activityLogger.updateUserInfo();
                                                }
                                            } catch (error) {
                                                console.error('❌ Error during post-auth initialization (retry):', error);
                                            }
                                        })();
                                    } catch (e) {
                                        console.error('Failed to init app after auth (retry)', e);
                                    }
                                }, 100);
                            }
                        } catch (e) {
                            console.error('Failed to init app after auth', e);
                        }
                    }, 50);
                }
            }
        } catch (e) {
            console.warn('Approval check failed', e);
        }
    }

    humanizeError(e) {
        const code = e && e.code ? String(e.code) : '';
        if (code.includes('auth/invalid-email')) return 'Invalid email address';
        if (code.includes('auth/user-not-found')) return 'No account found for this email';
        if (code.includes('auth/wrong-password')) return 'Incorrect password';
        if (code.includes('auth/email-already-in-use')) return 'Email already in use';
        if (code.includes('auth/weak-password')) return 'Password should be at least 6 characters';
        return e && e.message ? e.message : 'Authentication error';
    }

    async openAdminPanel() {
        if (!this.user || !this.adminEmails.has((this.user.email || '').toLowerCase())) return;
        
        const adminModal = document.getElementById('adminModal');
        if (!adminModal) return;

        adminModal.classList.add('active');
        
        // Setup modal close
        const closeBtn = document.getElementById('closeAdminModal');
        closeBtn && (closeBtn.onclick = () => adminModal.classList.remove('active'));

        // Setup tab switching
        this.setupAdminTabs();
        
        // Setup admin settings
        this.setupAdminSettings();
        
        // Load initial data
        await this.loadPendingUsers();
        await this.loadAllUsers();
    }

    setupAdminTabs() {
        const tabs = ['adminTabPending', 'adminTabUsers', 'adminTabSettings'];
        const contents = ['adminTabPendingContent', 'adminTabUsersContent', 'adminTabSettingsContent'];

        tabs.forEach((tabId, index) => {
            const tab = document.getElementById(tabId);
            const content = document.getElementById(contents[index]);
            
            if (tab && content) {
                tab.onclick = () => {
                    // Remove active class from all tabs and contents
                    tabs.forEach(t => {
                        const tEl = document.getElementById(t);
                        if (tEl) tEl.classList.remove('active');
                    });
                    contents.forEach(c => {
                        const cEl = document.getElementById(c);
                        if (cEl) cEl.classList.remove('active');
                    });
                    
                    // Add active class to clicked tab and content
                    tab.classList.add('active');
                    content.classList.add('active');
                };
            }
        });

        // Setup refresh button
        const refreshBtn = document.getElementById('refreshUsersBtn');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.loadAllUsers();
        }

        // Setup user filter
        const filterSelect = document.getElementById('adminUserFilter');
        if (filterSelect) {
            filterSelect.onchange = () => this.loadAllUsers();
        }

        // Setup clear pending button in pending tab
        const clearPendingBtn = document.getElementById('clearPendingBtn');
        if (clearPendingBtn) {
            clearPendingBtn.onclick = () => this.clearAllPendingUsers();
        }
    }

    setupAdminSettings() {
        // Load current admin emails
        const adminEmailsList = document.getElementById('adminEmailsList');
        if (adminEmailsList) {
            adminEmailsList.value = Array.from(this.adminEmails).join(', ');
        }

        // Update admin emails button
        const updateBtn = document.getElementById('updateAdminEmails');
        if (updateBtn) {
            updateBtn.onclick = () => this.updateAdminEmails();
        }


        // Clear pending users button (now in pending tab)
        const clearBtn = document.getElementById('clearPendingBtn');
        if (clearBtn) {
            clearBtn.onclick = () => this.clearAllPendingUsers();
        }
    }

    async loadPendingUsers() {
        const pendingList = document.getElementById('pendingUsersList');
        if (!pendingList) return;

        try {
            pendingList.textContent = 'Loading...';
            const qs = await this.db.collection('users').where('approved', '==', false).limit(100).get();
            
            if (qs.empty) {
                pendingList.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><h3>No Pending Users</h3><p>All users have been processed.</p></div>';
                return;
            }

            const frag = document.createDocumentFragment();
            qs.forEach(doc => {
                const data = doc.data() || {};
                const userItem = this.createUserListItem(doc.id, data, true); // true for pending users
                frag.appendChild(userItem);
            });
            
            pendingList.innerHTML = '';
            pendingList.appendChild(frag);
        } catch (e) {
            pendingList.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><h3>Error Loading Users</h3><p>Failed to load pending users. Please try again.</p></div>';
            console.error('Error loading pending users:', e);
        }
    }

    async loadAllUsers() {
        const allUsersList = document.getElementById('allUsersList');
        if (!allUsersList) return;

        try {
            allUsersList.textContent = 'Loading...';
            const qs = await this.db.collection('users').limit(200).get();
            
            if (qs.empty) {
                allUsersList.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><h3>No Users Found</h3><p>No users have registered yet.</p></div>';
                return;
            }

            const filterSelect = document.getElementById('adminUserFilter');
            const filter = filterSelect ? filterSelect.value : 'all';
            
            const frag = document.createDocumentFragment();
            qs.forEach(doc => {
                const data = doc.data() || {};
                
                // Apply filter
                if (filter === 'approved' && !data.approved) return;
                if (filter === 'pending' && data.approved) return;
                
                const userItem = this.createUserListItem(doc.id, data, false); // false for all users view
                frag.appendChild(userItem);
            });
            
            allUsersList.innerHTML = '';
            allUsersList.appendChild(frag);
        } catch (e) {
            allUsersList.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i><h3>Error Loading Users</h3><p>Failed to load users. Please try again.</p></div>';
            console.error('Error loading all users:', e);
        }
    }

    createUserListItem(userId, userData, isPendingView = false) {
        const item = document.createElement('div');
        item.className = 'user-list-item';
        
        const email = userData.email || '(no email)';
        const createdAt = new Date(userData.createdAt || Date.now()).toLocaleString();
        const approved = !!userData.approved;
        const isAdmin = this.adminEmails.has(email.toLowerCase());
        
        // Determine status
        let statusClass = 'pending';
        let statusText = 'Pending';
        if (isAdmin) {
            statusClass = 'admin';
            statusText = 'Admin';
        } else if (approved) {
            statusClass = 'approved';
            statusText = 'Approved';
        }
        
        // Check for recent password reset email sent
        const hasRecentResetRequest = userData.passwordResetRequestedAt && 
            (Date.now() - new Date(userData.passwordResetRequestedAt).getTime()) < (24 * 60 * 60 * 1000); // 24 hours
        
        item.innerHTML = `
            <div class="user-info">
                <div class="user-email">${email} <span class="user-status ${statusClass}">${statusText}</span></div>
                <div class="user-meta">
                    Created: ${createdAt}
                    ${userData.approvedBy ? ` • Approved by: ${userData.approvedBy}` : ''}
                    ${userData.approvedAt ? ` • Approved: ${new Date(userData.approvedAt).toLocaleString()}` : ''}
                    ${hasRecentResetRequest ? ` • Reset email sent by: ${userData.passwordResetRequestedBy} at ${new Date(userData.passwordResetRequestedAt).toLocaleString()}` : ''}
                </div>
            </div>
            <div class="user-actions">
                ${approved ? `<button class="btn btn-secondary btn-small" onclick="window.authManager.resetUserPassword('${userId}', '${email}')">
                    <i class="fas fa-envelope"></i> Send Password Reset
                </button>` : ''}
                ${!approved ? `<button class="btn btn-primary btn-small" onclick="window.authManager.approveUser('${userId}')">
                    <i class="fas fa-check"></i> Approve
                </button>` : ''}
                <button class="btn btn-danger btn-small" onclick="window.authManager.deleteUser('${userId}', '${email}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        return item;
    }

    async approveUser(userId) {
        if (!confirm('Are you sure you want to approve this user?')) return;
        
        try {
            // Get the user's current data
            const userDoc = await this.db.collection('users').doc(userId).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            
            // Use the same fixed organization ID for the shared organization
            const SHARED_ORG_ID = 'shared-org-sicu-scheduler';
            let sharedOrgId = SHARED_ORG_ID;
            
            // Check if shared organization exists
            const orgDoc = await this.db.collection('organizations').doc(SHARED_ORG_ID).get();
            
            if (!orgDoc.exists) {
                // Create shared organization if none exists
                await this.db.collection('organizations').doc(SHARED_ORG_ID).set({
                    name: 'SICU Schedule Manager - Shared Organization',
                    createdAt: new Date().toISOString(),
                    createdBy: this.user.uid,
                    members: [this.user.uid, userId],
                    settings: {
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                        defaultTimeInterval: 48
                    }
                });
            }
            
            // Update user with approval and shared organization
            await this.db.collection('users').doc(userId).set({
                ...userData,
                approved: true,
                approvedBy: this.user.email,
                approvedAt: new Date().toISOString(),
                defaultOrgId: sharedOrgId,
                organizations: [sharedOrgId]
            }, { merge: true });
            
            // Add user to shared organization members
            if (sharedOrgId) {
                const orgRef = this.db.collection('organizations').doc(sharedOrgId);
                const orgDoc = await orgRef.get();
                if (orgDoc.exists) {
                    const orgData = orgDoc.data();
                    const members = orgData.members || [];
                    if (!members.includes(userId)) {
                        members.push(userId);
                        await orgRef.update({ members });
                    }
                }
            }
            
            // Refresh both lists
            await this.loadPendingUsers();
            await this.loadAllUsers();
            
            this.showNotification('User approved successfully', 'success');
        } catch (e) {
            console.error('Error approving user:', e);
            this.showNotification('Failed to approve user', 'error');
        }
    }

    async deleteUser(userId, email) {
        if (!confirm(`Are you sure you want to delete user "${email}"? This action cannot be undone.`)) return;
        
        try {
            // Delete from Firestore
            await this.db.collection('users').doc(userId).delete();
            
            // Try to delete from Firebase Auth (this requires admin SDK in a real implementation)
            // For now, we'll just remove from Firestore and the user won't be able to log in
            
            // Refresh both lists
            await this.loadPendingUsers();
            await this.loadAllUsers();
            
            this.showNotification('User deleted successfully', 'success');
        } catch (e) {
            console.error('Error deleting user:', e);
            this.showNotification('Failed to delete user', 'error');
        }
    }

    async resetUserPassword(userId, email) {
        if (!confirm(`Send a password reset email to ${email}?\n\nThe user will receive an email with a link to create a new password.`)) {
            return;
        }
        
        try {
            // Use Firebase's built-in password reset email functionality
            // This sends a secure link to the user's email to reset their password
            await this.auth.sendPasswordResetEmail(email);
            
            // Update user document to record the reset request
            await this.db.collection('users').doc(userId).update({
                passwordResetRequestedAt: new Date().toISOString(),
                passwordResetRequestedBy: this.user.email,
                // Clear any old temp password that didn't work
                tempPassword: null
            });
            
            this.showNotification(`Password reset email sent to ${email}`, 'success');
            
            // Refresh user list to show updated info
            this.loadAllUsers();
            
        } catch (e) {
            console.error('Error sending password reset email:', e);
            
            // Provide helpful error messages
            if (e.code === 'auth/user-not-found') {
                this.showNotification('User not found in authentication system. They may need to re-register.', 'error');
            } else if (e.code === 'auth/invalid-email') {
                this.showNotification('Invalid email address', 'error');
            } else {
                this.showNotification(`Failed to send reset email: ${e.message}`, 'error');
            }
        }
    }

    generateTempPassword() {
        // Generate a simple 8-character password with letters and numbers
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let password = '';
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async updateAdminEmails() {
        const adminEmailsList = document.getElementById('adminEmailsList');
        if (!adminEmailsList) return;
        
        const emails = adminEmailsList.value.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
        
        // Update in-memory set
        this.adminEmails.clear();
        emails.forEach(email => this.adminEmails.add(email));
        
        // In a real implementation, you'd save this to a database
        this.showNotification('Admin emails updated successfully', 'success');
    }


    async clearAllPendingUsers() {
        if (!confirm('Are you sure you want to delete ALL pending users? This action cannot be undone.')) return;
        
        try {
            const qs = await this.db.collection('users').where('approved', '==', false).get();
            const batch = this.db.batch();
            
            qs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            
            await this.loadPendingUsers();
            await this.loadAllUsers();
            
            this.showNotification(`${qs.size} pending users deleted`, 'success');
        } catch (e) {
            console.error('Error clearing pending users:', e);
            this.showNotification('Failed to clear pending users', 'error');
        }
    }


    showNotification(message, type = 'info') {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6'
        };
        
        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}


