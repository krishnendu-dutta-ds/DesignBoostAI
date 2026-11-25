export function getFontFamilyStack(family: string, category?: string) {
  const quotedFamily = `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  const fallback = category === 'Serif' ? 'serif' : category === 'Monospace' ? 'monospace' : category === 'Handwriting' ? 'cursive' : 'sans-serif'
  return `${quotedFamily}, ${fallback}`
}
