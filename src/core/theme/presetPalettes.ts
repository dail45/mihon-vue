/**
 * 13 Curated Preset Palettes from Komikku.
 * Reference: `komikku/app/src/main/java/eu/kanade/presentation/more/settings/widget/ThemeColorPickerWidget.kt`
 */

export interface PresetPalette {
  id: string
  name: string
  titleKey: string
  colors: string[]
}

export const PRESET_PALETTES: PresetPalette[] = [
  {
    id: 'sunset',
    name: 'Sunset',
    titleKey: 'custom_theme_palette_sunset',
    colors: ['#3e9cbf', '#a7ecf2', '#f2c43d', '#f17c37', '#f26d50'],
  },
  {
    id: 'outrun',
    name: 'Outrun',
    titleKey: 'custom_theme_palette_outrun',
    colors: ['#fffc40', '#faba61', '#ff8172', '#ff2fa9', '#3a579a'],
  },
  {
    id: 'raspberry',
    name: 'Raspberry',
    titleKey: 'custom_theme_palette_raspberry',
    colors: ['#730517', '#f44560', '#44d1df', '#32a4a7', '#1e7069'],
  },
  {
    id: 'cathode',
    name: 'Cathode',
    titleKey: 'custom_theme_palette_cathode',
    colors: ['#a8216b', '#f1184c', '#f36943', '#f7dc66', '#2e9599'],
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    titleKey: 'custom_theme_palette_bubblegum',
    colors: ['#f8cd82', '#f65b74', '#f72078', '#23b0bd', '#0df7db'],
  },
  {
    id: 'springfield',
    name: 'Springfield',
    titleKey: 'custom_theme_palette_springfield',
    colors: ['#89d1dc', '#f89cfa', '#c386f1', '#f0d689', '#aff28b'],
  },
  {
    id: 'spectral',
    name: 'Spectral',
    titleKey: 'custom_theme_palette_spectral',
    colors: ['#471337', '#b13254', '#ff5349', '#ff7249', '#ff9248'],
  },
  {
    id: 'night_at_the_beach',
    name: 'Night at the beach',
    titleKey: 'custom_theme_palette_night_at_the_beach',
    colors: ['#262335', '#503c52', '#9f6c66', '#d4896a', '#ffbb6c'],
  },
  {
    id: 'casual',
    name: 'Casual',
    titleKey: 'custom_theme_palette_casual',
    colors: ['#4f6a8f', '#88a2bc', '#f0dbb0', '#efb680', '#d99477'],
  },
  {
    id: 'patagonia',
    name: 'Patagonia',
    titleKey: 'custom_theme_palette_patagonia',
    colors: ['#202e32', '#85937a', '#586c5c', '#a9af90', '#dfdcb9'],
  },
  {
    id: 'lcd',
    name: 'LCD',
    titleKey: 'custom_theme_palette_lcd',
    colors: ['#0f370e', '#30622f', '#8bad0d', '#9bbc0e'],
  },
  {
    id: 'pop',
    name: 'Pop',
    titleKey: 'custom_theme_palette_pop',
    colors: ['#00ff3f', '#35b5ff', '#ff479c', '#fffb38'],
  },
  {
    id: 'pico',
    name: 'PICO-8',
    titleKey: 'custom_theme_palette_pico',
    colors: [
      '#1d2b53',
      '#7e2453',
      '#008751',
      '#ab5236',
      '#5f574e',
      '#c2c3c7',
      '#ff004d',
      '#ffa300',
      '#ffec27',
      '#00e536',
      '#29aeff',
      '#83769c',
      '#ff77a8',
      '#ffcdaa',
    ],
  },
]
