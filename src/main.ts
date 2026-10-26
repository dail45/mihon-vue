import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import 'vuetify/styles'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import './styles/main.scss'
import './styles/reader.scss'
import App from './App.vue'
import { router } from './router'
import { vuetify } from './plugins/vuetify'
import { i18n, MR, stringResource, pluralStringResource } from './i18n'

const app = createApp(App)
app.config.globalProperties.$MR = MR
app.config.globalProperties.$stringResource = stringResource
app.config.globalProperties.$pluralStringResource = pluralStringResource

app.use(createPinia()).use(router).use(vuetify).use(i18n).mount('#app')
