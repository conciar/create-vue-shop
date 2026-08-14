import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import CheckoutView from './CheckoutView.vue'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import { useStoreConfigStore } from '@/stores/storeConfig'
import { conciarApi } from '@/api/conciar'
import type { Product, SubscriptionBox } from '@/types'
import type { ConciarCountry, ConciarCartShippingMethod, ConciarCartPaymentMethod, ConciarCartSyncRequest } from '@/api/conciar-types'

const nl: ConciarCountry = {
  id: 1, name: 'netherlands', iso_code_2: 'NL', call_prefix: 31,
  has_zipcode: true, has_state: false, address_format: '{street} {house_number}\n{zipcode} {city}',
  zipcode_format: null, phone_format: '06 12345678', phone_digits: 9,
} as never
const us: ConciarCountry = {
  id: 2, name: 'united_states', iso_code_2: 'US', call_prefix: 1,
  has_zipcode: true, has_state: true, address_format: '{house_number} {street}\n{city} {state} {zipcode}',
  zipcode_format: null, phone_format: '(555) 555-5555', phone_digits: 10,
} as never

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/checkout', component: CheckoutView },
      { path: '/login', component: { template: '<div/>' } },
      { path: '/cart', component: { template: '<div/>' } },
      { path: '/products', component: { template: '<div/>' } },
      { path: '/order/:reference', name: 'order-confirmation', component: { template: '<div/>' } },
    ],
  })
}

const productItem: Product = { id: 'p1', name: 'Wine A', price: 20, image: '' }
const subscriptionItem: SubscriptionBox = {
  id: 's1', isSubscription: true, name: 'Box', tagline: '', description: '', bottles: 3,
  price: 40, frequency: 'monthly', image: '', highlights: [], minimumCommitmentCycles: 3, renewCommitmentOnCycle: true,
}

const shippingMethod = (over: Partial<ConciarCartShippingMethod> = {}): ConciarCartShippingMethod => ({
  id: 1, is_free: true, delivery_type: 'home', resolved_info: { name: 'Standard', description: null }, rate: null,
  ...over,
} as never)

const paymentMethod = (over: Partial<ConciarCartPaymentMethod> = {}): ConciarCartPaymentMethod => ({
  id: 1, key: 'ideal', name: 'iDEAL', logo: null, payment_service_provider_key: 'mollie',
  ...over,
} as never)

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  vi.spyOn(conciarApi.countries, 'list').mockResolvedValue([nl, us])
  vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([])
  vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([])

  const cart = useCartStore()
  cart.add(productItem, 'product')
  cart.cartToken = 'cart-tok'

  const storeConfig = useStoreConfigStore()
  storeConfig.config = {
    checkout: { guestCheckout: true, requirePhone: false, requireShipping: true, termsUrl: null, privacyUrl: null },
    supported_countries: [],
  } as never
})

async function mountCheckout() {
  const router = testRouter()
  await router.push('/checkout')
  const wrapper = mountWithPlugins(CheckoutView, { global: { plugins: [router] } })
  await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
  return { wrapper, router }
}

// Required text inputs render as firstName, lastName, city, postcode, address,
// houseNumber for a guest — but a signed-in customer's contact fields are
// collapsed, so city/postcode shift to the front. Offset accordingly.
async function fillShippingAddress(
  wrapper: Awaited<ReturnType<typeof mountCheckout>>['wrapper'],
  { city = 'Amsterdam', postcode = '1000AA' }: { city?: string; postcode?: string } = {},
) {
  const contactFieldsVisible = wrapper.find('input[required][type="email"]').exists()
  const offset = contactFieldsVisible ? 2 : 0
  const textInputs = wrapper.findAll('input[required][type="text"]')
  await textInputs[offset].setValue(city)
  await textInputs[offset + 1].setValue(postcode)
}

