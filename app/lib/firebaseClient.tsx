"use server";

import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, set, get, update } from "firebase/database";

// Your existing config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}
const database = getDatabase();

// A helper to sanitize the email for use in a Firebase path
function sanitizeEmailForFirebasePath(email: string) {
  return email.replace(/\./g, "_");
}

/**
 * saveReportEmail
 * Saves user email under 'reports/<sanitizedEmail>'
 */
export async function saveReportEmail(email: string): Promise<void> {
  try {
    if (!email) throw new Error("Invalid email");
    const safeEmail = sanitizeEmailForFirebasePath(email);
    const dbRef = ref(database, `reports/${safeEmail}`);
    await set(dbRef, {
      email,
      createdAt: Date.now(),
    });
    console.log(`[Firebase] Report subscription stored => ${email}`);
  } catch (err) {
    console.error("[Firebase] Error saving email:", err);
    throw err;
  }
}

// You can keep your other exports (sendUrlToFirebase, getArticlesLeftForDomain, etc.) unchanged here.
