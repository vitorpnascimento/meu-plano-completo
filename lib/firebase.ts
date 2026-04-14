import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getDatabase, ref, set, get, Database } from 'firebase/database'

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

let _app: FirebaseApp | null = null
let _db: Database | null = null

function getDb(): Database | null {
  if (typeof window === 'undefined') return null
  if (!isFirebaseConfigured()) return null
  try {
    if (!_app) {
      _app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig as any)
      _db  = getDatabase(_app)
    }
    return _db
  } catch {
    return null
  }
}

/** Remove campos `foto` do weightHistory antes de salvar no Firebase (são base64 grandes) */
function stripPhotos(data: Record<string, any>): Record<string, any> {
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

/** Salva dados no Firebase (sem fotos). Retorna true se salvou com sucesso. */
export async function saveToFirebase(
  syncId: string,
  data: Record<string, any>,
): Promise<boolean> {
  const db = getDb()
  if (!db || !syncId) return false
  try {
    const clean = stripPhotos(data)
    await set(ref(db, `data/${syncId}`), {
      ...clean,
      lastSync: new Date().toISOString(),
    })
    return true
  } catch (e) {
    console.error('[Firebase] save error:', e)
    return false
  }
}

/** Carrega dados do Firebase. Retorna null se não encontrou ou falhou. */
export async function loadFromFirebase(
  syncId: string,
): Promise<Record<string, any> | null> {
  const db = getDb()
  if (!db || !syncId) return null
  try {
    const snap = await get(ref(db, `data/${syncId}`))
    return snap.exists() ? snap.val() : null
  } catch (e) {
    console.error('[Firebase] load error:', e)
    return null
  }
}