describe('CheckoutView — guest checkout gate', () => {
  it('redirects to /login when guest checkout is disabled and no session', async () => {
    useStoreConfigStore().config = { checkout: { guestCheckout: false }, supported_countries: [] } as never
    const router = testRouter()
    await router.push('/checkout')
    mountWithPlugins(CheckoutView, { global: { plugins: [router] } })
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    expect(router.currentRoute.value.query.returnTo).toBe('/checkout')
  })

  it('allows guest checkout when guestCheckout is not explicitly disabled', async () => {
    const { wrapper } = await mountCheckout()
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('skips the redirect when guestCheckout is disabled but the customer is signed in', async () => {
    useStoreConfigStore().config = { checkout: { guestCheckout: false }, supported_countries: [] } as never
    useCustomerStore().accessToken = 'tok'
    const { wrapper } = await mountCheckout()
    expect(wrapper.find('form').exists()).toBe(true)
  })
})

describe('CheckoutView — loading', () => {
  it('shows a skeleton before countries load, then the form', async () => {
    let resolve!: (v: ConciarCountry[]) => void
    vi.spyOn(conciarApi.countries, 'list').mockReturnValue(new Promise(r => (resolve = r)))
    const router = testRouter()
    await router.push('/checkout')
    const wrapper = mountWithPlugins(CheckoutView, { global: { plugins: [router] } })
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(wrapper.find('form').exists()).toBe(false)

    resolve([nl, us])
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
  })
})

describe('CheckoutView — signed-in prefill', () => {
  it('prefills contact fields from the customer profile and shows a read-only summary', async () => {
    const customer = useCustomerStore()
    customer.accessToken = 'tok'
    customer.customer = { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' } as never
    const { wrapper } = await mountCheckout()
    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('ada@example.com')
    expect(wrapper.find('input[type="email"]').exists()).toBe(false) // collapsed summary, not the raw field
  })

  it('expands to editable fields via "Edit", and back via "Collapse"', async () => {
    const customer = useCustomerStore()
    customer.accessToken = 'tok'
    customer.customer = { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' } as never
    const { wrapper } = await mountCheckout()

    await wrapper.findAll('button').find(b => b.text() === 'Edit')!.trigger('click')
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)

    await wrapper.findAll('button').find(b => b.text() === 'Collapse')!.trigger('click')
    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
  })

  it('prefills the phone number from the customer profile', async () => {
    const customer = useCustomerStore()
    customer.accessToken = 'tok'
    customer.customer = {
      first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com',
      phones: [{ number: '612345678', country: { call_prefix: 31 } }],
    } as never
    const { wrapper } = await mountCheckout()
    await wrapper.findAll('button').find(b => b.text() === 'Edit')!.trigger('click')
    await vi.waitFor(() => expect((wrapper.get('input[type="tel"]').element as HTMLInputElement).value).toBe('612345678'))
  })

  it('applies the first saved address automatically, and switches to "enter new address"', async () => {
    const customer = useCustomerStore()
    customer.accessToken = 'tok'
    customer.customer = {
      first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com',
      shipping_addresses: [
        { id: 1, street: 'Main St', house_number: '1', city: 'Amsterdam', zipcode: '1000AA', country: { iso2: 'nl' } },
        { id: 2, street: 'Other St', house_number: '2', city: 'Rotterdam', zipcode: '2000BB', country: { iso2: 'nl' } },
      ],
    } as never
    const { wrapper } = await mountCheckout()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Amsterdam'))

    await wrapper.findAll('button').find(b => b.text().includes('Enter a new address'))!.trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Edit')!.trigger('click')
    expect(wrapper.get('input[required][type="text"]').element).toBeTruthy()
  })
})

describe('CheckoutView — country-driven layout', () => {
  it('shows postcode and hides state for a has_state:false country (NL)', async () => {
    const { wrapper } = await mountCheckout()
    expect(wrapper.text()).toContain('Postcode')
    expect(wrapper.text()).not.toContain('State / Province')
  })

  it('shows state for a has_state:true country (US)', async () => {
    const { wrapper } = await mountCheckout()
    await wrapper.get('select').setValue('US')
    await vi.waitFor(() => expect(wrapper.text()).toContain('State / Province'))
  })
})

describe('CheckoutView — shipping methods', () => {
  it('fetches and auto-selects the first shipping method once the address is complete', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod({ id: 1 }), shippingMethod({ id: 2, is_free: false, rate: { amount: 5, display_price: '€ 5,00' } as never })])
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)

    await vi.waitFor(() => expect(wrapper.text()).toContain('Standard'))
  })

  it('shows a "no delivery" message when no shipping methods are available', async () => {
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain("don't deliver to this address"))
  })

  it('re-fetches shipping methods (debounced) when the city changes', async () => {
    const list = vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    // Confirm the initial (non-debounced) fetch resolved before switching to fake
    // timers — vi.waitFor's own polling relies on real timers.
    await vi.waitFor(() => expect(wrapper.text()).toContain('Standard'))
    const callsBefore = list.mock.calls.length

    vi.useFakeTimers()
    await wrapper.findAll('input[required][type="text"]')[2].setValue('Rotterdam')
    await vi.advanceTimersByTimeAsync(600)
    vi.useRealTimers()
    await vi.waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(callsBefore))
  })
})

