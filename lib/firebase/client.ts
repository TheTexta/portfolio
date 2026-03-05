import { getApp, getApps, initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

function requireEnv(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`Missing required Firebase env var: ${key}`);
  }

  return value;
}

const firebaseConfig = {
  apiKey: requireEnv(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    "NEXT_PUBLIC_FIREBASE_API_KEY",
  ),
  authDomain: requireEnv(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  ),
  projectId: requireEnv(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  ),
  storageBucket: requireEnv(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  ),
  messagingSenderId: requireEnv(
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  ),
  appId: requireEnv(
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ),
  measurementId: requireEnv(
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
  ),
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const storage = getStorage(firebaseApp);
