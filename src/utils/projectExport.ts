import type {
  DesignProject,
  FigmaColorValue,
  FigmaVariableGroup,
  FigmaVariableToken,
  TokensStudioDocument,
  TokensStudioGroup,
  TokensStudioToken,
  WorkspaceBackup,
} from '../types'
import { createDefaultGradientSettings, createDefaultProjectSettings } from '../data/defaults'
import { createTypographyStyleTokens } from '../data/typographyScale'
import { normalizeHex, rgbFromHex } from './color'

export function createWorkspaceBackup(projects: DesignProject[], activeProjectId: string): WorkspaceBackup {
  return {
    format: 'designboost-workspace',
    version: 1,
    exportedAt: new Date().toISOString(),
    activeProjectId,
    projects: projects.map((project) => normalizeProject(project)),
  }
}

function isToken(value: TokensStudioToken | TokensStudioGroup): value is TokensStudioToken {
  return 'value' in value && 'type' in value
}

function insertToken(group: TokensStudioGroup, name: string, value: string | number, type: string) {
  const segments = name
    .split(/[./]/)
    .map((segment) => segment.trim().replace(/[^a-zA-Z0-9_-]/g, '-'))
    .filter(Boolean)
  if (!segments.length) return

  let current = group
  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment]
    if (!existing || isToken(existing)) current[segment] = {}
    const next = current[segment]
    if (!next || isToken(next)) return
    current = next
  }
  current[segments[segments.length - 1]] = { value, type }
}

function tokenType(group: string, name: string) {
  if (group === 'Colors') return 'color'
  if (group === 'Spacing') return 'spacing'
  if (group === 'Radius') return 'borderRadius'
  if (group === 'Typography' && /font(\.|-)|family/i.test(name)) return 'fontFamilies'
  return 'other'
}

export function createTokensStudioDocument(project: DesignProject): TokensStudioDocument {
  const tokenSetName = project.name.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'design-system'
  const tokens: TokensStudioGroup = {}
  const settings = project.settings ?? createDefaultProjectSettings()

  for (const color of project.colors) {
    insertToken(tokens, `color.${color.category}.${color.name}`, color.value, 'color')
  }
  for (const token of project.tokens) {
    const value = token.group === 'Typography' && /font(\.|-)|family/i.test(token.name)
      ? token.value.replace(/,\s*(sans-serif|serif|monospace)\s*$/i, '')
      : token.value
    insertToken(tokens, token.name, value, tokenType(token.group, token.name))
  }
  const typography = settings.typography
  insertToken(tokens, 'typography.font-family', typography.fontFamily, 'fontFamilies')
  insertToken(tokens, 'typography.font-weight', typography.fontWeight, 'fontWeights')
  insertToken(tokens, 'typography.font-size', `${typography.fontSize}px`, 'fontSizes')
  insertToken(tokens, 'typography.line-height', `${Number((typography.lineHeight * 100).toFixed(2))}%`, 'lineHeights')
  insertToken(tokens, 'typography.letter-spacing', `${typography.letterSpacing}px`, 'letterSpacing')
  insertToken(tokens, 'typography.text-case', typography.textTransform, 'textCase')
  for (const token of createTypographyStyleTokens(typography)) {
    insertToken(tokens, token.name, token.type === 'fontWeights' ? Number(token.value) : token.value, token.type)
  }

  const spacing = settings.spacing
  const spacingSteps = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24]
  spacingSteps.forEach((step, index) => {
    insertToken(tokens, `spacing.scale.${index + 1}`, `${step * spacing.baseUnit}px`, 'spacing')
  })
  insertToken(tokens, 'layout.container-width', `${spacing.containerWidth}px`, 'sizing')
  insertToken(tokens, 'layout.columns', spacing.columns, 'number')
  insertToken(tokens, 'layout.gutter', `${spacing.gutter}px`, 'spacing')
  insertToken(tokens, 'radius.default', `${spacing.borderRadius}px`, 'borderRadius')
  insertToken(tokens, 'component.button.radius', `${settings.component.radius}px`, 'borderRadius')
  const componentPadding = settings.component.size === 'Small' ? '8px 13px' : settings.component.size === 'Large' ? '14px 22px' : '11px 17px'
  insertToken(tokens, 'component.button.padding', componentPadding, 'spacing')
  insertToken(tokens, 'component.button.label', settings.component.label, 'text')

  return {
    [tokenSetName]: tokens,
    $metadata: { tokenSetOrder: [tokenSetName] },
  }
}

function isFigmaVariableToken(value: unknown): value is FigmaVariableToken {
  return !!value && typeof value === 'object' && '$value' in value
}

