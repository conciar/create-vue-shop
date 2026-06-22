import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useCustomerStore } from '@/stores/customer'
import { useCartStore } from '@/stores/cart'
import HomeView from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: (to, from) => to.path !== from.path ? { top: 0 } : false,
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/products',
      name: 'products',
      component: () => import('@/views/ProductsView.vue')
    },
    {
      path: '/product/:id/:slug',
      name: 'product-detail',
      component: () => import('@/views/ProductDetailView.vue')
    },
    {
      path: '/subscriptions',
      name: 'subscriptions',
      component: () => import('@/views/SubscriptionsView.vue')
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('@/views/CartView.vue')
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: () => import('@/views/CheckoutView.vue'),
      meta: { fullscreen: true },
    },
    {
      path: '/order/:reference',
      name: 'order-confirmation',
      component: () => import('@/views/OrderConfirmationView.vue')
    },
    {
      path: '/payments/:psp/return',
      name: 'order-payment-return',
      component: () => import('@/views/OrderPaymentReturnView.vue')
    },
    { path: '/orders', redirect: '/account/orders' },
    {
      path: '/account/orders',
      name: 'orders',
      component: () => import('@/views/AccountOrdersView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/account/orders/:reference',
      name: 'order-detail',
      component: () => import('@/views/AccountOrderDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/account/subscriptions',
      name: 'subscriptions-account',
      component: () => import('@/views/AccountSubscriptionsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/account/subscriptions/:id',
      name: 'subscription-detail',
      component: () => import('@/views/AccountSubscriptionDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { fullscreen: true },
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('@/views/AuthCallbackView.vue')
    }
  ]
})

router.beforeEach((to) => {
  // Block checkout access when the cart is empty
  if (to.name === 'checkout') {
    const cart = useCartStore()
    if (!cart.items.length) return { name: 'cart' }
  }

  if (!to.meta.requiresAuth) return true

  const auth     = useAuthStore()
  const customer = useCustomerStore()
  if (auth.isAuthenticated || customer.isLoggedIn) return true

  return { name: 'login', query: { returnTo: to.fullPath } }
})

export default router
