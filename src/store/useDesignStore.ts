import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { initialProjects } from '../data/seed'
import { createDefaultGradientSettings, createDefaultProjectSettings } from '../data/defaults'
import type { ColorToken, DesignProject, GradientSettings, ProjectSettingsPatch } from '../types'

type ThemeMode = 'system' | 'dark' | 'light'

type DesignState = {
  projects: DesignProject[]
  activeProjectId: string
  sidebarCollapsed: boolean
  workspaceName: string
  compactDensity: boolean
  theme: ThemeMode
  setActiveProject: (id: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setWorkspaceName: (name: string) => void
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
  removeToken: (name: string) => void
  updateToken: (name: string, patch: Partial<DesignProject['tokens'][number]>) => void
  updateProjectSettings: (patch: ProjectSettingsPatch) => void
  replaceProjects: (projects: DesignProject[], activeProjectId?: string) => void
}

const updated = (project: DesignProject) => ({ ...project, updatedAt: new Date().toISOString() })

export const useDesignStore = create<DesignState>()(
  persist(
    (set) => ({
      projects: initialProjects,
      activeProjectId: '',
      sidebarCollapsed: false,
      workspaceName: 'My workspace',
      compactDensity: false,
      theme: 'system',
      setActiveProject: (id) => set({ activeProjectId: id }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setWorkspaceName: (name) => set({ workspaceName: name }),
      setCompactDensity: (compact) => set({ compactDensity: compact }),
      setTheme: (theme) => set({ theme }),
      addProject: (name) =>
        set((state) => {
          const project: DesignProject = {
            id: `project-${crypto.randomUUID()}`,
            name,
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
            project.id === state.activeProjectId ? updated({ ...project, colors: [...project.colors, color] }) : project,
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
        set({
          projects,
          ...(activeProjectId !== undefined ? { activeProjectId } : {}),
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
