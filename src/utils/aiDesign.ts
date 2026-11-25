import { normalizeHex } from './color'
import { providerLabel, type AIProvider } from './aiProviders'

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

export type AIGenerationAction = { label: string; url: string }

/** A generation failure that can point the user at a fix, such as adding credits. */
export class AIGenerationError extends Error {
  action?: AIGenerationAction

  constructor(message: string, action?: AIGenerationAction) {
    super(message)
    this.name = 'AIGenerationError'
    this.action = action
  }
}

const GEMINI_MODEL = 'gemini-3.8-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'google/gemini-3.8-flash'
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'
/** Current OpenAI chat models, tried in order when an account cannot use the first one. */
const OPENAI_MODELS = ['gpt-5.4-mini', 'gpt-5.4', 'gpt-4.1-mini']
const COLOR_CATEGORIES = ['Brand', 'Surface', 'Text', 'Status']
const TEXT_TRANSFORMS = ['none', 'uppercase', 'capitalize']

type ResponseSchema = {
  type: string
  description?: string
  enum?: string[]
  properties?: Record<string, ResponseSchema>
  items?: ResponseSchema
  required?: string[]
  propertyOrdering?: string[]
}

const responseSchema: ResponseSchema = {
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

/** Convert the Gemini style schema into standard JSON Schema for OpenRouter structured outputs. */
function toJsonSchema(node: ResponseSchema): Record<string, unknown> {
  const schema: Record<string, unknown> = { type: node.type.toLowerCase() }
  if (node.description) schema.description = node.description
  if (node.enum) schema.enum = node.enum
  if (node.properties) {
    schema.properties = Object.fromEntries(
      Object.entries(node.properties).map(([key, value]) => [key, toJsonSchema(value)]),
    )
    schema.additionalProperties = false
  }
  if (node.required) schema.required = node.required
  if (node.items) schema.items = toJsonSchema(node.items)
  return schema
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

type OpenRouterPayload = {
  choices?: { message?: { content?: string | { text?: string }[] } }[]
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

  if (!colors.length) throw new Error('The model did not return any usable colors. Try a more specific prompt.')
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

function extractJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
}

function parseGeneratedDesign(text: string): GeneratedDesignSystem {
  if (!text.trim()) throw new Error('The model returned an empty response. Try a more specific prompt.')
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonObject(text))
  } catch {
    throw new Error('The model returned a response that was not valid JSON. Try again.')
  }
  return normalizeGeneratedDesign(parsed)
}

async function generateWithGemini(apiKey: string, brief: string, projectName: string): Promise<GeneratedDesignSystem> {
  let response: Response
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
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
  return parseGeneratedDesign(text)
}

async function sendBearerRequest(
  apiKey: string,
  body: Record<string, unknown>,
  url = OPENROUTER_ENDPOINT,
  unreachable = 'Could not reach OpenRouter. Check your connection and try again.',
) {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AIGenerationError(unreachable)
  }

  let payload: OpenRouterPayload | null = null
  try {
    payload = await response.json() as OpenRouterPayload
  } catch {
    payload = null
  }

  return { response, payload }
}

function openRouterError(status: number, message: string) {
  if (status === 401 || status === 403) {
    return new AIGenerationError(
      'OpenRouter rejected this API key. Check the key saved in Settings and try again.',
      { label: 'Check your OpenRouter keys', url: 'https://openrouter.ai/keys' },
    )
  }
  if (status === 402) {
    return new AIGenerationError(
      'This OpenRouter account has no credits left. Add credits at openrouter.ai/credits and generate again — or save a Gemini API key in Settings to use Google\'s free tier instead.',
      { label: 'Add OpenRouter credits', url: 'https://openrouter.ai/credits' },
    )
  }
  if (status === 429) return new AIGenerationError('OpenRouter is rate limiting this key. Wait a moment and try again.')
  if (status === 404 || status === 503) return new AIGenerationError('OpenRouter could not reach a model for this request. Check the OpenRouter status page, then try again.')
  return new AIGenerationError(message ? `OpenRouter error: ${message}` : `OpenRouter request failed with status ${status}.`)
}

