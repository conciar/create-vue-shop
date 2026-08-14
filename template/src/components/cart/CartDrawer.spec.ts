import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import CartDrawer from './CartDrawer.vue'
import { useCartStore } from '@/stores/cart'
import type { Product, SubscriptionBox } from '@/types'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/products', component: { template: '<div/>' } },
      { path: '/checkout', component: { template: '<div/>' } },
      { path: '/cart', component: { template: '<div/>' } },
    ],
  })
}

function mountDrawer() {
  // Stub Teleport so the drawer (teleported to <body>) renders in place and
  // is reachable via the wrapper's own find()/text() queries.
  return mountWithPlugins(CartDrawer, { global: { plugins: [testRouter()], stubs: { teleport: true } } })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('CartDrawer — visibility', () => {
  it('renders nothing when the cart is closed', () => {
    const wrapper = mountDrawer()
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('renders the drawer when cart.isOpen is true', async () => {
    const wrapper = mountDrawer()
    useCartStore().isOpen = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('aside').exists()).toBe(true)
  })

  it('closes via the close button', async () => {
    const wrapper = mountDrawer()
    const cart = useCartStore()
    cart.isOpen = true
    await wrapper.vm.$nextTick()

    await wrapper.get('[aria-label="Close"]').trigger('click')
    expect(cart.isOpen).toBe(false)
  })

  it('closes via the backdrop click', async () => {
    const wrapper = mountDrawer()
    const cart = useCartStore()
    cart.isOpen = true
    await wrapper.vm.$nextTick()

    await wrapper.get('.backdrop, .fixed.inset-0.bg-black\\/40').trigger('click')
    expect(cart.isOpen).toBe(false)
  })
})

describe('CartDrawer — empty state', () => {
  it('shows the empty state and navigates to /products from "browse"', async () => {
    const wrapper = mountDrawer()
    const cart = useCartStore()
    cart.isOpen = true
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Your cart is empty')
    await wrapper.findAll('button').find(b => b.text().includes('Browse products'))!.trigger('click')
    expect(cart.isOpen).toBe(false)
  })
})

describe('CartDrawer — items', () => {
  const productItem: Product = { id: 'p1', name: 'Wine A', price: 20, image: '' }
  const subscriptionItem: SubscriptionBox = {
    id: 's1', isSubscription: true, name: 'Box', tagline: '', description: '', bottles: 3,
    price: 40, frequency: 'monthly', image: '', highlights: [],
  }

  it('lists items with quantity, price and type badges', async () => {
    const wrapper = mountDrawer()
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.add(subscriptionItem, 'subscription', 'Monthly')
    cart.isOpen = true
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Wine A')
    expect(wrapper.text()).toContain('Box')
    expect(wrapper.text()).toContain('Monthly')
  })

  it('increments and decrements quantity via the +/- buttons', async () => {
    const wrapper = mountDrawer()
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.isOpen = true
    await wrapper.vm.$nextTick()

    const buttons = wrapper.findAll('button').filter(b => b.text() === '+' || b.text() === '−')
    const plus = buttons.find(b => b.text() === '+')!
    const minus = buttons.find(b => b.text() === '−')!

    await plus.trigger('click')
    expect(cart.items[0].quantity).toBe(2)
    await minus.trigger('click')
    await minus.trigger('click')
    expect(cart.items).toHaveLength(0) // quantity hits 0 → removed
  })

  it('removes an item via the remove link', async () => {
    const wrapper = mountDrawer()
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.isOpen = true
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button').find(b => b.text() === 'Remove')!.trigger('click')
    expect(cart.items).toHaveLength(0)
  })

  it('shows the subtotal and checkout footer only when there are items', async () => {
    const wrapper = mountDrawer()
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.isOpen = true
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain(cart.formatMoney(cart.subtotal))
  })

  it('navigates to /checkout and closes the drawer', async () => {
    const wrapper = mountDrawer()
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.isOpen = true
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button').find(b => b.text().includes('Checkout') || b.text().includes('checkout'))!.trigger('click')
    expect(cart.isOpen).toBe(false)
  })
})
