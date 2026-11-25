export type AIProvider = 'gemini' | 'openrouter' | 'openai'

export type AIProviderInfo = {
  id: AIProvider
  label: string
  keyLabel: string
  keyUrl: string
  keyLinkLabel: string
  note: string
}

/** Ordered by preference: the first activated provider with a key generates. */
export const AI_PROVIDERS: AIProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyLabel: 'Gemini API key',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyLinkLabel: 'Get a Gemini API key',
    note: 'A Google AI Studio key, sent straight to gemini-3.8-flash. Google offers a free tier.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyLabel: 'OpenRouter API key',
    keyUrl: 'https://openrouter.ai/keys',
    keyLinkLabel: 'Get an OpenRouter API key',
    note: 'One key for many models, generating through google/gemini-3.8-flash. The OpenRouter account needs credits, so a Gemini key is the free alternative.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    keyLabel: 'OpenAI API key',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyLinkLabel: 'Get an OpenAI API key',
    note: 'A platform.openai.com key, sent to gpt-5.4-mini. The OpenAI account needs billing set up before requests succeed.',
  },
]

export function providerInfo(provider: AIProvider) {
  return AI_PROVIDERS.find((item) => item.id === provider) ?? AI_PROVIDERS[0]
}

export function providerLabel(provider: AIProvider) {
  return providerInfo(provider).label
}
