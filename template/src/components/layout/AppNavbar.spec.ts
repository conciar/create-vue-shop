import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountWithPlugins } from '@/test-support/mount'
import AppNavbar from './AppNavbar.vue'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import type { Product } from '@/types'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('AppNavbar — cart badge', () => {
  it('hides the badge when the cart is empty', () => {
    const wrapper = mountWithPlugins(AppNavbar)
    expect(wrapper.find('[aria-label="Open cart"] span').exists()).toBe(false)
  })

  it('shows the item count when the cart has items', () => {
    const wrapper = mountWithPlugins(AppNavbar)
    useCartStore().add({ id: '1', name: 'A', price: 5, image: '' } as Product, 'product')
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.find('[aria-label="Open cart"] span').text()).toBe('1')
    })
  })

  it('caps the displayed count at "9+"', async () => {
    const wrapper = mountWithPlugins(AppNavbar)
    const cart = useCartStore()
    cart.add({ id: '1', name: 'A', price: 5, image: '' } as Product, 'product')
    cart.updateQty('1', 10, 'product')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[aria-label="Open cart"] span').text()).toBe('9+')
  })

  it('opens the cart drawer when the cart icon is clicked', async () => {
    const wrapper = mountWithPlugins(AppNavbar)
    const cart = useCartStore()
    await wrapper.get('[aria-label="Open cart"]').trigger('click')
    expect(cart.isOpen).toBe(true)
  })
})

describe('AppNavbar — auth state', () => {
  it('shows a sign-in link when logged out', () => {
    const wrapper = mountWithPlugins(AppNavbar)
    expect(wrapper.find('a[href="/login"]').exists()).toBe(true)
  })

  it('shows the customer name when logged in, and opens/closes the user menu', async () => {
    const wrapper = mountWithPlugins(AppNavbar)
    const customer = useCustomerStore()
    customer.accessToken = 'tok'
    customer.customer = { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' } as never
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.find('a[href="/login"]').exists()).toBe(false)

    const menuButtons = wrapper.findAll('button').filter(b => b.text().includes('Ada Lovelace'))
    await menuButtons[0].trigger('click')
    expect(wrapper.text()).toContain('ada@example.com')
  })

  it('falls back to the identifier when no customer profile is set', async () => {
    const wrapper = mountWithPlugins(AppNavbar)
    const customer = useCustomerStore()
    customer.accessToken = 'tok'
    customer.identifier = 'user@example.com'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('user@example.com')
  })

  it('logs out and closes the user menu on sign out click', async () => {
    const wrapper = mountWithPlugins(AppNavbar)
    const customer = useCustomerStore()
    customer.accessToken = 'tok'
    customer.customer = { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' } as never
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button').find(b => b.text().includes('Ada Lovelace'))!.trigger('click')
    await wrapper.findAll('button').find(b => b.text().includes('Sign out'))!.trigger('click')

    expect(customer.isLoggedIn).toBe(false)
  })
})

describe('AppNavbar — language switcher', () => {
  it('toggles the dropdown and sets the locale + persists to localStorage', async () => {
    const wrapper = mountWithPlugins(AppNavbar)
    const toggle = wrapper.findAll('button').find(b => b.text().toLowerCase() === 'en')!
    await toggle.trigger('click')

    const enOption = wrapper.findAll('button').find(b => b.text().includes('English'))!
    await enOption.trigger('click')

    expect(localStorage.getItem('locale')).toBe('en')
  })

  it('closes the language dropdown on an outside click', async () => {
    const wrapper = mountWithPlugins(AppNavbar, { attachTo: document.body })
    const toggle = wrapper.findAll('button').find(b => b.text().toLowerCase() === 'en')!
    await toggle.trigger('click')
    expect(wrapper.text()).toContain('English')

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('English')
    wrapper.unmount()
  })
})

describe('AppNavbar — mobile menu', () => {
  it('toggles the mobile nav open and closed', async () => {
    const wrapper = mountWithPlugins(AppNavbar)
    expect(wrapper.find('a[href="/subscriptions"].py-2\\.5').exists()).toBe(false)

    const menuButton = wrapper.findAll('button').at(-1)!
    await menuButton.trigger('click')
    expect(wrapper.find('a[href="/subscriptions"].py-2\\.5').exists()).toBe(true)

    await menuButton.trigger('click')
    expect(wrapper.find('a[href="/subscriptions"].py-2\\.5').exists()).toBe(false)
  })
})

describe('AppNavbar — announcement rotation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('rotates the announcement text on an interval and stops after unmount', async () => {
    const wrapper = mountWithPlugins(AppNavbar)
    const first = wrapper.text()

    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.text()).not.toBe(first)

    wrapper.unmount()
    // Advancing after unmount must not throw (interval was cleared).
    await vi.advanceTimersByTimeAsync(8000)
  })
})
