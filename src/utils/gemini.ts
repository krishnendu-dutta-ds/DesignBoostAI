import { normalizeHex } from './color'

export const TOKEN_GROUPS = ['Colors', 'Typography', 'Spacing', 'Radius'] as const
export type TokenGroup = (typeof TOKEN_GROUPS)[number]
export type GeneratedToken = { name: string; value: string; group: TokenGroup }
export type GeneratedColor = { name: string; value: string; category: string }
export type GeneratedTypography = {
  fontFamily: string
  fontWeight: string
  fontSize: number
  lineHeight: number
  letterSpacing: number
  textTransform: 'none' | 'uppercase' | 'capitalize'
}
export type GeneratedSpacing = {
  baseUnit: number
  containerWidth: number
  columns: number
  gutter: number
  borderRadius: number
}
export type GeneratedDesignSystem = {
  name: string
  description: string
  colors: GeneratedColor[]
  typography: GeneratedTypography
  spacing: GeneratedSpacing
  tokens: GeneratedToken[]
}

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const COLOR_CATEGORIES = ['Brand', 'Surface', 'Text', 'Status']
const TEXT_TRANSFORMS = ['none', 'uppercase', 'capitalize']

const responseSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'A short name for the generated design system.' },
    description: { type: 'STRING', description: 'One sentence describing the visual direction.' },
    colors: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          value: { type: 'STRING' },
          category: { type: 'STRING', enum: [...COLOR_CATEGORIES] },
        },
        required: ['name', 'value', 'category'],
        propertyOrdering: ['name', 'value', 'category'],
      },
    },
    typography: {
      type: 'OBJECT',
      properties: {
        fontFamily: { type: 'STRING' },
        fontWeight: { type: 'STRING' },
        fontSize: { type: 'NUMBER' },
        lineHeight: { type: 'NUMBER' },
        letterSpacing: { type: 'NUMBER' },
        textTransform: { type: 'STRING', enum: [...TEXT_TRANSFORMS] },
      },
      required: ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing', 'textTransform'],
      propertyOrdering: ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing', 'textTransform'],
    },
    spacing: {
      type: 'OBJECT',
      properties: {
        baseUnit: { type: 'NUMBER' },
        containerWidth: { type: 'NUMBER' },
        columns: { type: 'NUMBER' },
        gutter: { type: 'NUMBER' },
        borderRadius: { type: 'NUMBER' },
      },
      required: ['baseUnit', 'containerWidth', 'columns', 'gutter', 'borderRadius'],
      propertyOrdering: ['baseUnit', 'containerWidth', 'columns', 'gutter', 'borderRadius'],
    },
    tokens: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          value: { type: 'STRING' },
          group: { type: 'STRING', enum: [...TOKEN_GROUPS] },
        },
        required: ['name', 'value', 'group'],
        propertyOrdering: ['name', 'value', 'group'],
      },
    },
  },
  required: ['name', 'description', 'colors', 'typography', 'spacing', 'tokens'],
  propertyOrdering: ['name', 'description', 'colors', 'typography', 'spacing', 'tokens'],
}

function buildPrompt(brief: string, projectName: string) {
  return [
    `You are a senior design systems engineer. Create a complete design system for the project "${projectName}".`,
    `Brief from the designer: ${brief}`,
    '',
    'Return JSON only, matching the provided schema.',
    'Rules:',
    '- colors: 6 to 10 clearly different colors. Use category Brand for brand colors, Surface for backgrounds and containers, Text for text colors, Status for success/warning/error colors.',
    '- Colors values must be 6 digit hex codes such as #1F6F5C. Every text color must have a readable contrast against the main surface color.',
    '- typography: a web safe or Google Font family name without fallbacks, a weight from 100 to 900, a base font size between 12 and 48, a line height between 1 and 2, letter spacing between -2 and 4, and a text transform of none, uppercase or capitalize.',
    '- spacing: base unit between 2 and 8, container width between 960 and 1440, columns of 4, 8 or 12, a gutter of 16, 24 or 32, and a border radius between 0 and 50.',
    '- tokens: 12 to 28 tokens that cover Colors, Typography, Spacing and Radius, using lowercase dot notation with kebab-case segments (for example color.brand.primary, spacing.scale.4).',
    '- Spacing and Radius token values must include a unit, for example 8px or 1.5rem.',
    '- Never repeat a token name.',
    '- Use "name" for a short design system name and "description" for one sentence about the direction.',
  ].join('\n')
}

type GeminiPayload = {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
  error?: { message?: string }
}

function numberFrom(value: unknown, fallback: number) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step
}

function normalizeCategory(value: unknown) {
  const key = String(value ?? '').trim().toLowerCase()
  if (key.startsWith('surface') || key.startsWith('background') || key.startsWith('neutral')) return 'Surface'
  if (key.startsWith('text') || key.startsWith('content') || key.startsWith('foreground')) return 'Text'
  if (key.startsWith('status') || key.startsWith('feedback') || key.startsWith('semantic') || key.startsWith('state')) return 'Status'
  return 'Brand'
}

function normalizeGroup(value: unknown): TokenGroup | null {
  const key = String(value ?? '').trim().toLowerCase()
  if (key.startsWith('color')) return 'Colors'
  if (key.startsWith('typograph') || key === 'type') return 'Typography'
  if (key.startsWith('spacing') || key.startsWith('space')) return 'Spacing'
  if (key.startsWith('radius') || key.includes('border-radius') || key.includes('borderradius')) return 'Radius'
  return null
}