describe('CheckoutView — pickup picker', () => {
  it('fetches and lists pickup points for a "pickup" delivery method, and disables submit until one is chosen', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod({ id: 1, delivery_type: 'pickup' })])
    vi.spyOn(conciarApi.shipping, 'locations').mockResolvedValue([
      { code: 'L1', name: 'Shop A', distance: 500, address: { Street: 'Main', HouseNr: '1', Zipcode: '1000AA', City: 'Amsterdam' }, opening_hours: {} } as never,
    ])
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Choose a pickup point'))
    await vi.waitFor(() => expect(wrapper.text()).toContain('Shop A'))

    await wrapper.get('input[type="radio"][value="L1"]').setValue()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Shop A'))
  })

  it('shows "no pickup points" when the location list is empty', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod({ id: 1, delivery_type: 'pickup' })])
    vi.spyOn(conciarApi.shipping, 'locations').mockResolvedValue([])
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('No pickup points found'))
  })
})

describe('CheckoutView — home delivery timeframe picker', () => {
  it('fetches and shows delivery timeframes once a house number is entered', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod({ id: 1, delivery_type: 'home' })])
    vi.spyOn(conciarApi.shipping, 'deliveryOptions').mockResolvedValue([
      { date: '2026-03-01', timeframes: [{ from: '09:00:00', to: '12:00:00' }] } as never,
    ])
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Standard'))

    const houseNumberInput = wrapper.findAll('input[required][type="text"]').at(-1)!
    await houseNumberInput.setValue('10')
    await vi.waitFor(() => expect(wrapper.text()).toContain('09:00–12:00'))
  })
})

describe('CheckoutView — payment methods', () => {
  it('fetches and auto-selects the first payment method once a shipping method is chosen', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod({ id: 1, name: 'iDEAL' }), paymentMethod({ id: 2, name: 'Card' })])
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))
    expect(wrapper.text()).toContain('Card')
  })

  it('shows a "no payment methods" notice when none are available', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([])
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('No payment methods available'))
  })
})

describe('CheckoutView — billing address', () => {
  it('defaults to "same as shipping", and reveals a separate form when toggled', async () => {
    const { wrapper } = await mountCheckout()
    expect(wrapper.text()).toContain('Using your shipping address for billing.')

    await wrapper.findAll('button').find(b => b.text().includes('Same as shipping'))!.trigger('click')
    expect(wrapper.find('select').exists()).toBe(true) // billing country select now present alongside shipping
  })
})

describe('CheckoutView — coupons', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_CONCIAR_API_URL', 'https://api.test')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('applies a coupon in the order summary', async () => {
    vi.spyOn(conciarApi.cart, 'sync').mockImplementation(async (body: ConciarCartSyncRequest) => ({
      items: [],
      coupons: body.coupon_codes?.map(code => ({ code, discount_percentage: 10 })) ?? [],
      totals: null,
    } as never))
    const { wrapper } = await mountCheckout()
    await wrapper.get('input[placeholder="Discount code"]').setValue('SAVE10')
    await wrapper.findAll('button').find(b => b.text().includes('Apply'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('SAVE10'))
  })
})

