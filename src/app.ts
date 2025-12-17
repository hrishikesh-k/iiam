import pv from 'primevue/config'
import aura from '@primeuix/themes/aura'
import pvToast from 'primevue/toastservice'
import { createApp } from 'vue'
import app from './app.vue'

createApp(app)
  .use(pv, {
    theme: {
      preset: aura
    }
  })
  .use(pvToast)
  .mount('#app')