import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Accessibility, Bell, Blocks, Check, ChevronDown, ChevronsLeft, ChevronsRight, CircleHelp,
  Command, Download, FolderKanban, Gauge, LayoutDashboard, LogOut, Menu, Palette, Plus,
  Moon, Search, Settings, SlidersHorizontal, Sun, Trash2, Type, X,
} from 'lucide-react'
import type { User } from 'firebase/auth'
import { useDesignStore, useTeamProjects } from '../../store/useDesignStore'
import { createTokensStudioDocument, createWorkspaceBackup, downloadJson } from '../../utils/projectExport'

const groups = [
  { title: 'Overview', links: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }] },
  { title: 'Design system', links: [
    { label: 'Color studio', path: '/colors', icon: Palette },
    { label: 'Typography', path: '/typography', icon: Type },
    { label: 'Spacing', path: '/spacing', icon: SlidersHorizontal },
    { label: 'Design tokens', path: '/tokens', icon: Blocks },
  ] },
  { title: 'Design tools', links: [
    { label: 'Accessibility', path: '/accessibility', icon: Accessibility },
    { label: 'Design audit', path: '/audit', icon: Gauge },
  ] },
  { title: 'Workspace', links: [
    { label: 'My projects', path: '/projects', icon: FolderKanban },
    { label: 'Settings', path: '/settings', icon: Settings },
  ] },
]

const pageNames: Record<string, string> = {
  '/': 'Dashboard', '/colors': 'Color studio', '/typography': 'Typography',
  '/spacing': 'Spacing', '/tokens': 'Design tokens',
  '/accessibility': 'Accessibility',
  '/audit': 'Design audit',
  '/projects': 'My projects', '/settings': 'Settings',
}

function projectSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design-system'
}

type AppShellProps = {
  user: User
  syncStatus: 'loading' | 'syncing' | 'synced' | 'error'
  syncError: string
  onRetrySync: () => void
  onSignOut: () => void
}