function openAIError(status: number, message: string) {
  if (status === 401 || status === 403) {
    return new AIGenerationError(
      'OpenAI rejected this API key. Check the key saved in Settings and try again.',
      { label: 'Check your OpenAI keys', url: 'https://platform.openai.com/api-keys' },
    )
  }
  if (status === 402 || (status === 400 && /billing|quota|credit/i.test(message))) {
    return new AIGenerationError(
      'This OpenAI account cannot be billed for this request. Check the billing and usage limits on platform.openai.com, then generate again — or use a Gemini API key in Settings instead.',
      { label: 'Open OpenAI billing', url: 'https://platform.openai.com/settings/organization/billing/overview' },
    )
  }
  if (status === 429) return new AIGenerationError('OpenAI is rate limiting this key or the account is out of quota. Wait a moment and try again.')
  if (status === 404) {
    return new AIGenerationError(
      `This OpenAI key cannot use any of the models this app requests (${OPENAI_MODELS.join(', ')}). Check the model access on your OpenAI account, then try again.`,
      { label: 'Open OpenAI models', url: 'https://platform.openai.com/settings/organization/limits' },
    )
  }
  return new AIGenerationError(message ? `OpenAI error: ${message}` : `OpenAI request failed with status ${status}.`)
}

async function generateWithOpenAI(apiKey: string, brief: string, projectName: string): Promise<GeneratedDesignSystem> {
  const messages = [
    { role: 'system', content: 'You are a senior design systems engineer. Reply with one JSON object that matches the requested schema, with no markdown or commentary.' },
    { role: 'user', content: buildPrompt(brief, projectName) },
  ]
  const schema = toJsonSchema(responseSchema)
  let response: Response | null = null
  let payload: OpenRouterPayload | null = null

  for (const model of OPENAI_MODELS) {
    const attempt = await sendBearerRequest(apiKey, {
      model,
      messages,
      response_format: { type: 'json_schema', json_schema: { name: 'design_system', strict: true, schema } },
    }, OPENAI_ENDPOINT, 'Could not reach OpenAI. Check your connection and try again.')
    response = attempt.response
    payload = attempt.payload
    if (response.ok) break
    const rejection = payload?.error?.message ?? ''
    const modelUnavailable = response.status === 404 || (response.status === 400 && /model/i.test(rejection))
    if (!modelUnavailable) break
  }

  if (!response) throw new AIGenerationError('OpenAI could not start a request. Try again.')
  if (!response.ok) throw openAIError(response.status, payload?.error?.message ?? '')

  const content = payload?.choices?.[0]?.message?.content
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content) ? content.map((part) => part?.text ?? '').join('') : ''
  return parseGeneratedDesign(text)
}

async function generateWithOpenRouter(apiKey: string, brief: string, projectName: string): Promise<GeneratedDesignSystem> {
  const request = {
    model: OPENROUTER_MODEL,
    messages: [
      { role: 'system', content: 'You are a senior design systems engineer. Reply with one JSON object that matches the requested schema, with no markdown or commentary.' },
      { role: 'user', content: buildPrompt(brief, projectName) },
    ],
    temperature: 0.6,
  }

  let { response, payload } = await sendBearerRequest(apiKey, {
    ...request,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'design_system', strict: true, schema: toJsonSchema(responseSchema) },
    },
  })

  const rejection = payload?.error?.message ?? ''
  if (!response.ok && response.status === 400 && /json|schema|response_format|structured/i.test(rejection)) {
    const fallback = await sendBearerRequest(apiKey, { ...request, response_format: { type: 'json_object' } })
    response = fallback.response
    payload = fallback.payload
  }

  if (!response.ok) throw openRouterError(response.status, payload?.error?.message ?? '')

  const content = payload?.choices?.[0]?.message?.content
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content) ? content.map((part) => part?.text ?? '').join('') : ''
  return parseGeneratedDesign(text)
}

export async function generateDesignSystem(
  provider: AIProvider,
  apiKey: string,
  brief: string,
  projectName: string,
): Promise<GeneratedDesignSystem> {
  const trimmedKey = apiKey.trim()
  if (!trimmedKey) throw new Error(`Add your ${providerLabel(provider)} API key in Settings before generating a design.`)
  if (provider === 'openrouter') return generateWithOpenRouter(trimmedKey, brief, projectName)
  if (provider === 'openai') return generateWithOpenAI(trimmedKey, brief, projectName)
  return generateWithGemini(trimmedKey, brief, projectName)
}
