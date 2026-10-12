import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth'

/**
 * Firebase / Google sign-in client.
 *
 * Configured entirely through public env vars (Firebase web config is safe to
 * ship to the browser — the backend verifies every ID token separately):
 *   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID
 *
 * When these are missing the app still works — the Google button reports that
 * Google sign-in isn't configured instead of crashing.
 */

export function isFirebaseConfigured(): boolean {
  const { VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID } = import.meta.env
  return Boolean(VITE_FIREBASE_API_KEY && VITE_FIREBASE_AUTH_DOMAIN && VITE_FIREBASE_PROJECT_ID)
}

let app: FirebaseApp | null = null
let auth: Auth | null = null

function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured()) return null

  if (!app) {
    app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    })
  }
  if (!auth) {
    auth = getAuth(app)
  }
  return auth
}

export interface GoogleSignInResult {
  idToken: string
  email: string
  name: string
}

/**
 * Opens the Google sign-in popup and returns a fresh Firebase ID token plus
 * the profile claims the app can prefill (email, display name).
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const authInstance = getFirebaseAuth()
  if (!authInstance) {
    throw new Error('Google sign-in is not configured yet (missing VITE_FIREBASE_* env vars).')
  }

  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(authInstance, provider)
  const idToken = await result.user.getIdToken()

  return {
    idToken,
    email: result.user.email ?? '',
    name: result.user.displayName ?? '',
  }
}