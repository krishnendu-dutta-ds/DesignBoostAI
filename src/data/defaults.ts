import type { ProjectSettings } from '../types'

function gradientColor(value: string | undefined, fallback: string) {
  const color = value?.trim() ?? ''
  if (/^#[\da-f]{6}$/i.test(color)) return color.toUpperCase()
  if (/^#[\da-f]{3}$/i.test(color)) return `#${color.slice(1).split('').map((channel) => channel + channel).join('')}`.toUpperCase()
  return fallback
}

export function createDefaultGradientSettings(startColor = '#7C6CFA', endColor = '#38BDF8') {
  return {
    type: 'linear' as const,
    angle: 135,
    startColor: gradientColor(startColor, '#7C6CFA'),
    endColor: gradientColor(endColor, '#38BDF8'),
  }
}

export function createDefaultProjectSettings(): ProjectSettings {
  return {
    typography: {
      fontFamily: 'Inter',
      fontWeight: '500',
      fontSize: 16,
      lineHeight: 1.5,
      letterSpacing: 0,
      textTransform: 'none',
      mobile: false,
    },
    spacing: {
      baseUnit: 4,
      containerWidth: 1200,
      columns: 12,
      gutter: 24,
      borderRadius: 8,
    },
    component: {
      name: 'Primary button',
      state: 'Default',
      size: 'Medium',
      radius: 10,
      label: 'Get started',
      customComponents: [],
    },
  }
}
