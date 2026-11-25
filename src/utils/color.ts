import type { ColorToken, GradientSettings } from '../types'

export function createGradientCss(gradient: GradientSettings) {
  return gradient.type === 'linear'
    ? `linear-gradient(${Math.round(gradient.angle)}deg, ${gradient.startColor} 0%, ${gradient.endColor} 100%)`
    : `radial-gradient(circle at center, ${gradient.startColor} 0%, ${gradient.endColor} 100%)`
}

export function createPaletteCss(colors: ColorToken[], gradient: GradientSettings) {
  const usedNames = new Set<string>()
  const variables = colors.map((color, index) => {
    const baseName = color.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `color-${index + 1}`
    let name = baseName
    let suffix = 2
    while (usedNames.has(name)) name = `${baseName}-${suffix++}`
    usedNames.add(name)
    return `  --color-${name}: ${color.value};`
  })
  variables.push(`  --gradient-primary: ${createGradientCss(gradient)};`)
  return `:root {\n${variables.join('\n')}\n}`
}

export function normalizeHex(value: string) {
  const raw = value.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) return `#${raw.split('').map((char) => char + char).join('').toUpperCase()}`
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`
  return null
}

export function rgbFromHex(hex: string) {
  const normalized = normalizeHex(hex) ?? '#000000'
  const value = Number.parseInt(normalized.slice(1), 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    const rgb = Object.values(rgbFromHex(hex)).map((value) => {
      const channel = value / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
  }
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export function hslFromHex(hex: string) {
  const { r: rr, g: gg, b: bb } = rgbFromHex(hex)
  const r = rr / 255
  const g = gg / 255
  const b = bb / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (delta) {
    s = delta / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / delta) % 6; break
      case g: h = (b - r) / delta + 2; break
      default: h = (r - g) / delta + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
}

export function hexFromHsl(hue: number, saturation: number, lightness: number) {
  const h = ((hue % 360) + 360) % 360
  const s = Math.max(0, Math.min(100, saturation)) / 100
  const l = Math.max(0, Math.min(100, lightness)) / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - chroma / 2
  const channels = h < 60 ? [chroma, x, 0] : h < 120 ? [x, chroma, 0] : h < 180 ? [0, chroma, x] : h < 240 ? [0, x, chroma] : h < 300 ? [x, 0, chroma] : [chroma, 0, x]
  return `#${channels.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}
