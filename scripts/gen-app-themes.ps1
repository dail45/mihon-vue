$ErrorActionPreference = 'Stop'
$dir = 'mihon/app/src/main/java/eu/kanade/presentation/theme/colorscheme'
$order = @(
  @{ name='DEFAULT'; file='TachiyomiColorScheme'; title='Default' },
  @{ name='MONET'; file=''; title='Dynamic'; unsupported=$true },
  @{ name='CATPPUCCIN'; file='CatppuccinColorScheme'; title='Catppuccin' },
  @{ name='GREEN_APPLE'; file='GreenAppleColorScheme'; title='Green Apple' },
  @{ name='LAVENDER'; file='LavenderColorScheme'; title='Lavender' },
  @{ name='MIDNIGHT_DUSK'; file='MidnightDuskColorScheme'; title='Midnight Dusk' },
  @{ name='NORD'; file='NordColorScheme'; title='Nord' },
  @{ name='STRAWBERRY_DAIQUIRI'; file='StrawberryColorScheme'; title='Strawberry Daiquiri' },
  @{ name='TAKO'; file='TakoColorScheme'; title='Tako' },
  @{ name='TEALTURQUOISE'; file='TealTurqoiseColorScheme'; title='Teal & Turquoise' },
  @{ name='TIDAL_WAVE'; file='TidalWaveColorScheme'; title='Tidal Wave' },
  @{ name='YINYANG'; file='YinYangColorScheme'; title='Yin & Yang' },
  @{ name='YOTSUBA'; file='YotsubaColorScheme'; title='Yotsuba' },
  @{ name='TOKYONIGHT'; file='TokyoNightColorScheme'; title='Tokyo Night' },
  @{ name='MONOCHROME'; file='MonochromeColorScheme'; title='Monochrome' }
)

function Get-Scheme([string]$path) {
  $result = @{ dark = @{}; light = @{} }
  $lines = Get-Content $path
  $mode = $null
  foreach ($line in $lines) {
    if ($line -match 'override val darkScheme') { $mode = 'dark'; continue }
    if ($line -match 'override val lightScheme') { $mode = 'light'; continue }
    if ($line -match '^\s*\)') { $mode = $null; continue }
    if ($null -eq $mode) { continue }
    if ($line -match '^\s*([A-Za-z]+) = Color\(0xFF([0-9A-Fa-f]{6})\)') {
      $result[$mode][$matches[1]] = '#' + $matches[2]
    }
  }
  return $result
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine(@"
/**
 * Full Mihon app-theme color schemes, ported from the pinned reference sources.
 *
 * Generated from
 * mihon/app/src/main/java/eu/kanade/presentation/theme/colorscheme/*.kt
 * (inspected commit 446f6df82c390ab760802c2fce3b677bce3f31c1) by
 * scripts/gen-app-themes.ps1 - do not edit by hand.
 *
 * The role names map 1:1 to the MD3 ColorScheme roles used by Mihon and, with the camelCase name
 * converted to kebab-case, to the Vuetify theme color keys.
 */

/** MD3 ColorScheme roles, as CSS colors. */
export interface AppThemeColors {
  [role: string]: string
}

export interface AppThemeScheme {
  /** `AppTheme` enum name (AppTheme.kt:6). */
  name: string
  /** `AppTheme.titleRes` -> base strings.xml value. */
  title: string
  light: AppThemeColors
  dark: AppThemeColors
  /**
   * True for `AppTheme.MONET` ("Dynamic"): the reference derives it from the Android wallpaper
   * (`MonetColorScheme`), which has no browser equivalent.
   */
  unsupported?: boolean
}
"@)

[void]$sb.AppendLine('export const APP_THEME_SCHEMES: AppThemeScheme[] = [')
foreach ($entry in $order) {
  if ($entry.unsupported) {
    [void]$sb.AppendLine('  {')
    [void]$sb.AppendLine("    name: '$($entry.name)',")
    [void]$sb.AppendLine("    title: '$($entry.title)',")
    [void]$sb.AppendLine('    unsupported: true,')
    [void]$sb.AppendLine('    light: {},')
    [void]$sb.AppendLine('    dark: {},')
    [void]$sb.AppendLine('  },')
    continue
  }
  $scheme = Get-Scheme (Join-Path $dir ($entry.file + '.kt'))
  [void]$sb.AppendLine('  {')
  [void]$sb.AppendLine("    name: '$($entry.name)',")
  [void]$sb.AppendLine("    title: '$($entry.title)',")
  foreach ($variant in @('light', 'dark')) {
    [void]$sb.AppendLine("    ${variant}: {")
    foreach ($role in ($scheme[$variant].Keys | Sort-Object)) {
      [void]$sb.AppendLine("      $role : '$($scheme[$variant][$role])',")
    }
    [void]$sb.AppendLine('    },')
  }
  [void]$sb.AppendLine('  },')
}
[void]$sb.AppendLine(']')
[void]$sb.AppendLine(@'
/** camelCase MD3 role -> kebab-case Vuetify theme color key. */
export function toVuetifyColors(colors: AppThemeColors): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [role, value] of Object.entries(colors)) {
    result[role.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()] = value
  }
  return result
}

export function findAppThemeScheme(name: string): AppThemeScheme | undefined {
  return APP_THEME_SCHEMES.find(scheme => scheme.name === name)
}
'@)

$out = 'src/components/onboarding/appThemeSchemes.ts'
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $out), $sb.ToString())
Write-Host "wrote $out"
