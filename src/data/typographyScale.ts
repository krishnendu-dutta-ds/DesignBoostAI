import type { ProjectSettings } from '../types'

export const TYPOGRAPHY_SCALE = [
  { key: 'display', label: 'Display', desktopSize: 64, mobileSize: 48, weight: 600 },
  { key: 'heading-1', label: 'Heading 1', desktopSize: 48, mobileSize: 36, weight: 600 },
  { key: 'heading-2', label: 'Heading 2', desktopSize: 36, mobileSize: 30, weight: 600 },
  { key: 'heading-3', label: 'Heading 3', desktopSize: 28, mobileSize: 24, weight: 600 },
  { key: 'heading-4', label: 'Heading 4', desktopSize: 22, mobileSize: 22, weight: 500 },
  { key: 'heading-5', label: 'Heading 5', desktopSize: 18, mobileSize: 18, weight: 500 },
  { key: 'body-large', label: 'Body large', desktopSize: 18, mobileSize: 18, weight: 400 },
  { key: 'body', label: 'Body', desktopSize: 16, mobileSize: 16, weight: 400 },
  { key: 'body-small', label: 'Body small', desktopSize: 14, mobileSize: 14, weight: 400 },
  { key: 'caption', label: 'Caption', desktopSize: 12, mobileSize: 12, weight: 400 },
  { key: 'overline', label: 'Overline', desktopSize: 11, mobileSize: 11, weight: 600 },
] as const

const interfaceTextStyles = [
  { key: 'button', label: 'Button', size: 13, weight: 550 },
  { key: 'menu', label: 'Menu', size: 12, weight: 400 },
  { key: 'navigation', label: 'Navigation', size: 14, weight: 450 },
] as const

export type TypographyStyleToken = {
  name: string
  value: string
  type: 'fontFamilies' | 'fontSizes' | 'fontWeights'
}

export function createTypographyStyleTokens(typography: ProjectSettings['typography']): TypographyStyleToken[] {
  const scaleTokens = TYPOGRAPHY_SCALE.flatMap((style) => {
    const size = typography.mobile ? style.mobileSize : style.desktopSize
    return [
      { name: `typography.${style.key}.font-family`, value: typography.fontFamily, type: 'fontFamilies' as const },
      { name: `typography.${style.key}.font-size`, value: `${size}px`, type: 'fontSizes' as const },
      { name: `typography.${style.key}.font-weight`, value: String(style.weight), type: 'fontWeights' as const },
    ]
  })

  const interfaceTokens = interfaceTextStyles.flatMap((style) => [
    { name: `typography.${style.key}.font-family`, value: typography.fontFamily, type: 'fontFamilies' as const },
    { name: `typography.${style.key}.font-size`, value: `${style.size}px`, type: 'fontSizes' as const },
    { name: `typography.${style.key}.font-weight`, value: String(style.weight), type: 'fontWeights' as const },
  ])

  return [...scaleTokens, ...interfaceTokens]
}
