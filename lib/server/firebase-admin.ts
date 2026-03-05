import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function readRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function readFirebaseAdminConfig() {
  const projectId = readRequiredEnv("FIREBASE_ADMIN_PROJECT_ID");
  const clientEmail = readRequiredEnv("FIREBASE_ADMIN_CLIENT_EMAIL");
  const privateKey = readRequiredEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(
    /\\n/g,
    "\n",
  );
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.firebasestorage.app`;

  return {
    projectId,
    clientEmail,
    privateKey,
    storageBucket,
  };
}

export function getFirebaseAdminApp() {
  if (getApps().length) {
    return getApp();
  }

  const config = readFirebaseAdminConfig();

  return initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey,
    }),
    storageBucket: config.storageBucket,
  });
}

export function getFirebaseAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getFirebaseAdminBucket() {
  const app = getFirebaseAdminApp();
  return getStorage(app).bucket();
}
