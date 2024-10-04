import { createWebHashHistory, createRouter } from 'vue-router'

import sets from '../pages/sets.vue'
import pics from '../pages/pics.vue'
import setting from '../pages/setting.vue'

const routes = [
  { path: '/', component: pics },
  { path: '/sets', component: sets },
  { path: '/setting', component: setting }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})
export default router
