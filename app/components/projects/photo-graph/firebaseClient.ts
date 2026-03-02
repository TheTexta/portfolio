import { getApp, getApps, initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCJcaZDccPEycNq8063Ziz5X0fr11U1TdI",
  authDomain: "portfolio-site-firebase-41fab.firebaseapp.com",
  projectId: "portfolio-site-firebase-41fab",
  storageBucket: "portfolio-site-firebase-41fab.firebasestorage.app",
  messagingSenderId: "274306939095",
  appId: "1:274306939095:web:a5389c279fd8cbf31c1892",
  measurementId: "G-YMW53LSD8L",
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const storage = getStorage(firebaseApp);