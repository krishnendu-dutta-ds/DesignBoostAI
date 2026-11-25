import { create } from 'zustand'
import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firebaseDb } from './client'

export const GEMINI_KEY_URL = 'https://aistudio.google.com/apikey'

type KeyStatus = 'idle' | 'loading' | 'ready' | 'error'

type GeminiKeyState = {
  apiKey: string
  enabled: boolean
  status: KeyStatus
  error: string
  loadedFor: string
  load: () => Promise<void>
  save: (key: string) => Promise<void>
  remove: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
}

function currentUser() {
  return firebaseAuth?.currentUser ?? null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected Gemini API key error occurred.'
}

function requireUserDocument() {
  const user = currentUser()
  if (!firebaseDb || !user) throw new Error('Sign in to save a Gemini API key to your account.')
  return { userReference: doc(firebaseDb, 'users', user.uid), uid: user.uid }
}

export const useGeminiKey = create<GeminiKeyState>()((set, get) => ({
  apiKey: '',
  enabled: false,
  status: 'idle',
  error: '',
  loadedFor: '',
  load: async () => {
    const user = currentUser()
    if (!user || !firebaseDb) {
      set({ apiKey: '', status: 'ready', error: '' })
      return
    }
    if (get().status === 'loading' && get().loadedFor === user.uid) return
    if (get().loadedFor === user.uid && get().status !== 'error') return

    set({ status: 'loading', apiKey: '', error: '', loadedFor: user.uid })
    try {
      const snapshot = await getDoc(doc(firebaseDb, 'users', user.uid))
      const data = snapshot.exists() ? snapshot.data() : null
      const stored = data ? data.geminiApiKey : undefined
      set({
        apiKey: typeof stored === 'string' ? stored : '',
        enabled: Boolean(data && data.geminiEnabled === true && typeof stored === 'string' && stored),
        status: 'ready',
        loadedFor: user.uid,
        error: '',
      })
    } catch (error) {
      set({ apiKey: '', enabled: false, status: 'error', loadedFor: user.uid, error: errorMessage(error) })
    }
  },
  save: async (key) => {
    const trimmed = key.trim()
    if (!trimmed) throw new Error('Enter a Gemini API key first.')
    const { userReference, uid } = requireUserDocument()
    await setDoc(userReference, {
      geminiApiKey: trimmed,
      geminiApiKeyUpdatedAt: new Date().toISOString(),
    }, { merge: true })
    set({ apiKey: trimmed, status: 'ready', loadedFor: uid, error: '' })
  },
  remove: async () => {
    const { userReference, uid } = requireUserDocument()
    await setDoc(userReference, {
      geminiApiKey: deleteField(),
      geminiEnabled: deleteField(),
      geminiApiKeyUpdatedAt: new Date().toISOString(),
    }, { merge: true })
    set({ apiKey: '', enabled: false, status: 'ready', loadedFor: uid, error: '' })
  },
  setEnabled: async (enabled) => {
    const { userReference, uid } = requireUserDocument()
    await setDoc(userReference, {
      geminiEnabled: enabled,
      geminiEnabledUpdatedAt: new Date().toISOString(),
    }, { merge: true })
    set({ enabled, status: 'ready', loadedFor: uid, error: '' })
  },
}))
