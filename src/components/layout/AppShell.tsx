import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Accessibility, Bell, Blocks, BookOpen, ChevronDown, ChevronsLeft, ChevronsRight, CircleHelp,
  Command, Download, FolderKanban, Gauge, LayoutDashboard, LogOut, Menu, Palette,
  Search, Settings, SlidersHorizontal, Sparkles, Type, X,
} from 'lucide-react'
import type { User } from 'firebase/auth'
import { useDesignStore } from '../../store/useDesignStore'
import { createFigmaVariablesDocument, createTokensStudioDocument, createWorkspaceBackup, downloadJson } from '../../utils/projectExport'

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
    { label: 'Design audit', path: '/accessibility', icon: Gauge },
  ] },
  { title: 'Workspace', links: [
    { label: 'My projects', path: '/projects', icon: FolderKanban },
    { label: 'Saved systems', path: '/systems', icon: BookOpen },
    { label: 'Settings', path: '/settings', icon: Settings },
  ] },
]

const pageNames: Record<string, string> = {
  '/': 'Dashboard', '/colors': 'Color studio', '/typography': 'Typography',
  '/spacing': 'Spacing', '/tokens': 'Design tokens',
  '/accessibility': 'Accessibility',
  '/projects': 'My projects', '/systems': 'Saved systems', '/settings': 'Settings',
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
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const projects = useDesignStore((state) => state.projects)
  const workspaceName = useDesignStore((state) => state.workspaceName)
  const activeProjectId = useDesignStore((state) => state.activeProjectId)
  const setActiveProject = useDesignStore((state) => state.setActiveProject)
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0]
  const profileName = user.displayName || user.email || 'Google user'
  const profileInitial = profileName.charAt(0).toUpperCase()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const searchResults = useMemo(
    () => Object.entries(pageNames).filter(([path, label]) => label.toLowerCase().includes(query.toLowerCase()) && path !== '/'),
    [query],
  )

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }
  const exportWorkspace = () => {
    downloadJson('designboost-workspace-backup.json', createWorkspaceBackup(projects, activeProjectId))
    setExportMenuOpen(false)
    showNotice(`${projects.length} project${projects.length === 1 ? '' : 's'} saved in workspace backup`)
  }
  const exportFigmaTokens = () => {
    if (!activeProject) return
    downloadJson(`${projectSlug(activeProject.name)}-tokens-studio.json`, createTokensStudioDocument(activeProject))
    setExportMenuOpen(false)
    showNotice('Tokens Studio JSON exported for Figma')
  }
  const exportFigmaVariables = () => {
    if (!activeProject) return
    downloadJson(`${projectSlug(activeProject.name)}-figma-variables.json`, createFigmaVariablesDocument(activeProject))
    setExportMenuOpen(false)
    showNotice('Complete W3C design variables exported for Figma import.')
  }

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="brand-row">
          <Link to="/" className="brand-mark" aria-label="DesignBoost AI home"><Sparkles size={18} /></Link>
          {!collapsed && <span className="brand-name">designboost<span>ai</span></span>}
          <button className="icon-button sidebar-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="main-navigation" title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={17} /></button>
        </div>
        <button className="workspace-switcher" aria-expanded={workspaceMenuOpen} onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}>
          <span className="workspace-avatar">D</span>
          {!collapsed && <><span className="workspace-copy"><strong>{workspaceName}</strong><small>Personal workspace</small></span><ChevronDown size={15} /></>}
        </button>
        {workspaceMenuOpen && <div className="workspace-menu">{projects.length ? projects.map((project) => <button key={project.id} className={project.id === activeProject?.id ? 'active' : ''} onClick={() => { setActiveProject(project.id); setWorkspaceMenuOpen(false) }}><span className="project-dot" />{project.name}{project.id === activeProject?.id && <span className="workspace-current">Active</span>}</button>) : <span className="workspace-empty">Create a project to get started</span>}</div>}
        <nav id="main-navigation" className="side-nav" aria-label="Main navigation">
          {groups.map((group) => (
            <section className="nav-group" key={group.title}>
              {!collapsed && <div className="nav-heading">{group.title}</div>}
              {group.links.map(({ label, path, icon: Icon }) => (
                <NavLink key={`${group.title}-${label}`} to={path} end={path === '/'} title={collapsed ? label : undefined}
                  className={({ isActive }) => `nav-link ${isActive && label !== 'Design audit' ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}>
                  <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="usage-card">
            {!collapsed ? <><div className="usage-head"><span>Workspace usage</span><span>68%</span></div><div className="usage-track"><i /></div><small>68 of 100 tokens used</small></> : <Gauge size={18} />}
          </div>
          <button className="profile-button" title="Open settings" onClick={() => navigate('/settings')}>
            <span className="profile-avatar">{profileInitial}</span>
            {!collapsed && <><span className="profile-copy"><strong>{profileName}</strong><small>{user.email ?? 'Google account'}</small></span><Settings size={15} /></>}
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
              <input aria-label="Search workspace" placeholder="Search anything..." value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }} onFocus={() => setSearchOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); if (event.key === 'Enter' && searchResults[0]) { navigate(searchResults[0][0]); setSearchOpen(false); setQuery('') } }} />
              <kbd><Command size={10} /> K</kbd>
              {searchOpen && query && <div className="search-results">{searchResults.length ? searchResults.map(([path, label]) => <Link key={path} to={path} onClick={() => { setSearchOpen(false); setQuery('') }}><Search size={14} />{label}<span>Open</span></Link>) : <div className="search-empty">No matching pages</div>}</div>}
            </div>
            {searchOpen && <button className="search-dismiss" aria-label="Close search" onClick={() => setSearchOpen(false)} />}
            <button className="icon-button header-icon" aria-label="Notifications" title="Notifications" onClick={() => showNotice('You’re all caught up')}><Bell size={17} /></button>
            <button className="icon-button header-icon help-button" aria-label="Help" title="Help" onClick={() => showNotice('Use the sidebar to open a tool, or search for a page from the top bar.')}><CircleHelp size={17} /></button>
            <div className={`dropdown-wrap header-export ${exportMenuOpen ? 'menu-open' : ''}`}>
              <button className="export-button" aria-expanded={exportMenuOpen} onClick={() => setExportMenuOpen(!exportMenuOpen)}><Download size={15} /><span>Export</span><ChevronDown size={13} /></button>
              <div className="export-menu">
                <button onClick={exportWorkspace}>All projects backup <small>Full configuration · JSON</small></button>
                <button disabled={!activeProject} onClick={exportFigmaTokens}>Figma Tokens Studio <small>Tokens Studio plugin · active system</small></button>
                <button disabled={!activeProject} onClick={exportFigmaVariables}>Figma Variables JSON <small>W3C DTCG · color, spacing, margin and typography</small></button>
              </div>
            </div>
            <span className={`firebase-sync-indicator ${syncStatus}`} role="status"><i />{syncStatus === 'syncing' ? 'Syncing' : syncStatus === 'error' ? 'Sync error' : 'Firebase synced'}</span>
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
