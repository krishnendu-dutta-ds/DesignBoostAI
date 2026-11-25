import googleFonts from '../data/googleFonts.json'
import { getFontFamilyStack } from './fontFamily'

export { getFontFamilyStack } from './fontFamily'

export type GoogleFont = (typeof googleFonts)[number]

export const GOOGLE_FONTS: GoogleFont[] = googleFonts
const googleFontStylesheets = new Map<string, Promise<void>>()

export function getGoogleFontUrl(font: GoogleFont) {
  const family = encodeURIComponent(font.family).replace(/%20/g, '+')
  const weights = font.variable && font.weightRange
    ? `${font.weightRange[0]}..${font.weightRange[1]}`
    : font.weights.join(';')
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap`
}

export function ensureGoogleFontLoaded(font: GoogleFont) {
  const cached = googleFontStylesheets.get(font.family)
  if (cached) return cached

  const stylesheet = document.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = getGoogleFontUrl(font)
  const loading = new Promise<void>((resolve, reject) => {
    stylesheet.onload = () => resolve()
    stylesheet.onerror = () => reject(new Error(`Google Font could not be loaded: ${font.family}`))
  })

  googleFontStylesheets.set(font.family, loading)
  document.head.appendChild(stylesheet)
  void loading.catch(() => googleFontStylesheets.delete(font.family))
  return loading
}

export function getGoogleFontSpecimenUrl(font: GoogleFont) {
  const family = encodeURIComponent(font.family).replace(/%20/g, '+')
  return `https://fonts.google.com/specimen/${family}`
}

export function getGoogleFontCss(font: GoogleFont) {
  return `@import url("${getGoogleFontUrl(font)}");\n\n:root {\n  --font-family: ${getFontFamilyStack(font.family, font.category)};\n}`
}

export function getNearestGoogleFontWeight(font: GoogleFont, preferredWeight: string) {
  const preferred = Number(preferredWeight)
  return String([...font.weights].sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))[0] ?? 400)
}
