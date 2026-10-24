import { themeFromSourceColor, argbFromHex, hexFromArgb } from '@material/material-color-utilities'
import type { AppTheme, AppThemeColors } from './appThemes'

/**
 * Normalizes input string to standard 6-digit hex format (#RRGGBB).
 */
export function normalizeHex(color: string): string {
  let hex = color.trim().replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return '#DF0090' // Default Komikku custom seed fallback
  }
  return `#${hex.toUpperCase()}`
}

export function isValidHex(color: string): boolean {
  const hex = color.trim().replace(/^#/, '')
  return /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)
}

/**
 * Generates an M3 Material Design 3 theme (Light and Dark) from a seed hex color.
 * Uses Google's official @material/material-color-utilities algorithms.
 */
export function generateDynamicTheme(seedHex: string): AppTheme {
  const cleanSeed = normalizeHex(seedHex)
  const argb = argbFromHex(cleanSeed)
  const theme = themeFromSourceColor(argb)

  const light: AppThemeColors = {
    primary: hexFromArgb(theme.schemes.light.primary),
    onPrimary: hexFromArgb(theme.schemes.light.onPrimary),
    primaryContainer: hexFromArgb(theme.schemes.light.primaryContainer),
    onPrimaryContainer: hexFromArgb(theme.schemes.light.onPrimaryContainer),
    inversePrimary: hexFromArgb(theme.schemes.light.inversePrimary),
    secondary: hexFromArgb(theme.schemes.light.secondary),
    onSecondary: hexFromArgb(theme.schemes.light.onSecondary),
    secondaryContainer: hexFromArgb(theme.schemes.light.secondaryContainer),
    onSecondaryContainer: hexFromArgb(theme.schemes.light.onSecondaryContainer),
    tertiary: hexFromArgb(theme.schemes.light.tertiary),
    onTertiary: hexFromArgb(theme.schemes.light.onTertiary),
    tertiaryContainer: hexFromArgb(theme.schemes.light.tertiaryContainer),
    onTertiaryContainer: hexFromArgb(theme.schemes.light.onTertiaryContainer),
    error: hexFromArgb(theme.schemes.light.error),
    onError: hexFromArgb(theme.schemes.light.onError),
    errorContainer: hexFromArgb(theme.schemes.light.errorContainer),
    onErrorContainer: hexFromArgb(theme.schemes.light.onErrorContainer),
    background: hexFromArgb(theme.schemes.light.background),
    onBackground: hexFromArgb(theme.schemes.light.onBackground),
    surface: hexFromArgb(theme.schemes.light.surface),
    onSurface: hexFromArgb(theme.schemes.light.onSurface),
    surfaceVariant: hexFromArgb(theme.schemes.light.surfaceVariant),
    onSurfaceVariant: hexFromArgb(theme.schemes.light.onSurfaceVariant),
    surfaceTint: hexFromArgb(theme.schemes.light.primary),
    inverseSurface: hexFromArgb(theme.schemes.light.inverseSurface),
    inverseOnSurface: hexFromArgb(theme.schemes.light.inverseOnSurface),
    outline: hexFromArgb(theme.schemes.light.outline),
    outlineVariant: hexFromArgb(theme.schemes.light.outlineVariant),
    scrim: hexFromArgb(theme.schemes.light.scrim),
    surfaceContainerLowest: hexFromArgb(theme.palettes.neutral.tone(100)),
    surfaceContainerLow: hexFromArgb(theme.palettes.neutral.tone(96)),
    surfaceContainer: hexFromArgb(theme.palettes.neutral.tone(94)),
    surfaceContainerHigh: hexFromArgb(theme.palettes.neutral.tone(92)),
    surfaceContainerHighest: hexFromArgb(theme.palettes.neutral.tone(90)),
  }

  const dark: AppThemeColors = {
    primary: hexFromArgb(theme.schemes.dark.primary),
    onPrimary: hexFromArgb(theme.schemes.dark.onPrimary),
    primaryContainer: hexFromArgb(theme.schemes.dark.primaryContainer),
    onPrimaryContainer: hexFromArgb(theme.schemes.dark.onPrimaryContainer),
    inversePrimary: hexFromArgb(theme.schemes.dark.inversePrimary),
    secondary: hexFromArgb(theme.schemes.dark.secondary),
    onSecondary: hexFromArgb(theme.schemes.dark.onSecondary),
    secondaryContainer: hexFromArgb(theme.schemes.dark.secondaryContainer),
    onSecondaryContainer: hexFromArgb(theme.schemes.dark.onSecondaryContainer),
    tertiary: hexFromArgb(theme.schemes.dark.tertiary),
    onTertiary: hexFromArgb(theme.schemes.dark.onTertiary),
    tertiaryContainer: hexFromArgb(theme.schemes.dark.tertiaryContainer),
    onTertiaryContainer: hexFromArgb(theme.schemes.dark.onTertiaryContainer),
    error: hexFromArgb(theme.schemes.dark.error),
    onError: hexFromArgb(theme.schemes.dark.onError),
    errorContainer: hexFromArgb(theme.schemes.dark.errorContainer),
    onErrorContainer: hexFromArgb(theme.schemes.dark.onErrorContainer),
    background: hexFromArgb(theme.schemes.dark.background),
    onBackground: hexFromArgb(theme.schemes.dark.onBackground),
    surface: hexFromArgb(theme.schemes.dark.surface),
    onSurface: hexFromArgb(theme.schemes.dark.onSurface),
    surfaceVariant: hexFromArgb(theme.schemes.dark.surfaceVariant),
    onSurfaceVariant: hexFromArgb(theme.schemes.dark.onSurfaceVariant),
    surfaceTint: hexFromArgb(theme.schemes.dark.primary),
    inverseSurface: hexFromArgb(theme.schemes.dark.inverseSurface),
    inverseOnSurface: hexFromArgb(theme.schemes.dark.inverseOnSurface),
    outline: hexFromArgb(theme.schemes.dark.outline),
    outlineVariant: hexFromArgb(theme.schemes.dark.outlineVariant),
    scrim: hexFromArgb(theme.schemes.dark.scrim),
    surfaceContainerLowest: hexFromArgb(theme.palettes.neutral.tone(4)),
    surfaceContainerLow: hexFromArgb(theme.palettes.neutral.tone(10)),
    surfaceContainer: hexFromArgb(theme.palettes.neutral.tone(12)),
    surfaceContainerHigh: hexFromArgb(theme.palettes.neutral.tone(17)),
    surfaceContainerHighest: hexFromArgb(theme.palettes.neutral.tone(22)),
  }

  return {
    id: 'custom',
    title: 'Custom',
    light,
    dark,
  }
}

/**
 * Transforms a dark color scheme into pure black AMOLED theme per BaseColorScheme.kt specification.
 */
export function applyAmoledToDarkScheme(scheme: AppThemeColors): AppThemeColors {
  return {
    ...scheme,
    background: '#000000',
    onBackground: '#FFFFFF',
    surface: '#000000',
    onSurface: '#FFFFFF',
    surfaceVariant: '#0C0C0C',
    surfaceContainerLowest: '#0C0C0C',
    surfaceContainerLow: '#0C0C0C',
    surfaceContainer: '#0C0C0C',
    surfaceContainerHigh: '#131313',
    surfaceContainerHighest: '#1B1B1B',
    palerSurface: '#000000',
  }
}
