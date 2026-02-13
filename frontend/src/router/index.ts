import { createRouter, createWebHistory } from 'vue-router'
import Default from '@/layout/default.vue'
import HomeView from '../views/HomeView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: Default,
      redirect: '/market',
      children: [
        {
          path: '',
          name: 'root',
          redirect: '/market',
        },
        {
          path: 'market',
          name: 'home',
          component: HomeView,
        },
        {
          path: 'item/:id',
          name: 'item-detail',
          component: () => import('../views/ItemDetailView.vue'),
        },
        {
          path: 'my-works',
          name: 'my-works',
          component: () => import('../views/MyWorksView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'upload',
          name: 'upload',
          component: () => import('../views/UploadView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'my-purchases',
          name: 'my-purchases',
          component: () => import('../views/MyPurchasesView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'user/:username',
          name: 'user-profile',
          component: () => import('../views/UserView.vue'),
        },
        {
          path: '/admin',
          name: 'admin',
          component: () => import('../views/AdminView.vue'),
          meta: { requiresAuth: true, requiresAdmin: true },
        },
      ],
    },
    {
      path: '/config',
      name: 'config',
      component: () => import('../views/ConfigView.vue'),
    },
  ],
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  if (to.query.token) {
    authStore.loginWithToken(to.query.token as string)
    delete to.query.token;
    return next(to);
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    // 跳转到后端登录
    window.location.href = '/api/auth/login'
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next('/')
  } else {
    next()
  }
})

export default router
