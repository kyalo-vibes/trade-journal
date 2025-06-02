// This file is not actively used for database operations if using CSV as primary storage.
// Kept in case other Firebase services (like Auth, if added later) are needed.
// If no other Firebase services are planned, this can be removed.

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
// import { getFirestore, Firestore } from "firebase/firestore"; // Not used for DB if CSV is main storage

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
// let db: Firestore; // Not initialized if not used

if (typeof window !== 'undefined') { // Ensure Firebase is initialized only on the client-side
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (error) {
      console.error("Firebase initialization error:", error);
      // Handle initialization error, maybe show a message to the user
    }
  } else {
    app = getApps()[0];
  }
}


// db = getFirestore(app); // Do not initialize Firestore if not using it as primary DB

// Export 'app' if needed for other Firebase services, but 'db' is commented out.
export { app /*, db */ };