function insertFigmaVariable(group: FigmaVariableGroup, name: string, value: string | number | boolean | FigmaColorValue, type: 'color' | 'number' | 'string' | 'boolean') {
  if (type === 'number' && typeof value === 'number' && !Number.isFinite(value)) return
  const segments = name
    .split(/[./]/)
    .map((segment) => segment.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
  if (!segments.length) return

  let current = group
  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment]
    if (isFigmaVariableToken(existing)) return
    if (!existing) current[segment] = {}
    const next = current[segment]
    if (!next || typeof next !== 'object' || isFigmaVariableToken(next)) return
    current = next
  }
  const leafName = segments[segments.length - 1]
  if (!current[leafName]) current[leafName] = { $value: value, $type: type }
}

function parseFigmaNumber(value: string) {
  const match = value.trim().match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))\s*(px|rem)?$/i)
  if (!match) return null
  const numericValue = Number(match[1]) * (match[2]?.toLowerCase() === 'rem' ? 16 : 1)
  return Number.isFinite(numericValue) ? numericValue : null
}

function createFigmaColorValue(hex: string): FigmaColorValue | null {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const { r, g, b } = rgbFromHex(normalized)
  return {
    colorSpace: 'srgb',
    components: [r / 255, g / 255, b / 255],
    alpha: 1,
    hex: normalized,
  }
}

export function createFigmaVariablesDocument(project: DesignProject): FigmaVariableGroup {
  const variables: FigmaVariableGroup = {}
  const colorVariables = createFigmaColorVariablesDocument(project)
  if (Object.keys(colorVariables).length > 0) {
    variables.color = { $type: 'color', ...colorVariables }
  }
  const settings = project.settings ?? createDefaultProjectSettings()
  for (const token of createTypographyStyleTokens(settings.typography)) {
    const number = parseFigmaNumber(token.value)
    if (number !== null) insertFigmaVariable(variables, token.name, number, 'number')
    else insertFigmaVariable(variables, token.name, token.value, 'string')
  }

  for (const token of project.tokens) {
    if (token.group === 'Colors') continue

    const color = createFigmaColorValue(token.value)
    if (color) {
      insertFigmaVariable(variables, token.name, color, 'color')
      continue
    }

    const number = parseFigmaNumber(token.value)
    if (number !== null) {
      insertFigmaVariable(variables, token.name, number, 'number')
    } else if (/^(true|false)$/i.test(token.value.trim())) {
      insertFigmaVariable(variables, token.name, token.value.trim().toLowerCase() === 'true', 'boolean')
    } else {
      insertFigmaVariable(variables, token.name, token.value, 'string')
    }
  }

  const spacing = settings.spacing
  ;[1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24].forEach((step, index) => {
    const value = step * spacing.baseUnit
    insertFigmaVariable(variables, `spacing.scale.${index + 1}`, value, 'number')
    insertFigmaVariable(variables, `margin.scale.${index + 1}`, value, 'number')
  })
  insertFigmaVariable(variables, 'spacing.base-unit', spacing.baseUnit, 'number')
  insertFigmaVariable(variables, 'margin.container', spacing.containerWidth, 'number')
  insertFigmaVariable(variables, 'layout.container-width', spacing.containerWidth, 'number')
  insertFigmaVariable(variables, 'layout.columns', spacing.columns, 'number')
  insertFigmaVariable(variables, 'layout.gutter', spacing.gutter, 'number')
  insertFigmaVariable(variables, 'radius.default', spacing.borderRadius, 'number')

  const typography = settings.typography
  insertFigmaVariable(variables, 'typography.font-family', typography.fontFamily, 'string')
  insertFigmaVariable(variables, 'typography.font-size', typography.fontSize, 'number')
  const fontWeight = Number(typography.fontWeight)
  if (Number.isFinite(fontWeight)) insertFigmaVariable(variables, 'typography.font-weight', fontWeight, 'number')
  else insertFigmaVariable(variables, 'typography.font-weight', typography.fontWeight, 'string')
  insertFigmaVariable(variables, 'typography.line-height', typography.lineHeight, 'number')
  insertFigmaVariable(variables, 'typography.letter-spacing', typography.letterSpacing, 'number')
  insertFigmaVariable(variables, 'typography.text-case', typography.textTransform, 'string')

  insertFigmaVariable(variables, 'component.button.radius', settings.component.radius, 'number')
  const horizontalPadding = settings.component.size === 'Small' ? 13 : settings.component.size === 'Large' ? 22 : 17
  const verticalPadding = settings.component.size === 'Small' ? 8 : settings.component.size === 'Large' ? 14 : 11
  insertFigmaVariable(variables, 'component.button.padding-horizontal', horizontalPadding, 'number')
  insertFigmaVariable(variables, 'component.button.padding-vertical', verticalPadding, 'number')

  return variables
}

