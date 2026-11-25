export type ColorToken = { name: string; value: string; category: string }
export type GradientSettings = {
  type: 'linear' | 'radial'
  angle: number
  startColor: string
  endColor: string
}
export type ProjectSettings = {
  typography: {
    fontFamily: string
    fontWeight: string
    fontSize: number
    lineHeight: number
    letterSpacing: number
    textTransform: 'none' | 'uppercase' | 'capitalize'
    mobile: boolean
  }
  spacing: {
    baseUnit: number
    containerWidth: number
    columns: number
    gutter: number
    borderRadius: number
  }
  component: {
    name: string
    state: string
    size: string
    radius: number
    label: string
    customComponents: string[]
  }
}
export type ProjectSettingsPatch = {
  typography?: Partial<ProjectSettings['typography']>
  spacing?: Partial<ProjectSettings['spacing']>
  component?: Partial<ProjectSettings['component']>
}
export type DesignProject = {
  id: string
  name: string
  updatedAt: string
  colors: ColorToken[]
  tokens: { name: string; value: string; group: string }[]
  gradient?: GradientSettings
  settings?: ProjectSettings
}

export type WorkspaceBackup = {
  format: 'designboost-workspace'
  version: 1
  exportedAt: string
  activeProjectId: string
  projects: DesignProject[]
}

export type TokensStudioToken = { value: string | number; type: string }
export interface TokensStudioGroup {
  [key: string]: TokensStudioToken | TokensStudioGroup
}
export type TokensStudioDocument = {
  $metadata: { tokenSetOrder: string[] }
  [tokenSetName: string]: TokensStudioGroup | { tokenSetOrder: string[] }
}
export type FigmaColorValue = {
  colorSpace: 'srgb'
  components: [number, number, number]
  alpha: number
  hex: string
}
export type FigmaVariableToken = { $value: string | number | boolean | FigmaColorValue; $type?: 'color' | 'number' | 'string' | 'boolean' }
export interface FigmaVariableGroup {
  $schema?: string
  $description?: string
  $type?: 'color' | 'number'
  [key: string]: FigmaVariableToken | FigmaVariableGroup | string | number | boolean | undefined
}