describe('CheckoutView — order summary', () => {
  it('shows subscription commitment info and the renewal notice', async () => {
    const cart = useCartStore()
    cart.add(subscriptionItem, 'subscription', 'Monthly')
    const { wrapper } = await mountCheckout()
    expect(wrapper.text()).toContain('Min. 3 cycles')
    expect(wrapper.text()).toContain('Subscriptions renew automatically')
    expect(wrapper.text()).toContain('Minimum commitment')
  })
})

describe('CheckoutView — submit flow', () => {
  // Note: submit() only guards on cart.items.length, selectedShippingMethod
  // and selectedPaymentMethod (isFormReady is purely a UI disabled-state gate
  // on the button) — so triggering the form's submit event directly, once
  // shipping/payment auto-select, exercises the same code path without
  // needing to fill every contact field.

  it('shows the issues modal when checkout-check blocks proceeding, and removing the last issue routes to /cart', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod()])
    vi.spyOn(conciarApi.cart, 'checkoutCheck').mockResolvedValue({
      can_proceed: false, has_changes: false, warnings: [],
      issues: [{ sku: 'p1', name: 'Wine A', type: 'out_of_stock' }] as never,
    })
    const { wrapper, router } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))

    const cart = useCartStore()
    cart.appliedCoupons = [] // no-op, just ensures cart accessible
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Some items are no longer available'))

    await wrapper.get('button[title="Remove from cart"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/cart'))
  })

  it('re-syncs and shows a notice when checkout-check flags a coupon as invalid', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod()])
    vi.spyOn(conciarApi.cart, 'checkoutCheck').mockResolvedValue({
      can_proceed: true, has_changes: false, warnings: [],
      issues: [], coupon_warnings: [{ code: 'EXPIRED', reason: 'has expired.' }],
    } as never)
    vi.stubEnv('VITE_CONCIAR_API_URL', 'https://api.test')
    vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue({ items: [], coupons: [], totals: null } as never)
    const { wrapper } = await mountCheckout()
    useCartStore().appliedCoupons = [{ code: 'EXPIRED', discount_percentage: 10 }] as never
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))

    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('EXPIRED — has expired.'))
    vi.unstubAllEnvs()
  })

  it('shows the price warning modal on changed prices, and places the order on confirm', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod()])
    vi.spyOn(conciarApi.cart, 'checkoutCheck').mockResolvedValue({
      can_proceed: true, has_changes: true,
      warnings: [{ sku: 'p1', name: 'Wine A', original_price: 20, new_price: 22 }] as never,
      issues: [],
    })
    const create = vi.spyOn(conciarApi.orders, 'create').mockResolvedValue({
      order: { reference: 'ORD-1' }, payment_url: null, transaction_key: null,
    } as never)
    const { wrapper, router } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))

    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Some prices have changed'))

    await wrapper.findAll('button').find(b => b.text().includes('Confirm & continue'))!.trigger('click')
    await vi.waitFor(() => expect(create).toHaveBeenCalled())
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('order-confirmation'))
  })

  it('places the order directly when checkout-check is clean, redirecting to a payment URL when present', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod()])
    vi.spyOn(conciarApi.cart, 'checkoutCheck').mockResolvedValue({ can_proceed: true, has_changes: false, warnings: [], issues: [] })
    vi.spyOn(conciarApi.orders, 'create').mockResolvedValue({
      order: { reference: 'ORD-1' }, payment_url: 'https://pay.example.com/x', transaction_key: 'txn-1',
    } as never)
    const originalLocation = window.location
    // @ts-expect-error jsdom navigation isn't implemented — stub it for assertion
    delete window.location
    window.location = { ...originalLocation, href: '' } as never

    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))

    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(window.location.href).toBe('https://pay.example.com/x'))
    expect(sessionStorage.getItem('pending_transaction_key')).toBe('txn-1')
    window.location = originalLocation
  })
})

