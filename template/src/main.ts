import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)

// Close dropdowns when clicking outside
app.directive('click-outside', {
  mounted(el, binding) {
    el._clickOutside = (e: Event) => {
      if (!el.contains(e.target as Node)) binding.value(e)
    }
    document.addEventListener('pointerdown', el._clickOutside)
  },
  unmounted(el) {
    document.removeEventListener('pointerdown', el._clickOutside)
  }
})

app.mount('#app')
