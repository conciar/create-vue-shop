import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import CartView from './CartView.vue'
import { useCartStore } from '@/stores/cart'
import { useStoreConfigStore } from '@/stores/storeConfig'
import { conciarApi } from '@/api/conciar'
import type { Product, SubscriptionBox } from '@/types'
import type { ConciarCountry, ConciarCartSyncRequest } from '@/api/conciar-types'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/products', component: { template: '<div/>' } },
      { path: '/checkout', component: { template: '<div/>' } },
    ],
  })
}

const nl: ConciarCountry = { id: 1, name: 'netherlands', iso_code_2: 'NL' } as never
const de: ConciarCountry = { id: 2, name: 'germany', iso_code_2: 'DE' } as never

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  vi.spyOn(conciarApi.countries, 'list').mockResolvedValue([nl, de])
})

function mountView() {
  return mountWithPlugins(CartView, { global: { plugins: [testRouter()] } })
}

describe('CartView — empty state', () => {
  it('shows the empty state when the cart has no items', async () => {
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Your cart is empty'))
  })
})

describe('CartView — items', () => {
  const productItem: Product = { id: 'p1', name: 'Product A', price: 20, image: '' }
  const subscriptionItem: SubscriptionBox = {
    id: 's1', isSubscription: true, name: 'Box', tagline: '', description: '',
    price: 40, frequency: 'monthly', image: '', highlights: [],
  }

  it('lists items with quantity stepper and type badges', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.add(subscriptionItem, 'subscription', 'Monthly')
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))

    expect(wrapper.text()).toContain('One-time purchase')
    expect(wrapper.text()).toContain('Monthly')
  })

  it('disables the minus button at quantity 1, and increments/decrements otherwise', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))

    const minusButtons = wrapper.findAll('button').filter(b => b.text() === '−')
    expect(minusButtons[0].attributes('disabled')).toBeDefined()

    const plusButton = wrapper.findAll('button').find(b => b.text() === '+')!
    await plusButton.trigger('click')
    expect(cart.items[0].quantity).toBe(2)
  })

  it('removes an item via its remove button', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))

    await wrapper.get('[title="Remove"]').trigger('click')
    expect(cart.items).toHaveLength(0)
  })

  it('shows the discount line only when a discount is applied', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.totals = { subtotal: 20, discount: 0, total: 20 } as never
    const wrapperNoDiscount = mountView()
    await vi.waitFor(() => expect(wrapperNoDiscount.text()).toContain('Product A'))
    expect(wrapperNoDiscount.text()).not.toContain('Discount')

    cart.totals = { subtotal: 20, discount: 5, total: 15 } as never
    const wrapperWithDiscount = mountView()
    await vi.waitFor(() => expect(wrapperWithDiscount.text()).toContain('Discount'))
  })
})

describe('CartView — shipping destination', () => {
  const productItem: Product = { id: 'p1', name: 'Product A', price: 20, image: '' }

  it('shows a loading skeleton, then the country select filtered by supported countries', async () => {
    let resolveCountries!: (v: ConciarCountry[]) => void
    vi.spyOn(conciarApi.countries, 'list').mockReturnValue(new Promise(r => (resolveCountries = r)))
    useCartStore().add(productItem, 'product')
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
    expect(wrapper.find('select').exists()).toBe(false)

    resolveCountries([nl, de])
    await vi.waitFor(() => expect(wrapper.find('select').exists()).toBe(true))
    expect(wrapper.text()).toContain('Netherlands')
    expect(wrapper.text()).toContain('Germany')
  })

  it('restricts options to storeConfig.supportedCountries when set', async () => {
    useCartStore().add(productItem, 'product')
    useStoreConfigStore().config = { supported_countries: ['NL'] } as never
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Netherlands'))
    expect(wrapper.text()).not.toContain('Germany')
  })

  it('persists the selected country and updates the "shipping to" label', async () => {
    useCartStore().add(productItem, 'product')
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Netherlands'))

    await wrapper.get('select').setValue('NL')
    expect(localStorage.getItem('shop_cart_country')).toBe('NL')
    expect(wrapper.text()).toContain('Shipping to Netherlands')
  })
})

describe('CartView — free shipping progress', () => {
  const productItem: Product = { id: 'p1', name: 'Product A', price: 20, image: '' }

  it('shows the unlocked banner once qualified', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.totals = { subtotal: 20, discount: 0, total: 20, free_shipping: { threshold: 50, remaining: 0, qualified: true } } as never
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain("unlocked free shipping"))
  })

  it('shows a progress bar with the remaining amount when not yet qualified', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.totals = { subtotal: 20, discount: 0, total: 20, free_shipping: { threshold: 50, remaining: 30, qualified: false } } as never
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('€ 30,00'))
  })

  it('hides the free-shipping section entirely when there is no offer', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.totals = { subtotal: 20, discount: 0, total: 20, free_shipping: null } as never
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
    expect(wrapper.text()).not.toContain('free shipping')
  })
})

