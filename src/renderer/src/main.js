import './assets/main.css'
import router from './router'
import { createPinia } from 'pinia'
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import { createApp } from 'vue'
import App from './App.vue'
const pinia = createPinia()

createApp(App).use(router).use(pinia).use(ArcoVue).mount('#app')