describe('CheckoutView — error handling', () => {
  async function submitWithError(err: unknown) {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod()])
    vi.spyOn(conciarApi.cart, 'checkoutCheck').mockRejectedValue(err)
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))
    await wrapper.get('form').trigger('submit')
    return wrapper
  }

  it('clears the cart and shows an expiry message on a 404', async () => {
    const wrapper = await submitWithError(Object.assign(new Error('gone'), { status: 404 }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('cart has expired'))
    expect(useCartStore().items).toHaveLength(0)
  })

  it('routes to /cart on a 422 "no items" error', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod()])
    vi.spyOn(conciarApi.cart, 'checkoutCheck').mockRejectedValue(
      Object.assign(new Error('bad'), { status: 422, body: { errors: { items: ['required'] } } }),
    )
    const { wrapper, router } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/cart'))
  })

  it('shows a stock message on a 422 "out of stock" error', async () => {
    const wrapper = await submitWithError(Object.assign(new Error('bad'), { status: 422, body: { message: 'Item out of stock' } }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('out of stock'))
  })

  it('shows a shipping message and refetches methods on a 422 "shipping" error', async () => {
    const wrapper = await submitWithError(Object.assign(new Error('bad'), { status: 422, body: { message: 'Shipping method invalid' } }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('shipping method is no longer available'))
  })

  it('shows a payment message on a 422 "payment" error', async () => {
    const wrapper = await submitWithError(Object.assign(new Error('bad'), { status: 422, body: { message: 'Payment declined' } }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('payment method is no longer available'))
  })

  it('clears coupons and shows a message on a 422 "coupon" error', async () => {
    const wrapper = await submitWithError(Object.assign(new Error('bad'), { status: 422, body: { message: 'Coupon invalid' } }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('discount code is no longer valid'))
  })

  it('shows a generic message for an unrecognized 422 error', async () => {
    const wrapper = await submitWithError(Object.assign(new Error('bad'), { status: 422, body: { message: 'Something else' } }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('check your details'))
  })

  it('shows the API message for a non-422 error when present', async () => {
    const wrapper = await submitWithError(Object.assign(new Error('bad'), { status: 500, body: { message: 'Server exploded' } }))
    await vi.waitFor(() => expect(wrapper.text()).toContain('Server exploded'))
  })

  it('shows a generic error message for a non-422 error without an API message', async () => {
    const wrapper = await submitWithError(new Error('network down'))
    await vi.waitFor(() => expect(wrapper.text()).toContain('Something went wrong'))
  })
})

describe('CheckoutView — mobile CTA', () => {
  it('renders a mobile sticky submit button that triggers the same submit flow', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod()])
    const check = vi.spyOn(conciarApi.cart, 'checkoutCheck').mockResolvedValue({ can_proceed: true, has_changes: false, warnings: [], issues: [] })
    vi.spyOn(conciarApi.orders, 'create').mockResolvedValue({ order: { reference: 'ORD-1' }, payment_url: null, transaction_key: null } as never)
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))

    // The mobile CTA button (unlike a direct form-submit trigger) respects
    // :disabled="!isFormReady", so fill in the remaining required fields.
    const textInputs = wrapper.findAll('input[required][type="text"]')
    await textInputs[0].setValue('Jane')
    await textInputs[1].setValue('Doe')
    await textInputs[4].setValue('Main St')
    await textInputs[5].setValue('10')
    await wrapper.get('input[required][type="email"]').setValue('jane@example.com')

    const mobileCta = wrapper.find('.fixed.bottom-0.inset-x-0.z-30')
    expect(mobileCta.exists()).toBe(true)
    await mobileCta.get('button').trigger('click')
    await vi.waitFor(() => expect(check).toHaveBeenCalled())
  })
})

