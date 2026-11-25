import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
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

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<AppShell />}>
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
  )
}
