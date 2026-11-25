import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import {
  collection,
  doc,
  onSnapshot,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore'
import type { DesignProject } from '../types'
import { useDesignStore } from '../store/useDesignStore'
import { firebaseDb } from './client'
import { isDesignProject, normalizeProject } from '../utils/projectExport'

type SyncStatus = 'loading' | 'syncing' | 'synced' | 'error'
type ProjectMap = Map<string, DesignProject>
type LocalWorkspace = { projects: DesignProject[]; activeProjectId: string }
type WriteOperation =
  | { kind: 'set'; id: string; project: DesignProject }
  | { kind: 'delete'; id: string }

const workspaceOwnerKey = 'designboost-workspace-owner'
const workspaceCachePrefix = 'designboost-workspace-user-'

function readWorkspaceCache(uid: string): LocalWorkspace | null {
  const cached = window.localStorage.getItem(`${workspaceCachePrefix}${uid}`)
  if (!cached) return null

  const parsed: unknown = JSON.parse(cached)
  if (!parsed || typeof parsed !== 'object' || !('projects' in parsed) || !Array.isArray(parsed.projects)) {
    throw new Error('The saved browser project cache is invalid and could not be loaded.')
  }
  if (!parsed.projects.every(isDesignProject)) {
    throw new Error('The saved browser project cache contains an invalid project.')
  }
  const activeProjectId = 'activeProjectId' in parsed && typeof parsed.activeProjectId === 'string'
    ? parsed.activeProjectId
    : ''
  return {
    projects: parsed.projects.map(normalizeProject),
    activeProjectId,
  }
}

function writeWorkspaceCache(uid: string, projects: DesignProject[], activeProjectId: string) {
  window.localStorage.setItem(
    `${workspaceCachePrefix}${uid}`,
    JSON.stringify({ projects, activeProjectId }),
  )
}

function mapProjects(projects: DesignProject[]): ProjectMap {
  return new Map(projects.map((project) => [project.id, normalizeProject(project)]))
}

function mapsEqual(left: ProjectMap, right: ProjectMap) {
  if (left.size !== right.size) return false
  for (const [id, project] of left) {
    if (JSON.stringify(project) !== JSON.stringify(right.get(id))) return false
  }
  return true
}

function projectsFromSnapshot(snapshot: QuerySnapshot<DocumentData>): DesignProject[] {
  return snapshot.docs.map((projectDocument) => {
    const data: unknown = projectDocument.data()
    if (!isDesignProject(data) || !data.id.trim() || encodeURIComponent(data.id) !== projectDocument.id) {
      throw new Error(`Firebase contains an invalid project document (${projectDocument.id}).`)
    }
    return normalizeProject(data)
  })
}

async function writeProjectChanges(uid: string, previous: ProjectMap, next: ProjectMap) {
  if (!firebaseDb) throw new Error('Firebase is not configured for this deployment.')

  const operations: WriteOperation[] = []
  for (const [id, project] of next) {
    if (!id.trim()) throw new Error('A project is missing an ID and cannot be saved to Firebase.')
    if (JSON.stringify(project) !== JSON.stringify(previous.get(id))) {
      operations.push({ kind: 'set', id, project })
    }
  }
  for (const id of previous.keys()) {
    if (!next.has(id)) operations.push({ kind: 'delete', id })
  }

  const projectsCollection = collection(firebaseDb, 'users', uid, 'projects')
  for (let offset = 0; offset < operations.length; offset += 450) {
    const batch = writeBatch(firebaseDb)
    for (const operation of operations.slice(offset, offset + 450)) {
      const projectReference = doc(projectsCollection, encodeURIComponent(operation.id))
      if (operation.kind === 'set') batch.set(projectReference, operation.project)
      else batch.delete(projectReference)
    }
    await batch.commit()
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected Firebase error occurred.'
}

export function useFirebaseProjectSync(user: User) {
  const [status, setStatus] = useState<SyncStatus>('loading')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [safeToRender, setSafeToRender] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const initialized = useRef(false)
  const lastSynced = useRef<ProjectMap>(new Map())
  const retryPending = useRef<() => void>(() => setRetryVersion((version) => version + 1))

  useEffect(() => {
    if (!firebaseDb) {
      setError('Firebase is not configured for this deployment.')
      setStatus('error')
      setReady(true)
      return
    }

    let disposed = false
    let initializing = false
    let syncQueue = Promise.resolve()
    initialized.current = false
    lastSynced.current = new Map()
    setStatus('loading')
    setError('')
    setReady(false)
    setSafeToRender(false)

    let accountLocalProjects: DesignProject[]
    let accountActiveProjectId: string
    let localCacheError = ''
    let localOwnershipVerified = false
    let localBelongsToCurrentUser = false
    try {
      const owner = window.localStorage.getItem(workspaceOwnerKey)
      localOwnershipVerified = true
      localBelongsToCurrentUser = owner === null || owner === user.uid
      const localState = useDesignStore.getState()
      if (owner && owner !== user.uid) {
        writeWorkspaceCache(owner, localState.projects, localState.activeProjectId)
        const accountCache = readWorkspaceCache(user.uid)
        accountLocalProjects = accountCache?.projects ?? []
        accountActiveProjectId = accountCache?.activeProjectId ?? ''
      } else {
        accountLocalProjects = localState.projects
        accountActiveProjectId = localState.activeProjectId
      }
      window.localStorage.setItem(workspaceOwnerKey, user.uid)
      writeWorkspaceCache(user.uid, accountLocalProjects, accountActiveProjectId)
      useDesignStore.getState().replaceProjects(accountLocalProjects, accountActiveProjectId)
      setSafeToRender(true)
    } catch (cacheError) {
      setError(errorMessage(cacheError))
      setStatus('error')
      setReady(true)
      setSafeToRender(localOwnershipVerified && localBelongsToCurrentUser)
      return
    }

    const projectsCollection = collection(firebaseDb, 'users', user.uid, 'projects')
    const scheduleSave = () => {
      syncQueue = syncQueue.then(async () => {
        if (disposed || !initialized.current) return
        const current = mapProjects(useDesignStore.getState().projects)
        const previous = lastSynced.current
        if (mapsEqual(previous, current)) {
          setStatus('synced')
          return
        }
        setStatus('syncing')
        setError(localCacheError ? `Firebase is synced, but the local recovery copy could not be saved: ${localCacheError}` : '')
        await writeProjectChanges(user.uid, previous, current)
        if (disposed) return
        lastSynced.current = current
        setStatus(localCacheError ? 'error' : 'synced')
      }).catch((syncError: unknown) => {
        if (disposed) return
        setError(errorMessage(syncError))
        setStatus('error')
      })
    }
    retryPending.current = () => {
      if (initialized.current) scheduleSave()
      else setRetryVersion((version) => version + 1)
    }

    const unsubscribeStore = useDesignStore.subscribe((state, previousState) => {
      if (state.projects !== previousState.projects || state.activeProjectId !== previousState.activeProjectId) {
        try {
          writeWorkspaceCache(user.uid, state.projects, state.activeProjectId)
          localCacheError = ''
        } catch (cacheError) {
          localCacheError = errorMessage(cacheError)
          setError(`Could not save the local recovery copy: ${localCacheError}`)
          setStatus('error')
        }
      }
      if (state.projects !== previousState.projects && initialized.current) scheduleSave()
    })

    const unsubscribeSnapshot = onSnapshot(
      projectsCollection,
      { includeMetadataChanges: true },
      async (snapshot) => {
        let remoteProjects: DesignProject[]
        try {
          remoteProjects = projectsFromSnapshot(snapshot)
        } catch (snapshotError) {
          setError(errorMessage(snapshotError))
          setStatus('error')
          setReady(true)
          return
        }

        const remote = mapProjects(remoteProjects)
        if (!initialized.current) {
          if (initializing) return
          initializing = true
          setStatus('syncing')
          const mergedMap = new Map(remote)
          for (const localProject of accountLocalProjects) {
            const remoteProject = remote.get(localProject.id)
            const localTimestamp = Date.parse(localProject.updatedAt)
            const remoteTimestamp = remoteProject ? Date.parse(remoteProject.updatedAt) : Number.NaN
            if (!remoteProject || (Number.isFinite(localTimestamp) && localTimestamp > remoteTimestamp)) {
              mergedMap.set(localProject.id, localProject)
            }
          }
          const merged = [...mergedMap.values()]
          const normalizedMergedMap = mapProjects(merged)
          try {
            await writeProjectChanges(user.uid, remote, normalizedMergedMap)
            if (disposed) return
            lastSynced.current = normalizedMergedMap
            initialized.current = true
            const activeId = merged.some((project) => project.id === accountActiveProjectId)
              ? accountActiveProjectId
              : (merged[0]?.id ?? '')
            useDesignStore.getState().replaceProjects(merged, activeId)
            try {
              writeWorkspaceCache(user.uid, merged, activeId)
              localCacheError = ''
            } catch (cacheError) {
              localCacheError = errorMessage(cacheError)
            }
            setStatus(localCacheError ? 'error' : 'synced')
            setError(localCacheError ? `Firebase is synced, but the local recovery copy could not be saved: ${localCacheError}` : '')
          } catch (syncError) {
            if (!disposed) {
              setError(errorMessage(syncError))
              setStatus('error')
            }
          } finally {
            initializing = false
            if (!disposed) setReady(true)
          }
          return
        }

        if (snapshot.metadata.hasPendingWrites || mapsEqual(lastSynced.current, remote)) return

        const localProjects = mapProjects(useDesignStore.getState().projects)
        const dirtyIds = new Set<string>()
        for (const id of new Set([...lastSynced.current.keys(), ...localProjects.keys()])) {
          if (JSON.stringify(lastSynced.current.get(id)) !== JSON.stringify(localProjects.get(id))) dirtyIds.add(id)
        }
        const merged = new Map(remote)
        for (const id of dirtyIds) {
          const localProject = localProjects.get(id)
          if (localProject) merged.set(id, localProject)
          else merged.delete(id)
        }

        lastSynced.current = remote
        const activeId = merged.has(useDesignStore.getState().activeProjectId)
          ? useDesignStore.getState().activeProjectId
          : ([...merged.keys()][0] ?? '')
        useDesignStore.getState().replaceProjects([...merged.values()], activeId)
        setStatus(localCacheError ? 'error' : 'synced')
        setError(localCacheError ? `Firebase is synced, but the local recovery copy could not be saved: ${localCacheError}` : '')
      },
      (snapshotError) => {
        if (disposed) return
        setError(errorMessage(snapshotError))
        setStatus('error')
        setReady(true)
      },
    )

    return () => {
      disposed = true
      unsubscribeStore()
      unsubscribeSnapshot()
    }
  }, [retryVersion, user.uid])

  const retry = useCallback(() => retryPending.current(), [])
  return { status, error, ready, safeToRender, retry }
}
