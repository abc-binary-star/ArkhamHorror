import { clientLog, clientError } from '@/utils/clientLog'
import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import baseRoutes from '@/routes';
import arkhamRoutes from '@/arkham/routes';

const routes: Array<RouteRecordRaw> = [
  ...baseRoutes,
  ...arkhamRoutes
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})


router.beforeEach(async (to, _from, next) => {
  clientLog('route.start', { from: String(_from.name ?? ''), to: String(to.name ?? '') })
  const store = useUserStore()
  clientLog('route.session.start')
  await store.loadUserFromStorage()
  clientLog('route.session.complete', { hasToken: localStorage.getItem('arkham-token') !== null })

  if (to.matched.some((record) => record.meta && record.meta.requiresAuth)) {
    if (localStorage.getItem('arkham-token') === null) {
      next({ path: '/sign-in', query: { nextUrl: to.fullPath } });
    } else {
      if (to.matched.some((record) => record.meta && record.meta.requiresAdmin)) {
        if (store.isAdmin) {
          document.title = `${to.meta.title}`
          next();
        } else {
          next({ path: '/' })
        }
      } else {
        document.title = `${to.meta.title}`
        next();
      }
    }
  } else if (to.matched.some((record) => record.meta && record.meta.guest)) {
    if (localStorage.getItem('arkham-token') === null) {
      document.title = `${to.meta.title}`
      next();
    } else {
      next({ path: '/' });
    }
  } else {
    next();
  }
});

router.afterEach((to, from, failure) => {
  clientLog('route.complete', { from: String(from.name ?? ''), to: String(to.name ?? ''), failed: Boolean(failure) })
})
router.onError((cause) => clientError('route.error', cause))

export default router
