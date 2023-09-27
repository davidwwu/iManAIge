/* eslint-disable vue/multi-word-component-names,vue/no-reserved-component-names */
import 'primeflex/primeflex.css'
import 'primeicons/primeicons.css'
import 'primevue/resources/themes/viva-light/theme.css'
import './assets/main.css'

import { createApp } from 'vue'
import { RouterLink } from 'vue-router'

import App from './App.vue'
import PrimeVue from 'primevue/config'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Divider from 'primevue/divider'
import Dropdown from 'primevue/dropdown'
import Fieldset from 'primevue/fieldset'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import ProgressSpinner from 'primevue/progressspinner'
import RadioButton from 'primevue/radiobutton'
import ScrollTop from 'primevue/scrolltop'
import Skeleton from 'primevue/skeleton'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Toast from 'primevue/toast'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'

const app = createApp(App)
app.use(PrimeVue, { ripple: true })
app.use(ToastService)

app.directive('tooltip', Tooltip)

app.component('Accordion', Accordion)
app.component('AccordionTab', AccordionTab)
app.component('Button', Button)
app.component('Card', Card)
app.component('Divider', Divider)
app.component('Dropdown', Dropdown)
app.component('Fieldset', Fieldset)
app.component('InputText', InputText)
app.component('Menu', Menu)
app.component('ProgressSpinner', ProgressSpinner)
app.component('RadioButton', RadioButton)
app.component('RouterLink', RouterLink)
app.component('ScrollTop', ScrollTop)
app.component('Skeleton', Skeleton)
app.component('TabView', TabView)
app.component('TabPanel', TabPanel)
app.component('Toast', Toast)

app.mount('#app')
