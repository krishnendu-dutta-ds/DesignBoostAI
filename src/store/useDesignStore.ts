import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { initialProjects } from '../data/seed'
import { createDefaultGradientSettings, createDefaultProjectSettings } from '../data/defaults'
import type { ColorToken, DesignProject, DesignTeam, GradientSettings, ProjectSettingsPatch } from '../types'
import type { GeneratedDesignSystem } from '../utils/aiDesign'

type ThemeMode = 'system' | 'dark' | 'light'

type DesignState = {
  projects: DesignProject[]
  activeProjectId: string
  teams: DesignTeam[]
  activeTeamId: string
  sidebarCollapsed: boolean
  workspaceName: string
  compactDensity: boolean
  theme: ThemeMode
  setActiveProject: (id: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setWorkspaceName: (name: string) => void
  addTeam: (name: string) => DesignTeam
  renameTeam: (id: string, name: string) => void
  deleteTeam: (id: string) => void
  setActiveTeam: (id: string) => void
  replaceTeams: (teams: DesignTeam[], activeTeamId?: string) => void
  setCompactDensity: (compact: boolean) => void
  setTheme: (theme: ThemeMode) => void
  addProject: (name: string) => void
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void
  duplicateProject: (id: string) => void
  updateColor: (index: number, patch: Partial<ColorToken>) => void
  applyPalette: (colors: ColorToken[]) => void
  addColor: (color: ColorToken) => void
  removeColor: (index: number) => void
  updateGradient: (patch: Partial<GradientSettings>) => void
  addToken: (token: DesignProject['tokens'][number]) => void
  applyGeneratedDesign: (projectId: string, design: GeneratedDesignSystem) => number
  removeToken: (name: string) => void
  updateToken: (name: string, patch: Partial<DesignProject['tokens'][number]>) => void
  updateProjectSettings: (patch: ProjectSettingsPatch) => void
  replaceProjects: (projects: DesignProject[], activeProjectId?: string) => void
}

const updated = (project: DesignProject) => ({ ...project, updatedAt: new Date().toISOString() })

function activeTeamIdOf(state: Pick<DesignState, 'teams' | 'activeTeamId'>) {
  return state.teams.find((team) => team.id === state.activeTeamId)?.id ?? state.teams[0]?.id ?? ''
}

function scopedToTeam(projects: DesignProject[], teams: DesignTeam[], teamId: string) {
  if (!teamId) return projects
  const knownTeamIds = new Set(teams.map((team) => team.id))
  return projects.map((project) => (project.teamId && knownTeamIds.has(project.teamId) ? project : { ...project, teamId }))
}

export function projectsForTeam(projects: DesignProject[], teamId: string) {
  return teamId ? projects.filter((project) => project.teamId === teamId) : projects
}

export const useDesignStore = create<DesignState>()(
  persist(
    (set, get) => ({
      projects: initialProjects,
      activeProjectId: '',
      teams: [],
      activeTeamId: '',
      sidebarCollapsed: false,
      workspaceName: 'My workspace',
      compactDensity: false,
      theme: 'system',
      setActiveProject: (id) => set({ activeProjectId: id }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setWorkspaceName: (name) =>
        set((state) => ({
          workspaceName: name,
          teams: state.teams.map((team) => (team.id === state.activeTeamId ? { ...team, name } : team)),
        })),
      addTeam: (name) => {
        const team: DesignTeam = {
          id: `team-${crypto.randomUUID()}`,
          name,
          createdAt: new Date().toISOString(),
        }
        set((state) => {
          const teams = [...state.teams, team]
          return {
            teams,
            activeTeamId: team.id,
            workspaceName: team.name,
            projects: scopedToTeam(state.projects, teams, team.id),
          }
        })
        return team
      },
      renameTeam: (id, name) =>
        set((state) => ({
          teams: state.teams.map((team) => (team.id === id ? { ...team, name } : team)),
          ...(state.activeTeamId === id ? { workspaceName: name } : {}),
        })),
      deleteTeam: (id) =>
        set((state) => {
          const teams = state.teams.filter((team) => team.id !== id)
          const nextActive = state.activeTeamId === id ? (teams[0] ?? null) : (teams.find((team) => team.id === state.activeTeamId) ?? teams[0] ?? null)
          const nextTeamId = nextActive?.id ?? ''
          const projects = nextTeamId
            ? state.projects.map((project) => (project.teamId === id ? { ...project, teamId: nextTeamId } : project))
            : state.projects
          const teamProjects = projectsForTeam(projects, nextTeamId)
          const activeProjectId = teamProjects.some((project) => project.id === state.activeProjectId)
            ? state.activeProjectId
            : (teamProjects[0]?.id ?? state.activeProjectId)
          return {
            teams,
            projects,
            activeProjectId,
            activeTeamId: nextActive?.id ?? '',
            workspaceName: nextActive?.name ?? 'My workspace',
          }
        }),
      setActiveTeam: (id) =>
        set((state) => {
          const target = state.teams.find((team) => team.id === id)
          if (!target) return state
          const teamProject = state.projects.find((project) => project.teamId === target.id)
          return {
            activeTeamId: target.id,
            workspaceName: target.name,
            ...(teamProject ? { activeProjectId: teamProject.id } : {}),
          }
        }),
      replaceTeams: (teams, activeTeamId) =>
        set((state) => {
          const resolvedId = activeTeamId !== undefined
            ? activeTeamId
            : (teams.some((team) => team.id === state.activeTeamId) ? state.activeTeamId : (teams[0]?.id ?? ''))
          const activeTeam = teams.find((team) => team.id === resolvedId) ?? teams[0]
          return {
            teams,
            activeTeamId: activeTeam?.id ?? '',
            workspaceName: activeTeam?.name ?? state.workspaceName,
            projects: activeTeam ? scopedToTeam(state.projects, teams, activeTeam.id) : state.projects,
          }
        }),
      setCompactDensity: (compact) => set({ compactDensity: compact }),
      setTheme: (theme) => set({ theme }),
      addProject: (name) =>
        set((state) => {
          const project: DesignProject = {
            id: `project-${crypto.randomUUID()}`,
            name,
            teamId: activeTeamIdOf(state),
            updatedAt: new Date().toISOString(),
            colors: [],
            tokens: [],
            gradient: createDefaultGradientSettings(),
            settings: createDefaultProjectSettings(),
          }
          return { projects: [project, ...state.projects], activeProjectId: project.id }
        }),
      renameProject: (id, name) =>
        set((state) => ({
          projects: state.projects.map((project) => (project.id === id ? updated({ ...project, name }) : project)),
        })),
      deleteProject: (id) =>
        set((state) => {
          const projects = state.projects.filter((project) => project.id !== id)
          return {
            projects,
            activeProjectId: state.activeProjectId === id ? (projects[0]?.id ?? '') : state.activeProjectId,
          }
        }),
      duplicateProject: (id) =>
        set((state) => {
          const source = state.projects.find((project) => project.id === id)
          if (!source) return state
          const defaults = createDefaultProjectSettings()
          const copy = updated({
            ...source,
            id: `project-${crypto.randomUUID()}`,
            name: `${source.name} copy`,
            teamId: source.teamId || activeTeamIdOf(state),
            colors: source.colors.map((color) => ({ ...color })),
            tokens: source.tokens.map((token) => ({ ...token })),
            gradient: { ...source.gradient ?? createDefaultGradientSettings(source.colors[0]?.value, source.colors[1]?.value) },
            settings: {
              typography: { ...source.settings?.typography ?? defaults.typography },
              spacing: { ...source.settings?.spacing ?? defaults.spacing },
              component: {
                ...defaults.component,
                ...source.settings?.component,
                customComponents: [...(source.settings?.component.customComponents ?? defaults.component.customComponents)],
              },
            },
          })
          return { projects: [copy, ...state.projects], activeProjectId: copy.id }
        }),
      updateColor: (index, patch) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === state.activeProjectId
              ? updated({ ...project, colors: project.colors.map((color, i) => (i === index ? { ...color, ...patch } : color)) })
              : project,
          ),
        })),
      applyPalette: (colors) =>
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== state.activeProjectId) return project
            const paletteColors = colors.map((color) => ({ ...color }))
            const primary = paletteColors.find((color) => color.name.toLowerCase() === 'primary')?.value ?? paletteColors[0]?.value
            const secondary = paletteColors.find((color) => color.name.toLowerCase() === 'secondary')?.value ?? paletteColors[1]?.value
            const colorTokens = paletteColors.map((color) => ({
              name: `color.${color.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
              value: color.value,
              group: 'Colors',
            }))
            return updated({
              ...project,
              colors: paletteColors,
              tokens: [...project.tokens.filter((token) => token.group !== 'Colors'), ...colorTokens],
              gradient: createDefaultGradientSettings(primary, secondary),
            })
          }),
        })),
      addColor: (color) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === state.activeProjectId ? updated({ ...project, colors: [color, ...project.colors] }) : project,
          ),
        })),
      removeColor: (index) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === state.activeProjectId
              ? updated({ ...project, colors: project.colors.filter((_, i) => i !== index) })
              : project,
          ),
        })),
      updateGradient: (patch) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === state.activeProjectId
              ? updated({
                ...project,
                gradient: { ...createDefaultGradientSettings(project.colors[0]?.value, project.colors[1]?.value), ...project.gradient, ...patch },
              })
              : project,
          ),
        })),
      addToken: (token) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === state.activeProjectId ? updated({ ...project, tokens: [...project.tokens, token] }) : project,
          ),
        })),
      applyGeneratedDesign: (projectId, design) => {
        const project = get().projects.find((item) => item.id === projectId)
        if (!project) return 0
        const defaults = createDefaultProjectSettings()
        const current = project.settings ?? defaults
        const colors: ColorToken[] = design.colors.map((color) => ({ name: color.name, value: color.value, category: color.category }))
        const tokens = [...project.tokens]
        let added = 0
        for (const token of design.tokens) {
          const index = tokens.findIndex((item) => item.name === token.name)
          if (index >= 0) tokens[index] = token
          else {
            tokens.push(token)
            added += 1
          }
        }
        const primary = colors.find((color) => color.name.toLowerCase() === 'primary')?.value ?? colors[0]?.value
        const secondary = colors.find((color) => color.name.toLowerCase() === 'secondary')?.value ?? colors[1]?.value
        set((state) => ({
          projects: state.projects.map((item) => item.id === projectId
            ? updated({
              ...item,
              colors,
              tokens,
              gradient: createDefaultGradientSettings(primary, secondary),
              settings: {
                typography: { ...defaults.typography, ...current.typography, ...design.typography },
                spacing: { ...defaults.spacing, ...current.spacing, ...design.spacing },
                component: {
                  ...defaults.component,
                  ...current.component,
                  customComponents: [...(current.component.customComponents ?? defaults.component.customComponents)],
                },
              },
            })
            : item),
        }))
        return added
      },
      removeToken: (name) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === state.activeProjectId
              ? updated({ ...project, tokens: project.tokens.filter((token) => token.name !== name) })
              : project,
          ),
        })),
      updateToken: (name, patch) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === state.activeProjectId
              ? updated({ ...project, tokens: project.tokens.map((token) => (token.name === name ? { ...token, ...patch } : token)) })
              : project,
          ),
        })),
      updateProjectSettings: (patch) =>
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== state.activeProjectId) return project
            const defaults = createDefaultProjectSettings()
            const current = project.settings ?? defaults
            return updated({
              ...project,
              settings: {
                typography: { ...defaults.typography, ...current.typography, ...patch.typography },
                spacing: { ...defaults.spacing, ...current.spacing, ...patch.spacing },
                component: {
                  ...defaults.component,
                  ...current.component,
                  ...patch.component,
                  customComponents: [...(patch.component?.customComponents ?? current.component.customComponents ?? defaults.component.customComponents)],
                },
              },
            })
          }),
        })),
      replaceProjects: (projects, activeProjectId) =>
        set((state) => {
          const teamId = activeTeamIdOf(state)
          const nextProjects = scopedToTeam(projects, state.teams, teamId)
          const teamProjects = projectsForTeam(nextProjects, teamId)
          const preferredId = activeProjectId !== undefined ? activeProjectId : state.activeProjectId
          const resolvedActiveId = teamProjects.some((project) => project.id === preferredId)
            ? preferredId
            : (teamProjects[0]?.id ?? '')
          return { projects: nextProjects, activeProjectId: resolvedActiveId }
        }),
    }),
    {
      name: 'designboost-workspace',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as Record<string, unknown>
        return { ...state, projects: [], activeProjectId: '' } as unknown as DesignState
      },
    },
  ),
)

export function useTeamProjects() {
  const projects = useDesignStore((state) => state.projects)
  const teams = useDesignStore((state) => state.teams)
  const activeTeamId = useDesignStore((state) => state.activeTeamId)
  const team = teams.find((item) => item.id === activeTeamId) ?? teams[0] ?? null
  const teamId = team?.id ?? ''
  const teamProjects = useMemo(() => projectsForTeam(projects, teamId), [projects, teamId])
  return { projects: teamProjects, team }
}
