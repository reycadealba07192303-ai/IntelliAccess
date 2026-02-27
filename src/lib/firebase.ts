import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// REPLACE these values with your actual Firebase project config 
// which you can find in the Firebase Console under Project Settings > General > Your apps
const firebaseConfig = {
  apiKey: "AIzaSyAxGorO0bYWLsAOtyh_ZjKKmXXmbu8oMb8",
  authDomain: "intelliaccess-ac1e5.firebaseapp.com",
  projectId: "intelliaccess-ac1e5",
  storageBucket: "intelliaccess-ac1e5.firebasestorage.app",
  messagingSenderId: "608056051585",
  appId: "1:608056051585:web:e4f60560f625cab6724a80",
  measurementId: "G-WCRLJWD1F0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