export function AppShell({ user, syncStatus, syncError, onRetrySync, onSignOut }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const allProjects = useDesignStore((state) => state.projects)
  const { projects } = useTeamProjects()
  const teams = useDesignStore((state) => state.teams)
  const activeTeamId = useDesignStore((state) => state.activeTeamId)
  const addTeam = useDesignStore((state) => state.addTeam)
  const deleteTeam = useDesignStore((state) => state.deleteTeam)
  const setActiveTeam = useDesignStore((state) => state.setActiveTeam)
  const workspaceName = useDesignStore((state) => state.workspaceName)
  const activeTeam = teams.find((team) => team.id === activeTeamId) ?? teams[0]
  const displayTeamName = activeTeam?.name ?? workspaceName
  const displayTeamInitial = displayTeamName.charAt(0).toUpperCase() || 'D'
  const compactDensity = useDesignStore((state) => state.compactDensity)
  const theme = useDesignStore((state) => state.theme)
  const setTheme = useDesignStore((state) => state.setTheme)
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const activeProjectId = useDesignStore((state) => state.activeProjectId)
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0]
  const profileName = user.displayName || user.email || 'Google user'
  const profileInitial = profileName.charAt(0).toUpperCase()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const activeTheme = theme === 'system' ? systemTheme : theme
  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => setSystemTheme(preference.matches ? 'dark' : 'light')
    updateSystemTheme()
    preference.addEventListener('change', updateSystemTheme)
    return () => preference.removeEventListener('change', updateSystemTheme)
  }, [])
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = activeTheme
    document.documentElement.style.colorScheme = activeTheme
    document.documentElement.classList.toggle('compact-density', compactDensity)
    const themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', activeTheme === 'dark' ? '#14161b' : '#f4f5f7')
    }
  }, [activeTheme, compactDensity])
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        setWorkspaceMenuOpen(false)
        setExportMenuOpen(false)
        searchInputRef.current?.focus()
      } else if (event.key === 'Escape') {
        setSearchOpen(false)
        setWorkspaceMenuOpen(false)
        setExportMenuOpen(false)
        setMobileOpen(false)
      }
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (workspaceRef.current && !workspaceRef.current.contains(target)) {
        setWorkspaceMenuOpen(false)
      }
      if (exportRef.current && !exportRef.current.contains(target)) {
        setExportMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])
  const searchResults = useMemo(
    () => Object.entries(pageNames).filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase())),
    [query],
  )

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }
  const exportWorkspace = () => {
    downloadJson('designboost-workspace-backup.json', createWorkspaceBackup(allProjects, activeProjectId))
    setExportMenuOpen(false)
    showNotice(`${allProjects.length} project${allProjects.length === 1 ? '' : 's'} saved in workspace backup`)
  }
  const exportFigmaTokens = () => {
    if (!activeProject) return
    downloadJson(`${projectSlug(activeProject.name)}-tokens-studio.json`, createTokensStudioDocument(activeProject))
    setExportMenuOpen(false)
    showNotice('Tokens Studio JSON exported for Figma')
  }
  const reviewFigmaVariables = () => {
    setExportMenuOpen(false)
    navigate('/tokens')
    showNotice('Review color, typography, and spacing values before exporting Figma variables.')
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="brand-row">
          <Link to="/" className="brand-mark" aria-label="DesignBoost AI home"><Blocks size={16} /></Link>
          {!collapsed && <span className="brand-name">designboost<span>ai</span></span>}
          <button className="icon-button sidebar-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="main-navigation" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={17} /></button>
        </div>
        <div className="workspace-dropdown" ref={workspaceRef}>
          <button className="workspace-switcher" aria-expanded={workspaceMenuOpen} onClick={() => { setWorkspaceMenuOpen(!workspaceMenuOpen); setCreatingTeam(false) }}>
            <span className="workspace-avatar">{displayTeamInitial}</span>
            {!collapsed && <><span className="workspace-copy"><strong>{displayTeamName}</strong><small>{teams.length > 1 ? `${teams.length} design teams` : 'Personal workspace'}</small></span><ChevronDown size={15} /></>}
          </button>
          {workspaceMenuOpen && <div className="workspace-menu">
            <div className="workspace-menu-label">Design teams</div>
            {teams.map((team) => (
              <div key={team.id} className={`workspace-team-row ${team.id === activeTeam?.id ? 'active' : ''}`}>
                <button
                  type="button"
                  className={`workspace-team-select ${team.id === activeTeam?.id ? 'active' : ''}`}
                  onClick={() => { setActiveTeam(team.id); setWorkspaceMenuOpen(false); showNotice(`Switched to ${team.name}`) }}
                >
                  <span className="workspace-team-badge">{team.name.charAt(0).toUpperCase()}</span>
                  <span className="workspace-team-name">{team.name}</span>
                  {team.id === activeTeam?.id && <Check size={13} className="workspace-current" />}
                </button>
                {teams.length > 1 && (
                  <button
                    type="button"
                    className="workspace-team-remove"
                    aria-label={`Remove ${team.name}`}
                    title={`Remove ${team.name}`}
                    onClick={() => { deleteTeam(team.id); showNotice(`${team.name} removed`) }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            <div className="workspace-menu-divider" />
            {creatingTeam ? (
              <form
                className="workspace-create-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  const trimmed = newTeamName.trim()
                  if (!trimmed) return
                  addTeam(trimmed)
                  setNewTeamName('')
                  setCreatingTeam(false)
                  setWorkspaceMenuOpen(false)
                  showNotice(`${trimmed} created`)
                }}
              >
                <input
                  className="field-control compact-input"
                  placeholder="Design team name..."
                  value={newTeamName}
                  onChange={(event) => setNewTeamName(event.target.value)}
                  autoFocus
                  maxLength={48}
                  required
                />
                <div className="workspace-create-actions">
                  <button type="submit" className="button-primary compact">Create</button>
                  <button type="button" className="button-secondary compact" onClick={() => { setCreatingTeam(false); setNewTeamName('') }}>Cancel</button>
                </div>
              </form>
            ) : (
              <button type="button" className="workspace-add-button" onClick={() => setCreatingTeam(true)}>
                <Plus size={14} /> New design team
              </button>
            )}
          </div>}
        </div>
        <nav id="main-navigation" className="side-nav" aria-label="Main navigation">
          {groups.map((group) => (
            <section className="nav-group" key={group.title}>
              {!collapsed && <div className="nav-heading">{group.title}</div>}
              {group.links.map(({ label, path, icon: Icon }) => (
                <NavLink key={`${group.title}-${label}`} to={path} end={path === '/'} title={collapsed ? label : undefined}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}>
                  <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile-button" title="Open settings" onClick={() => navigate('/settings')}>
            <span className="profile-avatar">{profileInitial}</span>
            {!collapsed && <><span className="profile-copy"><strong>{profileName}</strong><small title={user.email ?? 'Google account'}>{user.email ?? 'Google account'}</small></span><Settings size={15} /></>}
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19} /></button>
            <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{pageNames[pathname] ?? 'Dashboard'}</strong></div>
            <span className="topbar-divider" />
            <button className="project-select" onClick={() => navigate('/projects')} title="Manage projects"><span className="project-dot" />{activeProject?.name ?? 'Your project'}<ChevronDown size={14} /></button>
          </div>
          <div className="topbar-actions">
            <div className="search-wrap">
              <Search size={15} />
              <input ref={searchInputRef} aria-label="Search workspace" placeholder="Search anything..." value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchOpen(false); event.currentTarget.blur() } if (event.key === 'Enter' && searchResults[0]) { navigate(searchResults[0][0]); setSearchOpen(false); setQuery(''); event.currentTarget.blur() } }} />
              <kbd><Command size={10} /> K</kbd>
              {searchOpen && <div className="search-results">{searchResults.length ? searchResults.map(([path, label]) => <Link key={path} to={path} onClick={() => { setSearchOpen(false); setQuery('') }}><Search size={14} />{label}<span>Open</span></Link>) : <div className="search-empty">No matching pages</div>}</div>}
            </div>
            {searchOpen && <button className="search-dismiss" aria-label="Close search" onClick={() => setSearchOpen(false)} />}
            <button className="icon-button header-icon" aria-label="Notifications" title="Notifications" onClick={() => showNotice('You’re all caught up')}><Bell size={17} /></button>
            <button className="icon-button header-icon help-button" aria-label="Help" title="Help" onClick={() => showNotice('Use the sidebar to open a tool, or search for a page from the top bar.')}><CircleHelp size={17} /></button>
            <button
              type="button"
              className="icon-button header-icon theme-toggle"
              aria-label={`Switch to ${activeTheme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${activeTheme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={() => setTheme(activeTheme === 'dark' ? 'light' : 'dark')}
            >
              {activeTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <div ref={exportRef} className={`dropdown-wrap header-export ${exportMenuOpen ? 'menu-open' : ''}`}>
              <button className="export-button" aria-expanded={exportMenuOpen} onClick={() => setExportMenuOpen(!exportMenuOpen)}><Download size={15} /><span>Export</span><ChevronDown size={13} /></button>
              <div className="export-menu">
                <button onClick={exportWorkspace}>All projects backup <small>Full configuration · JSON</small></button>
                <button disabled={!activeProject} onClick={exportFigmaTokens}>Figma Tokens Studio <small>Tokens Studio plugin · active system</small></button>
                <button disabled={!activeProject} onClick={reviewFigmaVariables}>Review &amp; export Figma variables <small>Check color, typography, and spacing first</small></button>
              </div>
            </div>
            <span className={`firebase-sync-indicator ${syncStatus}`} role="status"><i />{syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'error' ? 'Sync error' : 'Cloud synced'}</span>
            <span className="header-avatar" title={profileName}>{profileInitial}</span>
            <button type="button" className="icon-button sign-out-button" aria-label="Sign out" title="Sign out" onClick={onSignOut}><LogOut size={16} /></button>
          </div>
        </header>
        <main className="page-content">
          {syncError && <div className="firebase-sync-error" role="alert">
            <div><strong>Workspace sync issue</strong><span>{syncError}</span></div>
            <button type="button" className="button-secondary compact" onClick={onRetrySync}>Retry sync</button>
          </div>}
          <Outlet />
        </main>
      </div>
      {notice && <div className="toast"><span className="toast-check">✓</span>{notice}</div>}
    </div>
  )
}
