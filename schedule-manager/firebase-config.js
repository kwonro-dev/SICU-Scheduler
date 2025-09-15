// Firebase initialization (placeholder config)
// Replace values below with your Firebase project's config from the Firebase Console
(function initFirebase() {
    // Always evaluate latest config each load
    const firebaseConfig = {
        apiKey: "AIzaSyAp1nC9ZZLpyx35O9sfle67w91jwLCluzA",
        authDomain: "sicu-scheduler.firebaseapp.com",
        projectId: "sicu-scheduler",
        storageBucket: "sicu-scheduler.firebasestorage.app",
        messagingSenderId: "312731848186",
        appId: "1:312731848186:web:7b8639778da92498a8a843",
        measurementId: "G-7QP6QJH9V2"
      };

    // Expose for debugging
    window.firebaseConfig = firebaseConfig;

    try {
        const hasPlaceholder = String(firebaseConfig.apiKey || '').includes('__REPLACE_ME__');
        if (hasPlaceholder) {
            throw new Error('Placeholder API key detected. Update firebase-config.js');
        }

        const alreadyInitialized = firebase.apps && firebase.apps.length > 0;
        if (alreadyInitialized) {
            const currentOptions = firebase.app().options || {};
            if (currentOptions.apiKey !== firebaseConfig.apiKey) {
                // Reinitialize with new config if the apiKey differs
                console.warn('Reinitializing Firebase with updated config');
                firebase.app().delete().then(() => {
                    firebase.initializeApp(firebaseConfig);
                }).catch(() => {
                    try { firebase.initializeApp(firebaseConfig); } catch (_) {}
                });
            }
        }

        if (!alreadyInitialized) {
            firebase.initializeApp(firebaseConfig);
        }

        window.firebaseAuth = firebase.auth();
        window.firebaseDb = firebase.firestore();
        
        // Enable offline persistence for better performance
        firebase.firestore().enablePersistence({
            synchronizeTabs: true // Sync across browser tabs
        }).then(() => {
            console.log('✅ Firestore offline persistence enabled');
        }).catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Offline persistence failed - multiple tabs open');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ Offline persistence not supported in this browser');
            } else {
                console.error('❌ Offline persistence failed:', err);
            }
        });
        
        console.log('✅ Firebase SDK loaded');
    } catch (err) {
        console.warn('⚠️ Firebase not initialized. Check API key and config.');
        console.warn(err);
    }
})();


