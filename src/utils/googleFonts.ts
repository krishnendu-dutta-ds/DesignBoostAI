import googleFonts from '../data/googleFonts.json'

export type GoogleFont = (typeof googleFonts)[number]

export const GOOGLE_FONTS: GoogleFont[] = googleFonts

export function getGoogleFontUrl(font: GoogleFont) {
  const family = encodeURIComponent(font.family).replace(/%20/g, '+')
  const weights = font.variable && font.weightRange
    ? `${font.weightRange[0]}..${font.weightRange[1]}`
    : font.weights.join(';')
  return `https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap`
}

export function getGoogleFontSpecimenUrl(font: GoogleFont) {
  const family = encodeURIComponent(font.family).replace(/%20/g, '+')
  return `https://fonts.google.com/specimen/${family}`
}

export function getFontFamilyStack(family: string, category?: string) {
  const quotedFamily = `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const fallback = category === 'Serif' ? 'serif' : category === 'Monospace' ? 'monospace' : category === 'Handwriting' ? 'cursive' : 'sans-serif'
  return `${quotedFamily}, ${fallback}`
}

export function getGoogleFontCss(font: GoogleFont) {
  return `@import url("${getGoogleFontUrl(font)}");\n\n:root {\n  --font-family: ${getFontFamilyStack(font.family, font.category)};\n}`
}

export function getNearestGoogleFontWeight(font: GoogleFont, preferredWeight: string) {
  const preferred = Number(preferredWeight)
  return String([...font.weights].sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred))[0] ?? 400)
}