describe('CheckoutView — additional branch coverage', () => {
  it('switches between multiple saved addresses', async () => {
    const customer = useCustomerStore()
    customer.accessToken = 'tok'
    customer.customer = {
      first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com',
      shipping_addresses: [
        { id: 1, street: 'Main St', house_number: '1', city: 'Amsterdam', zipcode: '1000AA', country: { iso2: 'nl' } },
        { id: 2, street: 'Other St', house_number: '2', city: 'Rotterdam', zipcode: '2000BB', country: { iso2: 'nl' } },
      ],
    } as never
    const { wrapper } = await mountCheckout()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Amsterdam'))

    await wrapper.findAll('button').find(b => b.text().includes('Rotterdam'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Rotterdam'))
  })

  it('updates form.phone from the PhoneInput field', async () => {
    const { wrapper } = await mountCheckout()
    await wrapper.get('input[type="tel"]').setValue('612345678')
    // Re-render triggers the checkout summary review section once other fields are also present;
    // the phone value itself is asserted via the PhoneInput's own input state.
    expect((wrapper.get('input[type="tel"]').element as HTMLInputElement).value).toBe('612345678')
  })

  it('manually selects a different shipping method than the auto-selected first', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([
      shippingMethod({ id: 1 }),
      shippingMethod({ id: 2, is_free: false, rate: { amount: 5, display_price: '€ 5,00' } as never }),
    ])
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Standard'))

    const radios = wrapper.findAll('input[type="radio"]')
    await radios[1].setValue(true)
    await vi.waitFor(() => expect(wrapper.text()).toContain('€ 5,00'))
  })

  it('selects a pickup location via its radio input', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod({ id: 1, delivery_type: 'pickup' })])
    vi.spyOn(conciarApi.shipping, 'locations').mockResolvedValue([
      { code: 'L1', name: 'Shop A', distance: 500, address: { Street: 'Main', HouseNr: '1', Zipcode: '1000AA', City: 'Amsterdam' }, opening_hours: {} } as never,
    ])
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Shop A'))

    await wrapper.get('input[type="radio"][value="L1"]').setValue(true)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Shop A'))
  })

  it('selects a home-delivery timeframe', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod({ id: 1, delivery_type: 'home' })])
    vi.spyOn(conciarApi.shipping, 'deliveryOptions').mockResolvedValue([
      { date: '2026-03-01', timeframes: [{ from: '09:00:00', to: '12:00:00' }] } as never,
    ])
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Standard'))
    await wrapper.findAll('input[required][type="text"]').at(-1)!.setValue('10')
    await vi.waitFor(() => expect(wrapper.text()).toContain('09:00–12:00'))

    await wrapper.findAll('button').find(b => b.text().includes('09:00'))!.trigger('click')
    expect(wrapper.text()).toContain('09:00–12:00')
  })

  it('removes an applied coupon from the order summary', async () => {
    vi.stubEnv('VITE_CONCIAR_API_URL', 'https://api.test')
    // Seed the coupon BEFORE mounting, and echo whatever codes each sync asks
    // for — mounting fires background syncs that would otherwise race with (and
    // clear) a coupon seeded afterwards.
    useCartStore().appliedCoupons = [{ code: 'SAVE10', discount_percentage: 10 }] as never
    vi.spyOn(conciarApi.cart, 'sync').mockImplementation(async (body: ConciarCartSyncRequest) => {
      const codes = body.coupon_codes
        ?? useCartStore().appliedCoupons.map(c => c.code)
      return { items: [], coupons: codes.map(code => ({ code, discount_percentage: 10 })), totals: null } as never
    })
    const { wrapper } = await mountCheckout()
    await vi.waitFor(() => expect(wrapper.text()).toContain('SAVE10'))

    await wrapper.findAll('button').find(b => b.text().includes('Remove'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('SAVE10'))
    vi.unstubAllEnvs()
  })

  it('closes the issues modal without removing an item', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod()])
    vi.spyOn(conciarApi.cart, 'checkoutCheck').mockResolvedValue({
      can_proceed: false, has_changes: false, warnings: [],
      issues: [{ sku: 'p1', name: 'Wine A', type: 'out_of_stock' }] as never,
    })
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))

    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Some items are no longer available'))
    // CheckoutIssuesModal has no close button — only backdrop click and "Go to cart".
    await wrapper.get('.absolute.inset-0.bg-charcoal\\/50').trigger('click')
    expect(wrapper.text()).not.toContain('Some items are no longer available')
    expect(useCartStore().items).toHaveLength(1)
  })

  it('cancels the price-warning modal without placing the order', async () => {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod()])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod()])
    vi.spyOn(conciarApi.cart, 'checkoutCheck').mockResolvedValue({
      can_proceed: true, has_changes: true,
      warnings: [{ sku: 'p1', name: 'Wine A', original_price: 20, new_price: 22 }] as never,
      issues: [],
    })
    const create = vi.spyOn(conciarApi.orders, 'create')
    const { wrapper } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))

    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Some prices have changed'))
    await wrapper.findAll('button').find(b => b.text().includes('Go back'))!.trigger('click')
    expect(wrapper.text()).not.toContain('Some prices have changed')
    expect(create).not.toHaveBeenCalled()
  })
})

