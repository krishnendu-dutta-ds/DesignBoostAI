import { create } from 'zustand'
import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore'
import { firebaseAuth, firebaseDb } from './client'
import { AI_PROVIDERS, providerLabel, type AIProvider } from '../utils/aiProviders'

export type AIKeys = Record<AIProvider, string>
export type AIEnabled = Record<AIProvider, boolean>

type KeyStatus = 'idle' | 'loading' | 'ready' | 'error'

type AIKeyState = {
  keys: AIKeys
  enabled: AIEnabled
  status: KeyStatus
  error: string
  loadedFor: string
  load: () => Promise<void>
  save: (provider: AIProvider, key: string) => Promise<void>
  remove: (provider: AIProvider) => Promise<void>
  setEnabled: (provider: AIProvider, enabled: boolean) => Promise<void>
}

const KEY_FIELDS: Record<AIProvider, string> = {
  gemini: 'geminiApiKey',
  openrouter: 'openrouterApiKey',
  openai: 'openaiApiKey',
}
const ENABLED_FIELDS: Record<AIProvider, string> = {
  gemini: 'geminiEnabled',
  openrouter: 'openrouterEnabled',
  openai: 'openaiEnabled',
}
const UPDATED_FIELDS: Record<AIProvider, string> = {
  gemini: 'geminiApiKeyUpdatedAt',
  openrouter: 'openrouterApiKeyUpdatedAt',
  openai: 'openaiApiKeyUpdatedAt',
}

const EMPTY_KEYS: AIKeys = { gemini: '', openrouter: '', openai: '' }
const EMPTY_ENABLED: AIEnabled = { gemini: false, openrouter: false, openai: false }

/** The first provider that has a saved key, used for "activate" prompts. */
export function keyAvailable(keys: AIKeys): AIProvider | '' {
  return AI_PROVIDERS.find((provider) => keys[provider.id])?.id ?? ''
}

/** The provider that can generate right now: a saved key plus an activated account. */
export function activeProvider(keys: AIKeys, enabled: AIEnabled): AIProvider | '' {
  return AI_PROVIDERS.find((provider) => keys[provider.id] && enabled[provider.id])?.id ?? ''
}

function currentUser() {
  return firebaseAuth?.currentUser ?? null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected AI key error occurred.'
}

function requireUserDocument() {
  const user = currentUser()
  if (!firebaseDb || !user) throw new Error('Sign in to save an AI API key to your account.')
  return { userReference: doc(firebaseDb, 'users', user.uid), uid: user.uid }
}

export const useAIKey = create<AIKeyState>()((set, get) => ({
  keys: EMPTY_KEYS,
  enabled: EMPTY_ENABLED,
  status: 'idle',
  error: '',
  loadedFor: '',
  load: async () => {
    const user = currentUser()
    if (!user || !firebaseDb) {
      set({ keys: EMPTY_KEYS, enabled: EMPTY_ENABLED, status: 'ready', error: '' })
      return
    }
    if (get().status === 'loading' && get().loadedFor === user.uid) return
    if (get().loadedFor === user.uid && get().status !== 'error') return

    set({ status: 'loading', keys: EMPTY_KEYS, error: '', loadedFor: user.uid })
    try {
      const snapshot = await getDoc(doc(firebaseDb, 'users', user.uid))
      const data = snapshot.exists() ? snapshot.data() : null
      const record = data ?? {}
      const keys: AIKeys = { ...EMPTY_KEYS }
      const enabled: AIEnabled = { ...EMPTY_ENABLED }
      for (const provider of AI_PROVIDERS) {
        const stored = record[KEY_FIELDS[provider.id]]
        keys[provider.id] = typeof stored === 'string' ? stored : ''
        enabled[provider.id] = keys[provider.id] !== '' && record[ENABLED_FIELDS[provider.id]] === true
      }
      set({ keys, enabled, status: 'ready', loadedFor: user.uid, error: '' })
    } catch (error) {
      set({ keys: EMPTY_KEYS, enabled: EMPTY_ENABLED, status: 'error', loadedFor: user.uid, error: errorMessage(error) })
    }
  },
  save: async (provider, key) => {
    const trimmed = key.trim()
    if (!trimmed) throw new Error(`Enter a ${providerLabel(provider)} API key first.`)
    const { userReference, uid } = requireUserDocument()
    await setDoc(userReference, {
      [KEY_FIELDS[provider]]: trimmed,
      [UPDATED_FIELDS[provider]]: new Date().toISOString(),
    }, { merge: true })
    set({
      keys: { ...get().keys, [provider]: trimmed },
      status: 'ready',
      loadedFor: uid,
      error: '',
    })
  },
  remove: async (provider) => {
    const { userReference, uid } = requireUserDocument()
    await setDoc(userReference, {
      [KEY_FIELDS[provider]]: deleteField(),
      [ENABLED_FIELDS[provider]]: deleteField(),
      [UPDATED_FIELDS[provider]]: new Date().toISOString(),
    }, { merge: true })
    set({
      keys: { ...get().keys, [provider]: '' },
      enabled: { ...get().enabled, [provider]: false },
      status: 'ready',
      loadedFor: uid,
      error: '',
    })
  },
  setEnabled: async (provider, enabled) => {
    const { userReference, uid } = requireUserDocument()
    await setDoc(userReference, {
      [ENABLED_FIELDS[provider]]: enabled,
      [UPDATED_FIELDS[provider]]: new Date().toISOString(),
    }, { merge: true })
    set({
      enabled: { ...get().enabled, [provider]: enabled },
      status: 'ready',
      loadedFor: uid,
      error: '',
    })
  },
}))
