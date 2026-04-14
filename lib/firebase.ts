import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getDatabase, ref, set, get, Database } from 'firebase/database'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  Auth,
  User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  )
}

let _app:  FirebaseApp | null = null
let _db:   Database    | null = null
let _auth: Auth        | null = null

function init(): boolean {
  if (_app) return true
  if (typeof window === 'undefined') return false
  if (!isFirebaseConfigured()) return false
  try {
    _app  = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig as any)
    _db   = getDatabase(_app)
    _auth = getAuth(_app)
    return true
  } catch (e) {
    console.error('[Firebase] init error:', e)
    return false
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function createAccount(email: string, password: string) {
  if (!init() || !_auth) throw new Error('Firebase not configured')
  return createUserWithEmailAndPassword(_auth, email, password)
}

export async function loginWithEmail(email: string, password: string) {
  if (!init() || !_auth) throw new Error('Firebase not configured')
  return signInWithEmailAndPassword(_auth, email, password)
}

export async function logoutUser(): Promise<void> {
  if (!init() || !_auth) return
  await fbSignOut(_auth)
}

export function subscribeToAuthState(
  callback: (user: User | null) => void,
): () => void {
  if (!init() || !_auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(_auth, callback)
}

// ── Data ──────────────────────────────────────────────────────────────────────

/** Remove fotos do weightHistory antes de salvar (base64 é grande demais) */
export function stripPhotos(data: Record<string, any>): Record<string, any> {
  const wh = data.weightHistory
  if (!wh) return data
  const stripped: Record<string, any> = {}
  for (const [date, entry] of Object.entries(wh)) {
    if (entry && typeof entry === 'object') {
      const { foto: _f, ...rest } = entry as any
      stripped[date] = rest
    } else {
      stripped[date] = entry
    }
  }
  return { ...data, weightHistory: stripped }
}

/** Salva dados em users/{uid}. Retorna true em sucesso. */
export async function saveUserData(
  uid: string,
  data: Record<string, any>,
): Promise<boolean> {
  if (!init() || !_db || !uid) return false
  try {
    const clean = stripPhotos(data)
    await set(ref(_db, `users/${uid}`), {
      ...clean,
      lastSync: new Date().toISOString(),
    })
    return true
  } catch (e) {
    console.error('[Firebase] save error:', e)
    return false
  }
}

/** Carrega dados de users/{uid}. Retorna null se não encontrado. */
export async function loadUserData(
  uid: string,
): Promise<Record<string, any> | null> {
  if (!init() || !_db || !uid) return null
  try {
    const snap = await get(ref(_db, `users/${uid}`))
    return snap.exists() ? snap.val() : null
  } catch (e) {
    console.error('[Firebase] load error:', e)
    return null
  }
}
