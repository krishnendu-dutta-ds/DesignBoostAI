import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Blocks, LoaderCircle } from 'lucide-react'
import { AppShell } from './components/layout/AppShell'
import { firebaseAuth, firebaseConfigured, signInWithGoogle, signOutFromFirebase } from './firebase/client'
import { useFirebaseProjectSync } from './firebase/useFirebaseProjectSync'
import {
  AccessibilityPage,
  ColorStudioPage,
  DashboardPage,
  ProjectsPage,
  SavedSystemsPage,
  SettingsPage,
  SpacingStudioPage,
  TokensPage,
  TypographyStudioPage,
} from './pages/Pages'

function authErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : ''
  if (code === 'auth/configuration-not-found') {
    return 'Firebase Authentication is not configured. Enable Authentication and Google sign-in, then verify the web app uses project designboostai-8225e.'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is disabled. Enable Google under Firebase Authentication → Sign-in method.'
  }
  if (code === 'auth/unauthorized-domain') {
    return `This site is not authorized for Google sign-in. Add ${window.location.hostname} under Firebase Authentication → Settings → Authorized domains.`
  }
  return error instanceof Error ? error.message : 'Firebase authentication failed.'
}

function LoadingScreen({ message }: { message: string }) {
  return <main className="firebase-screen"><div className="firebase-card firebase-loading"><LoaderCircle className="firebase-spinner" size={24} /><p>{message}</p></div></main>
}

function AuthBrand() {
  return <div className="auth-brand">
    <span className="brand-mark"><Blocks size={16} /></span>
    <span className="brand-name">designboost<span>ai</span></span>
    <span className="auth-brand-context">WORKSPACE</span>
  </div>
}

function SetupRequiredScreen() {
  return <main className="firebase-screen"><section className="firebase-card">
    <AuthBrand />
    <h1>Firebase setup required</h1>
    <p>Add the Firebase web app settings to the deployment environment before signing in.</p>
    <code>VITE_FIREBASE_API_KEY<br />VITE_FIREBASE_AUTH_DOMAIN<br />VITE_FIREBASE_PROJECT_ID<br />VITE_FIREBASE_APP_ID</code>
  </section></main>
}

function SignInScreen({ error, onSignIn }: { error: string; onSignIn: () => void }) {
  return <main className="firebase-screen"><section className="firebase-card">
    <AuthBrand />
    <h1>Sign in to your workspace</h1>
    <p>Keep the colors, type and spacing behind your products together.</p>
    {error && <div className="firebase-auth-error" role="alert">{error}</div>}
    <button className="button-secondary firebase-sign-in" onClick={onSignIn}><span className="google-letter" aria-hidden="true">G</span>Continue with Google</button>
  </section></main>
}

function WorkspaceUnavailableScreen({ error, onRetry, onSignOut }: { error: string; onRetry: () => void; onSignOut: () => void }) {
  return <main className="firebase-screen"><section className="firebase-card">
    <AuthBrand />
    <h1>Workspace unavailable</h1>
    <p>Your local workspace could not be safely matched to this Google account.</p>
    {error && <div className="firebase-auth-error" role="alert">{error}</div>}
    <button className="button-primary firebase-sign-in" onClick={onRetry}>Retry</button>
    <button className="button-secondary firebase-sign-out" onClick={onSignOut}>Sign out</button>
  </section></main>
}

function AuthenticatedWorkspace({ user, authError }: { user: User; authError: string }) {
  const { status, error, ready, safeToRender, retry } = useFirebaseProjectSync(user)
  const [signOutError, setSignOutError] = useState('')

  const handleSignOut = () => {
    setSignOutError('')
    void signOutFromFirebase().catch((signOutError: unknown) => {
      setSignOutError(authErrorMessage(signOutError))
    })
  }

  if (!ready) return <LoadingScreen message="Connecting to Design Boost AI" />
  if (!safeToRender) {
    return <WorkspaceUnavailableScreen
      error={error || signOutError || authError}
      onRetry={retry}
      onSignOut={handleSignOut}
    />
  }

  return <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route element={<AppShell
        user={user}
        syncStatus={status}
        syncError={error || signOutError || authError}
        onRetrySync={retry}
        onSignOut={handleSignOut}
      />}>
        <Route index element={<DashboardPage />} />
        <Route path="colors" element={<ColorStudioPage />} />
        <Route path="typography" element={<TypographyStudioPage />} />
        <Route path="spacing" element={<SpacingStudioPage />} />
        <Route path="accessibility" element={<AccessibilityPage />} />
        <Route path="tokens" element={<TokensPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="systems" element={<SavedSystemsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
}

export function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    if (!firebaseAuth) {
      setAuthLoading(false)
      return
    }
    return onAuthStateChanged(
      firebaseAuth,
      (currentUser) => {
        setUser(currentUser)
        setAuthError('')
        setAuthLoading(false)
      },
      (error) => {
        setAuthError(authErrorMessage(error))
        setAuthLoading(false)
      },
    )
  }, [])

  if (!firebaseConfigured) return <SetupRequiredScreen />
  if (authLoading) return <LoadingScreen message="Checking your sign-in..." />
  if (!user) {
    return <SignInScreen
      error={authError}
      onSignIn={() => {
        setAuthError('')
        void signInWithGoogle().catch((error: unknown) => {
          setAuthError(authErrorMessage(error))
        })
      }}
    />
  }

  return <AuthenticatedWorkspace user={user} authError={authError} />
}