describe('CartView — coupons', () => {
  const productItem: Product = { id: 'p1', name: 'Product A', price: 20, image: '' }

  beforeEach(() => {
    vi.stubEnv('VITE_CONCIAR_API_URL', 'https://api.test')
    localStorage.setItem('cart_token', 'tok')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('applies a coupon and shows it in the applied list', async () => {
    // Echo back only the coupon codes actually requested — the cart.add() call
    // also fires a sync (no coupon_codes), which must NOT pre-apply the coupon.
    vi.spyOn(conciarApi.cart, 'sync').mockImplementation(async (body: ConciarCartSyncRequest) => ({
      items: [],
      coupons: body.coupon_codes?.map(code => ({ code, discount_percentage: 10 })) ?? [],
      totals: null,
    } as never))
    useCartStore().add(productItem, 'product')
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.find('input[placeholder="Coupon code"]').exists()).toBe(true))

    await wrapper.get('input[placeholder="Coupon code"]').setValue('SAVE10')
    await wrapper.findAll('button').find(b => b.text().includes('Apply'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('SAVE10'))
    expect(wrapper.text()).toContain('(-10%)')
  })

  it('shows an error message when applying an invalid coupon', async () => {
    useCartStore().add(productItem, 'product')
    vi.spyOn(conciarApi.cart, 'sync').mockRejectedValue(Object.assign(new Error('bad'), {
      status: 422, body: { message: 'That code has expired.' },
    }))
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.find('input[placeholder="Coupon code"]').exists()).toBe(true))

    await wrapper.get('input[placeholder="Coupon code"]').setValue('EXPIRED')
    await wrapper.findAll('button').find(b => b.text().includes('Apply'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('That code has expired.'))
  })

  it('removes an applied coupon', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.appliedCoupons = [{ code: 'SAVE10', discount_percentage: 10 }] as never
    vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue({ items: [], coupons: [], totals: null } as never)
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('SAVE10'))

    await wrapper.findAll('button').find(b => b.text().includes('Remove'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('SAVE10'))
  })

  it('hides the input once a coupon is applied unless stacking is enabled', async () => {
    vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue({ items: [], coupons: [], totals: null } as never)
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.appliedCoupons = [{ code: 'SAVE10', discount_percentage: 10 }] as never
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('SAVE10'))
    expect(wrapper.find('input[placeholder="Coupon code"]').exists()).toBe(false)

    useStoreConfigStore().config = { couponsStackable: true } as never
    await wrapper.vm.$nextTick()
    expect(wrapper.find('input[placeholder="Coupon code"]').exists()).toBe(true)
  })
})

describe('CartView — checkout CTA', () => {
  it('navigates to /checkout from the summary button', async () => {
    useCartStore().add({ id: 'p1', name: 'Product A', price: 20, image: '' }, 'product')
    const router = testRouter()
    const wrapper = mountWithPlugins(CartView, { global: { plugins: [router] } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))

    await wrapper.findAll('button').find(b => b.text().includes('Proceed to checkout'))!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/checkout'))
  })
})

describe('CartView — remaining branch coverage', () => {
  const productItem: Product = { id: 'p1', name: 'Product A', price: 20, image: '' }

  it('shows the generic subscription badge when the item carries no interval label', async () => {
    const cart = useCartStore()
    cart.add({
      id: 's1', isSubscription: true, name: 'Box', tagline: '', description: '',
      price: 40, frequency: 'monthly', image: '', highlights: [],
    } as SubscriptionBox, 'subscription') // no interval argument
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Box'))
    expect(wrapper.text()).toContain('Subscription')
  })

  it('hides the free-shipping bar when the offer threshold is zero', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.totals = { subtotal: 20, discount: 0, total: 20, free_shipping: { threshold: 0, remaining: 0, qualified: false } } as never
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
    expect(wrapper.text()).not.toContain('free shipping')
  })

  it('clamps free-shipping progress when remaining exceeds the threshold', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.totals = { subtotal: 20, discount: 0, total: 20, free_shipping: { threshold: 50, remaining: 80, qualified: false } } as never
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('€ 80,00'))
    expect(wrapper.find('.bg-primary.rounded-full').attributes('style')).toContain('width: 0%')
  })

  it('shows a coupon name alongside the code when the API provides one', async () => {
    const cart = useCartStore()
    cart.add(productItem, 'product')
    cart.appliedCoupons = [{ code: 'SAVE10', discount_percentage: null, default_info: { name: 'Spring promo' } }] as never
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('SAVE10'))
    expect(wrapper.text()).toContain('Spring promo')
    expect(wrapper.text()).not.toContain('(-')
  })
})
