import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/**
 * Reads public Firebase Web App configuration strictly from environment variables.
 * Never hardcodes fallback keys or credentials into source code.
 */
export function getClientFirebaseConfig(): FirebaseClientConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();

  if (!apiKey || !projectId || !appId || !messagingSenderId) {
    return null;
  }

  const authDomain =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || `${projectId}.firebaseapp.com`;
  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || `${projectId}.firebasestorage.app`;
  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim();

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId: measurementId || undefined,
  };
}

/**
 * Reads the public Web Push VAPID key from environment variables.
 */
export function getFirebaseVapidKey(): string | null {
  const key =
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim() ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

export const FIREBASE_VAPID_KEY = getFirebaseVapidKey();

let clientApp: FirebaseApp | null = null;
let clientMessaging: Messaging | null = null;

/**
 * Returns the singleton FirebaseApp instance for browser client usage.
 * Returns null if executed during SSR or if required environment variables are absent.
 */
export function getClientFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;

  const config = getClientFirebaseConfig();
  if (!config) return null;

  if (!clientApp) {
    const existing = getApps();
    clientApp = existing.length > 0 ? existing[0] : initializeApp(config);
  }
  return clientApp;
}

/**
 * Checks whether Firebase Web Messaging is supported in the current browser runtime.
 */
export async function isFirebaseMessagingSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/**
 * Obtains a genuine Firebase Cloud Messaging (FCM) registration token
 * via the official Firebase Web SDK (modular v10/v11/v12).
 * 
 * Uses Firebase Installations service and the configured VAPID key to generate
 * a genuine FCM token that is accepted by FCM HTTP v1 (`messages:send`).
 */
export async function requestClientFcmToken(
  registration?: ServiceWorkerRegistration
): Promise<{ token: string | null; error?: string }> {
  if (typeof window === "undefined") {
    return { token: null, error: "Cannot request token during server-side rendering." };
  }

  const config = getClientFirebaseConfig();
  if (!config) {
    return {
      token: null,
      error: "Missing required Firebase client environment configuration (NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID, or NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID).",
    };
  }

  const vapidKey = getFirebaseVapidKey();
  if (!vapidKey) {
    return {
      token: null,
      error: "Missing required Web Push VAPID key (NEXT_PUBLIC_FIREBASE_VAPID_KEY).",
    };
  }

  const supported = await isFirebaseMessagingSupported();
  if (!supported) {
    return {
      token: null,
      error: "Firebase Web Messaging is not supported by this browser environment.",
    };
  }

  try {
    const app = getClientFirebaseApp();
    if (!app) {
      return { token: null, error: "Could not initialize client Firebase app." };
    }

    if (!clientMessaging) {
      clientMessaging = getMessaging(app);
    }

    const swRegistration = registration || (await navigator.serviceWorker.ready);

    const token = await getToken(clientMessaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      return { token };
    }
    return { token: null, error: "Firebase getToken returned empty token." };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[Firebase Client] getToken failed:", message);
    return { token: null, error: message };
  }
}