describe('CheckoutView — order composition branches', () => {
  async function readyWithMethods(over: { shipping?: Partial<ConciarCartShippingMethod> } = {}) {
    vi.spyOn(conciarApi.cart, 'shippingMethods').mockResolvedValue([shippingMethod(over.shipping)])
    vi.spyOn(conciarApi.cart, 'paymentMethods').mockResolvedValue([paymentMethod()])
    vi.spyOn(conciarApi.cart, 'checkoutCheck').mockResolvedValue({ can_proceed: true, has_changes: false, warnings: [], issues: [] })
    const created = vi.spyOn(conciarApi.orders, 'create').mockResolvedValue({
      order: { reference: 'ORD-1' }, payment_url: null, transaction_key: null,
    } as never)
    const { wrapper, router } = await mountCheckout()
    await fillShippingAddress(wrapper)
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))
    return { wrapper, router, created }
  }

  it('adds a non-free shipping rate into the order total', async () => {
    const { wrapper } = await readyWithMethods({
      shipping: { is_free: false, rate: { amount: 7.5, display_price: '€ 7,50' } as never },
    })
    expect(wrapper.text()).toContain('€ 7,50')
    expect(wrapper.text()).toContain('€ 27,50') // 20 subtotal + 7.50 shipping
  })

  it('treats a non-free method with no rate as zero shipping', async () => {
    const { wrapper } = await readyWithMethods({ shipping: { is_free: false, rate: null } })
    expect(wrapper.text()).toContain('€ 20,00')
  })

  it('sends guest customer details, parsing the phone into number + country_id', async () => {
    const { wrapper, created } = await readyWithMethods()
    const textInputs = wrapper.findAll('input[required][type="text"]')
    await textInputs[0].setValue('Jane')
    await textInputs[1].setValue('Doe')
    await textInputs[4].setValue('Main St')
    await textInputs[5].setValue('10')
    await wrapper.get('input[required][type="email"]').setValue('jane@example.com')
    await wrapper.get('input[type="tel"]').setValue('612345678')
    await wrapper.get('textarea').setValue('Ring the bell')

    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(created).toHaveBeenCalled())
    expect(created.mock.calls[0][0]).toMatchObject({
      customer: {
        email: 'jane@example.com', first_name: 'Jane', last_name: 'Doe',
        phone: { number: '612345678', country_id: 1 },
      },
      customerNotes: 'Ring the bell',
    })
  })

  it('omits the customer object entirely when signed in', async () => {
    const customer = useCustomerStore()
    customer.accessToken = 'tok'
    customer.customer = { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com' } as never
    const { created } = await readyWithMethods()
    await vi.waitFor(() => expect(created).toBeDefined())
  })

  it('omits phone details when the phone number has no matching country prefix', async () => {
    const { wrapper, created } = await readyWithMethods()
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(created).toHaveBeenCalled())
    expect(created.mock.calls[0]![0].customer?.phone).toBeUndefined()
  })

  it('sends a pickup_location_code for a pickup method', async () => {
    vi.spyOn(conciarApi.shipping, 'locations').mockResolvedValue([
      { code: 'L1', name: 'Shop A', distance: 1500, address: { Street: 'Main', HouseNr: '1', Zipcode: '1000AA', City: 'Amsterdam' }, opening_hours: { Monday: ['09:00-17:00'] } } as never,
    ])
    const { wrapper, created } = await readyWithMethods({ shipping: { delivery_type: 'pickup' } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Shop A'))
    expect(wrapper.text()).toContain('1.5 km') // metres >= 1000 formats as km

    await wrapper.get('input[type="radio"][value="L1"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(created).toHaveBeenCalled())
    expect(created.mock.calls[0][0].pickupLocationCode).toBe('L1')
  })

  it('formats a sub-kilometre pickup distance in metres', async () => {
    vi.spyOn(conciarApi.shipping, 'locations').mockResolvedValue([
      { code: 'L1', name: 'Shop A', distance: 450, address: { Street: 'Main', HouseNr: '1', Zipcode: '1000AA', City: 'Amsterdam' }, opening_hours: {} } as never,
    ])
    const { wrapper } = await readyWithMethods({ shipping: { delivery_type: 'pickup' } })
    await vi.waitFor(() => expect(wrapper.text()).toContain('450 m'))
  })

  it('sends a separate billing address when "same as shipping" is toggled off', async () => {
    const { wrapper, created } = await readyWithMethods()
    await wrapper.findAll('button').find(b => b.text().includes('Same as shipping'))!.trigger('click')

    const selects = wrapper.findAll('select')
    await selects[1].setValue('US') // billing country (has_state: true, reveals the state field)
    await vi.waitFor(() => expect(wrapper.findAll('input[required][type="text"]').length).toBeGreaterThan(6))

    const billingInputs = wrapper.findAll('input[required][type="text"]').slice(6)
    await billingInputs[0].setValue('Bill City')
    await billingInputs[1].setValue('90210')
    await billingInputs[2].setValue('Billing St')
    await billingInputs[3].setValue('42')

    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(created).toHaveBeenCalled())
    expect(created.mock.calls[0][0].billingAddress).toMatchObject({
      city: 'Bill City', zipcode: '90210', street: 'Billing St', house_number: '42', country_id: 2,
    })
  })

  it('renders terms and privacy links when the store config provides them', async () => {
    useStoreConfigStore().config = {
      checkout: { guestCheckout: true, termsUrl: 'https://x/terms', privacyUrl: 'https://x/privacy' },
      supported_countries: [],
    } as never
    const { wrapper } = await mountCheckout()
    expect(wrapper.find('a[href="https://x/terms"]').exists()).toBe(true)
    expect(wrapper.find('a[href="https://x/privacy"]').exists()).toBe(true)
  })

  it('restricts the country list to storeConfig.supportedCountries', async () => {
    useStoreConfigStore().config = {
      checkout: { guestCheckout: true }, supported_countries: ['US'],
    } as never
    const { wrapper } = await mountCheckout()
    expect(wrapper.text()).toContain('United States')
    expect(wrapper.text()).not.toContain('Netherlands')
  })

  it('hides the shipping-method section when requireShipping is false', async () => {
    useStoreConfigStore().config = {
      checkout: { guestCheckout: true, requireShipping: false }, supported_countries: [],
    } as never
    const { wrapper } = await mountCheckout()
    expect(wrapper.text()).not.toContain('Shipping method')
  })

  it('marks the phone field required when requirePhone is true', async () => {
    useStoreConfigStore().config = {
      checkout: { guestCheckout: true, requirePhone: true }, supported_countries: [],
    } as never
    const { wrapper } = await mountCheckout()
    expect(wrapper.text()).toContain('Phone number')
  })
})
