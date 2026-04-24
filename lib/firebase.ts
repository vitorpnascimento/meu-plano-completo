import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  Firestore,
  deleteDoc,
} from 'firebase/firestore'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  sendEmailVerification as fbSendEmailVerification,
  Auth,
  User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  )
}

let _app:  FirebaseApp | null = null
let _db:   Firestore   | null = null
let _auth: Auth        | null = null

function init(): boolean {
  if (_app) return true
  if (typeof window === 'undefined') return false
  if (!isFirebaseConfigured()) return false
  try {
    _app  = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig as any)
    _db   = getFirestore(_app)
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
  const cred = await createUserWithEmailAndPassword(_auth, email, password)
  await fbSendEmailVerification(cred.user).catch(() => {})
  return cred
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await fbSendEmailVerification(user)
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

/** Salva dados em users/{uid}/data. Retorna true em sucesso. */
export async function saveUserData(
  uid: string,
  data: Record<string, any>,
): Promise<boolean> {
  if (!init() || !_db || !uid) return false
  try {
    const clean = stripPhotos(data)
    await setDoc(doc(_db, 'users', uid), {
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
    const snap = await getDoc(doc(_db, 'users', uid))
    return snap.exists() ? (snap.data() as Record<string, any>) : null
  } catch (e) {
    console.error('[Firebase] load error:', e)
    return null
  }
}

// ── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  username:     string
  displayName:  string
  birthDate?:   string
  avatarType:   'preset' | 'upload'
  avatarPreset?: string
  avatarUrl?:   string
  createdAt:    string
}

/** Verifica se um username está disponível (retorna true se disponível). */
export async function checkUsernameAvailable(username: string, currentUid?: string): Promise<boolean> {
  if (!init() || !_db) return false
  try {
    const snap = await getDoc(doc(_db, 'usernames', username.toLowerCase()))
    if (!snap.exists()) return true
    return snap.data()?.uid === currentUid // disponível se pertence ao próprio usuário
  } catch {
    return false
  }
}

/** Salva perfil em userProfiles/{uid} e reserva username em usernames/{username}. */
export async function saveUserProfile(uid: string, profile: UserProfile, oldUsername?: string): Promise<boolean> {
  if (!init() || !_db || !uid) return false
  try {
    await setDoc(doc(_db, 'userProfiles', uid), { ...profile, updatedAt: new Date().toISOString() })
    await setDoc(doc(_db, 'usernames', profile.username.toLowerCase()), { uid })
    if (oldUsername && oldUsername !== profile.username.toLowerCase()) {
      await deleteDoc(doc(_db, 'usernames', oldUsername)).catch(() => {})
    }
    return true
  } catch (e) {
    console.error('[Firebase] saveUserProfile error:', e)
    return false
  }
}

/** Carrega perfil de userProfiles/{uid}. */
export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  if (!init() || !_db || !uid) return null
  try {
    const snap = await getDoc(doc(_db, 'userProfiles', uid))
    return snap.exists() ? (snap.data() as UserProfile) : null
  } catch {
    return null
  }
}

/**
 * Assina atualizações em tempo real de users/{uid}.
 * Chama callback com os dados sempre que houver mudança no Firestore.
 * Retorna função de cleanup (unsubscribe).
 */
export function subscribeToUserData(
  uid: string,
  callback: (data: Record<string, any> | null) => void,
): () => void {
  if (!init() || !_db || !uid) {
    callback(null)
    return () => {}
  }
  return onSnapshot(
    doc(_db, 'users', uid),
    (snap) => {
      callback(snap.exists() ? (snap.data() as Record<string, any>) : null)
    },
    (err) => {
      console.error('[Firebase] snapshot error:', err)
      callback(null)
    },
  )
}