function normalizeTokenName(value: unknown) {
  if (typeof value !== 'string') return ''
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '')
}

function normalizeTokenValue(group: TokenGroup | null, value: unknown) {
  const raw = typeof value === 'string'
    ? value
    : typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
  const trimmed = raw.trim()
  if (!group || !trimmed) return ''
  if (group === 'Colors') return normalizeHex(trimmed) ?? ''
  if (group === 'Spacing' || group === 'Radius') {
    return /^-?\d+(?:\.\d+)?(?:px|rem|em|%)$/i.test(trimmed) ? trimmed.toLowerCase() : ''
  }
  return trimmed
}

function normalizeColors(value: unknown): GeneratedColor[] {
  const entries = Array.isArray(value) ? value : []
  const colors: GeneratedColor[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    const colorValue = typeof item.value === 'string' ? normalizeHex(item.value) : null
    if (!colorValue) continue
    const name = (typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `Color ${colors.length + 1}`).slice(0, 40)
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    colors.push({ name, value: colorValue, category: normalizeCategory(item.category) })
    if (colors.length === 12) break
  }

  if (!colors.length) throw new Error('Gemini did not return any usable colors. Try a more specific prompt.')
  return colors
}

function normalizeTypography(value: unknown): GeneratedTypography {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const family = typeof record.fontFamily === 'string'
    ? record.fontFamily.trim().replace(/^["']|["']$/g, '').slice(0, 48)
    : ''
  const weight = String(record.fontWeight ?? '').trim()
  const transform = String(record.textTransform ?? '').trim().toLowerCase()

  return {
    fontFamily: family || 'Inter',
    fontWeight: /^[1-9]00$/.test(weight) ? weight : '500',
    fontSize: Math.round(clamp(numberFrom(record.fontSize, 16), 12, 48)),
    lineHeight: Number(clamp(numberFrom(record.lineHeight, 1.5), 1, 2).toFixed(1)),
    letterSpacing: Number(clamp(numberFrom(record.letterSpacing, 0), -2, 4).toFixed(1)),
    textTransform: TEXT_TRANSFORMS.includes(transform)
      ? transform as GeneratedTypography['textTransform']
      : 'none',
  }
}

function normalizeSpacing(value: unknown): GeneratedSpacing {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const columnsValue = numberFrom(record.columns, 12)
  const gutterValue = numberFrom(record.gutter, 24)

  return {
    baseUnit: Math.round(clamp(numberFrom(record.baseUnit, 4), 2, 8)),
    containerWidth: roundTo(clamp(numberFrom(record.containerWidth, 1200), 960, 1440), 24),
    columns: columnsValue <= 6 ? 4 : columnsValue <= 10 ? 8 : 12,
    gutter: gutterValue <= 20 ? 16 : gutterValue <= 28 ? 24 : 32,
    borderRadius: Math.round(clamp(numberFrom(record.borderRadius, 8), 0, 50)),
  }
}

function normalizeTokens(value: unknown, colors: GeneratedColor[]): GeneratedToken[] {
  const entries = Array.isArray(value) ? value : []
  const tokens: GeneratedToken[] = []
  const seen = new Set<string>()

  const addToken = (name: string, tokenValue: string, group: TokenGroup) => {
    if (!name || !tokenValue || seen.has(name)) return false
    seen.add(name)
    tokens.push({ name, value: tokenValue, group })
    return true
  }

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    const group = normalizeGroup(item.group)
    if (!group) continue
    addToken(normalizeTokenName(item.name), normalizeTokenValue(group, item.value), group)
  }

  for (const color of colors) {
    addToken(`color.${color.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, color.value, 'Colors')
  }

  return tokens
}

function normalizeGeneratedDesign(value: unknown): GeneratedDesignSystem {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const colors = normalizeColors(record.colors)

  return {
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim().slice(0, 80) : 'Generated design system',
    description: typeof record.description === 'string' ? record.description.trim().slice(0, 240) : '',
    colors,
    typography: normalizeTypography(record.typography),
    spacing: normalizeSpacing(record.spacing),
    tokens: normalizeTokens(record.tokens, colors),
  }
}

export async function generateDesignSystem(apiKey: string, brief: string, projectName: string): Promise<GeneratedDesignSystem> {
  if (!apiKey.trim()) throw new Error('Add your Gemini API key in Settings before generating a design.')

  let response: Response
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey.trim())}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(brief, projectName) }] }],
        generationConfig: {
          temperature: 0.6,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    })
  } catch {
    throw new Error('Could not reach the Gemini API. Check your connection and try again.')
  }

  let payload: GeminiPayload | null = null
  try {
    payload = await response.json() as GeminiPayload
  } catch {
    payload = null
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new Error('Gemini rejected this API key. Check the key saved in Settings and try again.')
    }
    if (response.status === 429) {
      throw new Error('This Gemini API key has reached its rate limit or quota. Wait a moment or use another key.')
    }
    throw new Error(payload?.error?.message
      ? `Gemini API error: ${payload.error.message}`
      : `Gemini request failed with status ${response.status}.`)
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? ''
  if (!text) throw new Error('Gemini returned an empty response. Try a more specific prompt.')

  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Gemini returned a response that was not valid JSON. Try again.')
  }

  return normalizeGeneratedDesign(parsed)
}
