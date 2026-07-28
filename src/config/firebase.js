import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "mon-bocadillo-menu.firebaseapp.com",
  projectId: "mon-bocadillo-menu",
  storageBucket: "mon-bocadillo-menu.firebasestorage.app",
  messagingSenderId: "555581310485",
  appId: "1:555581310485:web:a754eb9fcfb9a02c45b01c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export let messaging = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  }).catch(() => {
    console.log("Firebase Messaging not supported");
  });
}

export const appId = "mon-bocadillo-menu";