export function createFigmaColorVariablesDocument(project: Pick<DesignProject, 'colors' | 'tokens'>): FigmaVariableGroup {
  const variables: FigmaVariableGroup = {}

  for (const color of project.colors) {
    const value = createFigmaColorValue(color.value)
    if (value) {
      const category = color.category.trim() || 'Brand'
      insertFigmaVariable(variables, `${category}/${color.name}`, value, 'color')
    }
  }

  for (const token of project.tokens) {
    if (token.group !== 'Colors') continue
    const value = createFigmaColorValue(token.value)
    if (value) {
      const name = token.name.replace(/^color[./]/i, '')
      insertFigmaVariable(variables, name || token.name, value, 'color')
    }
  }

  return variables
}

export function normalizeProject(project: DesignProject): DesignProject {
  const defaults = createDefaultProjectSettings()
  const settings = project.settings ?? defaults
  return {
    ...project,
    colors: project.colors.map((color) => ({ ...color })),
    tokens: project.tokens.map((token) => ({ ...token })),
    gradient: { ...createDefaultGradientSettings(project.colors[0]?.value, project.colors[1]?.value), ...project.gradient },
    settings: {
      typography: { ...defaults.typography, ...settings.typography },
      spacing: { ...defaults.spacing, ...settings.spacing },
      component: {
        ...defaults.component,
        ...settings.component,
        customComponents: [...(settings.component.customComponents ?? defaults.component.customComponents)],
      },
    },
  }
}

export function isDesignProject(value: unknown): value is DesignProject {
  if (!value || typeof value !== 'object') return false
  const project = value as Record<string, unknown>
  return typeof project.id === 'string'
    && typeof project.name === 'string'
    && typeof project.updatedAt === 'string'
    && Array.isArray(project.colors)
    && project.colors.every((color) => {
      if (!color || typeof color !== 'object') return false
      const item = color as Record<string, unknown>
      return typeof item.name === 'string' && typeof item.value === 'string' && typeof item.category === 'string'
    })
    && Array.isArray(project.tokens)
    && project.tokens.every((token) => {
      if (!token || typeof token !== 'object') return false
      const item = token as Record<string, unknown>
      return typeof item.name === 'string' && typeof item.value === 'string' && typeof item.group === 'string'
    })
    && (project.gradient === undefined || isGradientSettings(project.gradient))
    && (project.settings === undefined || isProjectSettings(project.settings))
}

function isGradientSettings(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const gradient = value as Record<string, unknown>
  return (gradient.type === 'linear' || gradient.type === 'radial')
    && typeof gradient.angle === 'number' && gradient.angle >= 0 && gradient.angle <= 360
    && typeof gradient.startColor === 'string' && /^#[\da-f]{6}$/i.test(gradient.startColor)
    && typeof gradient.endColor === 'string' && /^#[\da-f]{6}$/i.test(gradient.endColor)
}

function isProjectSettings(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const settings = value as Record<string, unknown>
  const typography = settings.typography as Record<string, unknown> | undefined
  const spacing = settings.spacing as Record<string, unknown> | undefined
  const component = settings.component as Record<string, unknown> | undefined
  return Boolean(typography && typeof typography.fontFamily === 'string' && typeof typography.fontWeight === 'string'
    && typeof typography.fontSize === 'number' && typeof typography.lineHeight === 'number'
    && typeof typography.letterSpacing === 'number' && typeof typography.mobile === 'boolean'
    && ['none', 'uppercase', 'capitalize'].includes(String(typography.textTransform))
    && spacing && typeof spacing.baseUnit === 'number' && typeof spacing.containerWidth === 'number'
    && typeof spacing.columns === 'number' && typeof spacing.gutter === 'number' && typeof spacing.borderRadius === 'number'
    && component && typeof component.name === 'string' && typeof component.state === 'string'
    && typeof component.size === 'string' && typeof component.radius === 'number' && typeof component.label === 'string'
    && (component.customComponents === undefined || (Array.isArray(component.customComponents) && component.customComponents.every((item) => typeof item === 'string'))))
}

export function isWorkspaceBackup(value: unknown): value is WorkspaceBackup {
  if (!value || typeof value !== 'object') return false
  const backup = value as Record<string, unknown>
  return backup.format === 'designboost-workspace'
    && backup.version === 1
    && typeof backup.exportedAt === 'string'
    && typeof backup.activeProjectId === 'string'
    && Array.isArray(backup.projects)
    && backup.projects.every(isDesignProject)
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
