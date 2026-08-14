import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import type { Product } from '@/types'

// Stub out every routed view so navigating in this spec never imports/loads
// the real (large) view SFCs — @vitest/coverage-v8 misattributes statement
// coverage to dynamically-imported-but-never-mounted Vue components (their
// setup() never actually runs; verified with a console.log probe that never
// fired despite the report claiming 100% coverage). Real view coverage comes
// from each view's own mount()-based spec, not from router navigation.
const stub = { default: { template: '<div/>' } }
vi.mock('@/views/HomeView.vue', () => stub)
vi.mock('@/views/ProductsView.vue', () => stub)
vi.mock('@/views/ProductDetailView.vue', () => stub)
vi.mock('@/views/SubscriptionsView.vue', () => stub)
vi.mock('@/views/CartView.vue', () => stub)
vi.mock('@/views/CheckoutView.vue', () => stub)
vi.mock('@/views/OrderConfirmationView.vue', () => stub)
vi.mock('@/views/OrderPaymentReturnView.vue', () => stub)
vi.mock('@/views/AccountOrdersView.vue', () => stub)
vi.mock('@/views/AccountOrderDetailView.vue', () => stub)
vi.mock('@/views/AccountSubscriptionsView.vue', () => stub)
vi.mock('@/views/AccountSubscriptionDetailView.vue', () => stub)
vi.mock('@/views/LoginView.vue', () => stub)

const router = (await import('./index')).default

window.scrollTo = () => {}

beforeEach(async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  await router.replace('/')
})

describe('router — checkout guard', () => {
  it('redirects /checkout to /cart when the cart is empty', async () => {
    await router.push('/checkout')
    expect(router.currentRoute.value.name).toBe('cart')
  })

  it('allows /checkout when the cart has items', async () => {
    const cart = useCartStore()
    cart.add({ id: '1', name: 'Item', price: 10, image: '' } as Product, 'product')
    await router.push('/checkout')
    expect(router.currentRoute.value.name).toBe('checkout')
  })
})

describe('router — auth guard', () => {
  it('redirects a requiresAuth route to /login with a returnTo query when logged out', async () => {
    await router.push('/account/orders')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.returnTo).toBe('/account/orders')
  })

  it('allows a requiresAuth route when logged in', async () => {
    const customer = useCustomerStore()
    customer.accessToken = 'tok-123'
    await router.push('/account/orders')
    expect(router.currentRoute.value.name).toBe('orders')
  })

  it('allows routes without requiresAuth regardless of login state', async () => {
    await router.push('/products')
    expect(router.currentRoute.value.name).toBe('products')
  })
})

describe('router — misc routes', () => {
  it('redirects the legacy /orders path to /account/orders', async () => {
    await router.push('/orders')
    // still gated by the auth guard once redirected
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('resolves a product detail route with params', async () => {
    await router.push('/product/42/some-slug')
    expect(router.currentRoute.value.name).toBe('product-detail')
    expect(router.currentRoute.value.params).toMatchObject({ id: '42', slug: 'some-slug' })
  })
})

describe('router — scrollBehavior', () => {
  it('scrolls to top when the path changes', () => {
    const result = router.options.scrollBehavior!(
      { path: '/products' } as never, { path: '/' } as never, null as never,
    )
    expect(result).toEqual({ top: 0 })
  })

  it('preserves scroll position when only the query/hash changes', () => {
    const result = router.options.scrollBehavior!(
      { path: '/products' } as never, { path: '/products' } as never, null as never,
    )
    expect(result).toBe(false)
  })
})
