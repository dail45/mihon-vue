import { h } from 'vue'
import { createVuetify, type IconSet } from 'vuetify'
import { VAlert, VApp, VAppBar, VAppBarTitle, VBottomNavigation, VBottomSheet, VBtn, VCard, VCardActions, VCardText, VChip, VContainer, VDialog, VDivider, VForm, VIcon, VImg, VList, VListItem, VListSubheader, VMain, VMenu, VProgressLinear, VRadio, VRadioGroup, VSelect, VSheet, VSpacer, VSwitch, VTab, VTabs, VTextField } from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { md3 } from 'vuetify/blueprints'
import { aliases } from 'vuetify/iconsets/md'
const symbols: IconSet = {
  component: props => h(props.tag, { class: 'material-symbols-rounded', 'aria-hidden': 'true' }, props.icon as string),
}
// Colors translated from Mihon's TachiyomiColorScheme.kt. See docs/REFERENCES.md.
export const vuetify = createVuetify({
  blueprint: md3,
  components: { VAlert, VApp, VAppBar, VAppBarTitle, VBottomNavigation, VBottomSheet, VBtn, VCard, VCardActions, VCardText, VChip, VContainer, VDialog, VDivider, VForm, VIcon, VImg, VList, VListItem, VListSubheader, VMain, VMenu, VProgressLinear, VRadio, VRadioGroup, VSelect, VSheet, VSpacer, VSwitch, VTab, VTabs, VTextField }, directives,
  icons: { defaultSet: 'symbols', aliases, sets: { symbols } },
  theme: {
    defaultTheme: 'mihonLight',
    themes: {
      mihonLight: { dark: false, colors: {
        primary: '#0058CA', 'on-primary': '#FFFFFF', secondary: '#0058CA', 'on-secondary': '#FFFFFF',
        'secondary-container': '#D9E2FF', 'on-secondary-container': '#001945',
        tertiary: '#006E1B', 'on-tertiary': '#FFFFFF', background: '#FEFBFF', 'on-background': '#1B1B1F',
        surface: '#FEFBFF', 'on-surface': '#1B1B1F', 'surface-variant': '#F3EDF7', 'on-surface-variant': '#44464F',
        'surface-container': '#F3EDF7', 'surface-container-high': '#FCF7FF', error: '#BA1A1A', 'on-error': '#FFFFFF',
      } },
      mihonDark: { dark: true, colors: {
        primary: '#B0C6FF', 'on-primary': '#002D6E', secondary: '#B0C6FF', 'on-secondary': '#002D6E',
        'secondary-container': '#00429B', 'on-secondary-container': '#D9E2FF',
        tertiary: '#7ADC77', 'on-tertiary': '#003909', background: '#1B1B1F', 'on-background': '#E3E2E6',
        surface: '#1B1B1F', 'on-surface': '#E3E2E6', 'surface-variant': '#211F26', 'on-surface-variant': '#C5C6D0',
        'surface-container': '#211F26', 'surface-container-high': '#292730', error: '#FFB4AB', 'on-error': '#690005',
      } },
    },
  },
  defaults: { VBtn: { style: 'text-transform: none; letter-spacing: 0;' }, VCard: { elevation: 0 }, VTextField: { variant: 'outlined', color: 'primary' } },
})
