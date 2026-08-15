import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mapProduct, conciarApi, maintenanceState } from './conciar'
import type { ConciarProduct } from './conciar-types'

beforeEach(() => {
  localStorage.clear()
  maintenanceState.active = false
  maintenanceState.message = ''
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Minimal ConciarProduct factory — only the fields mapProduct reads are set;
// cast through `unknown` so we don't have to populate the full (large) type.
function product(over: Record<string, unknown> = {}): ConciarProduct {
  return {
    id: 1,
    is_subscription: false,
    default_info: { name: 'Item', description: null },
    resolved_info: null,
    variants: [],
    retail_price: null,
    converted_retail_price: null,
    compare_price: null,
    converted_compare_price: null,
    subscription_detail: null,
    ...over,
  } as unknown as ConciarProduct
}

const conv = (amount: number) => ({ amount, display_price: '', currency: {} })
const retail = (amount: string) => ({ id: 1, amount, display_price: '', currency: {} })

describe('mapProduct — price resolution precedence', () => {
  it('uses the product converted_retail_price when there is no variant', () => {
    expect(mapProduct(product({ converted_retail_price: conv(25) })).price).toBe(25)
  })

  it('prefers the active variant converted price over the product price', () => {
    const p = product({
      variants: [{ id: 9, active: true, converted_retail_price: conv(30) }],
      converted_retail_price: conv(25),
    })
    const box = mapProduct(p)
    expect(box.price).toBe(30)
    expect(box.variantId).toBe('9')
  })

  it('falls back to the variant raw retail_price (parsed) when no converted price', () => {
    const p = product({
      variants: [{ id: 9, active: true, converted_retail_price: null, retail_price: retail('19.50') }],
    })
    expect(mapProduct(p).price).toBe(19.5)
  })

  it('falls back to the product raw retail_price when nothing else is present', () => {
    expect(mapProduct(product({ retail_price: retail('12.00') })).price).toBe(12)
  })

  it('defaults to 0 when no price is available', () => {
    expect(mapProduct(product()).price).toBe(0)
  })

  it('ignores an inactive variant when resolving price', () => {
    const p = product({
      variants: [{ id: 9, active: false, converted_retail_price: conv(30) }],
      converted_retail_price: conv(25),
    })
    const box = mapProduct(p)
    expect(box.price).toBe(25)
    expect(box.variantId).toBeUndefined()
  })
})

describe('mapProduct — compare price → originalPrice', () => {
  it('shows originalPrice only when the compare price is strictly greater', () => {
    expect(mapProduct(product({ converted_retail_price: conv(20), converted_compare_price: conv(30) })).originalPrice).toBe(30)
  })

  it('omits originalPrice when the compare price is not above the selling price', () => {
    expect(mapProduct(product({ converted_retail_price: conv(20), converted_compare_price: conv(15) })).originalPrice).toBeUndefined()
    expect(mapProduct(product({ converted_retail_price: conv(20), converted_compare_price: conv(20) })).originalPrice).toBeUndefined()
  })
})

describe('mapProduct — subscription frequency + misc', () => {
  it('maps a quarterly billing cycle, and everything else to monthly', () => {
    expect(mapProduct(product({ subscription_detail: { billing_cycle_unit: 'quarterly' } })).frequency).toBe('quarterly')
    expect(mapProduct(product({ subscription_detail: { billing_cycle_unit: 'four_weekly' } })).frequency).toBe('monthly')
  })

  it('defaults frequency to monthly when not a subscription', () => {
    expect(mapProduct(product()).frequency).toBe('monthly')
  })

  it('passes through id and isSubscription', () => {
    const box = mapProduct(product({ id: 42, is_subscription: true }))
    expect(box.id).toBe('42')
    expect(box.isSubscription).toBe(true)
  })
})

function fetchOk(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  })
}

describe('conciarApi — mock mode (VITE_CONCIAR_API_URL unset)', () => {
  it('storeConfig.get returns the demo store config', async () => {
    const config = await conciarApi.storeConfig.get()
    expect(config.general.store_name).toBe('Demo Store')
  })

  it('countries.list returns the demo country list', async () => {
    const countries = await conciarApi.countries.list()
    expect(countries.length).toBeGreaterThan(0)
    expect(countries[0]).toHaveProperty('iso_code_2')
  })

  it('products.list returns the mock subscriptions', async () => {
    const products = await conciarApi.products.list({ featured: true })
    expect(products.length).toBeGreaterThan(0)
  })

  it('products.get returns a matching mock subscription, and rejects when missing', async () => {
    const products = await conciarApi.products.list()
    const found = await conciarApi.products.get(products[0].id)
    expect(found.id).toBe(products[0].id)
    await expect(conciarApi.products.get('does-not-exist')).rejects.toThrow('Not found')
  })

  it('products.getDetail returns a mapped detail record, and rejects when missing', async () => {
    const detail = await conciarApi.products.getDetail('1')
    expect(detail.id).toBe(1)
    expect(detail.resolved_info?.name).toBeTruthy()
    await expect(conciarApi.products.getDetail('9999')).rejects.toThrow('Not found')
  })

  it('paymentMethods.list returns an empty list', async () => {
    expect(await conciarApi.paymentMethods.list()).toEqual([])
  })

  it('shippingMethods.list returns an empty list', async () => {
    expect(await conciarApi.shippingMethods.list()).toEqual([])
  })

  it('shipping.locations and deliveryOptions return empty lists', async () => {
    expect(await conciarApi.shipping.locations({ country_code: 'NL', postal_code: '1234AB' })).toEqual([])
    expect(await conciarApi.shipping.deliveryOptions({ country_code: 'NL', postal_code: '1234AB', house_number: '1' })).toEqual([])
  })

  it('cart.shippingMethods, paymentMethods and checkoutCheck return mock defaults', async () => {
    expect(await conciarApi.cart.shippingMethods('tok', { country_code: 'NL' })).toEqual([])
    expect(await conciarApi.cart.paymentMethods('tok', { shipping_method_id: 1, country_id: 1 })).toEqual([])
    expect(await conciarApi.cart.checkoutCheck('tok')).toEqual({ can_proceed: true, issues: [], has_changes: false, warnings: [] })
  })

  it('orders.list/get return the mock orders, and get rejects when missing', async () => {
    const orders = await conciarApi.orders.list()
    expect(Array.isArray(orders)).toBe(true)
    if (orders.length) {
      expect((await conciarApi.orders.get(orders[0].id)).id).toBe(orders[0].id)
    }
    await expect(conciarApi.orders.get('missing')).rejects.toThrow('Not found')
  })

  it('orders.getStatus and getStatusByTransaction return mock statuses', async () => {
    expect((await conciarApi.orders.getStatus('ORD-1')).reference).toBe('ORD-1')
    expect((await conciarApi.orders.getStatusByTransaction('tx-1')).is_paid).toBe(true)
  })

  it('orders.create returns a synthesized mock order', async () => {
    const result = await conciarApi.orders.create({ cartToken: 'tok' } as never)
    expect(result.order.status.name).toBe('pending')
    expect(result.payment_url).toBeNull()
  })

  it('customerSubscriptions mock endpoints return empty/throw as documented', async () => {
    expect(await conciarApi.customerSubscriptions.list('tok')).toEqual([])
    await expect(conciarApi.customerSubscriptions.get('tok', 1)).rejects.toThrow('Not found')
    await expect(conciarApi.customerSubscriptions.skip('tok', 1, 1)).rejects.toThrow('Not found')
    await expect(conciarApi.customerSubscriptions.unskip('tok', 1)).rejects.toThrow('Not found')
    await expect(conciarApi.customerSubscriptions.pause('tok', 1)).rejects.toThrow('Not found')
    await expect(conciarApi.customerSubscriptions.resume('tok', 1)).rejects.toThrow('Not found')
    await expect(conciarApi.customerSubscriptions.cancel('tok', 1)).rejects.toThrow('Not found')
    await expect(conciarApi.customerSubscriptions.updateShipping('tok', 1, {} as never)).rejects.toThrow('Not found')
    expect(await conciarApi.customerSubscriptions.swapOptions('tok', 1)).toEqual({ products: [] })
    await expect(conciarApi.customerSubscriptions.swap('tok', 1, 1)).rejects.toThrow('Not found')
    expect(await conciarApi.customerSubscriptions.updatePaymentMethod('tok', 1, 1, 1, 'https://return')).toEqual({ payment_url: null, transaction_key: null })
    expect(await conciarApi.customerSubscriptions.shippingMethods('tok', 1, { country_code: 'NL' })).toEqual([])
  })

  it('storePaymentMethods.list returns an empty list', async () => {
    expect(await conciarApi.storePaymentMethods.list('tok')).toEqual([])
  })

  it('customerOrders.list returns an empty page, and get rejects', async () => {
    expect(await conciarApi.customerOrders.list('tok')).toEqual({ data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 })
    await expect(conciarApi.customerOrders.get('tok', 'ORD-1')).rejects.toThrow('Not found')
  })

  describe('connect.products (mock filtering/pagination)', () => {
    it('filters by query text', async () => {
      const all = await conciarApi.connect.products.list({})
      const named = all.data[0].resolved_info?.name ?? ''
      const filtered = await conciarApi.connect.products.list({ q: named.slice(0, 3) })
      expect(filtered.data.length).toBeGreaterThan(0)
    })

    it('filters by price range and subscription flag', async () => {
      const cheap = await conciarApi.connect.products.list({ price_max: 0 })
      expect(cheap.data).toEqual([])
      const subs = await conciarApi.connect.products.list({ subscription: true })
      expect(subs.data).toEqual([])
    })

    it('paginates results with per_page/page', async () => {
      const page1 = await conciarApi.connect.products.list({ per_page: 1, page: 1 })
      expect(page1.data).toHaveLength(1)
      expect(page1.current_page).toBe(1)
      expect(page1.last_page).toBeGreaterThanOrEqual(1)
    })

    it('filters() returns an empty filter set in mock mode', async () => {
      expect(await conciarApi.connect.products.filters({})).toEqual([])
    })
  })
})

describe('conciarApi — request() (always hits fetch, mock or not)', () => {
  it('sends the expected headers and resolves JSON on success', async () => {
    localStorage.setItem('customer_token', 'my-token')
    localStorage.setItem('locale', 'de')
    const fetchMock = fetchOk({ expires_in: '5m' })
    vi.stubGlobal('fetch', fetchMock)

    await conciarApi.auth.requestOtp('user@example.com', 'email')

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/otp/request', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Accept-Language': 'de',
        'X-Language': 'de',
        Authorization: 'Bearer my-token',
      }),
    }))
  })

  it('defaults the locale header to "nl" and omits Authorization when logged out', async () => {
    const fetchMock = fetchOk({ expires_in: '5m' })
    vi.stubGlobal('fetch', fetchMock)

    await conciarApi.auth.requestOtp('user@example.com', 'email')

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['Accept-Language']).toBe('nl')
    expect(options.headers.Authorization).toBeUndefined()
  })

  it('throws with status + body on a non-ok response', async () => {
    vi.stubGlobal('fetch', fetchOk({ message: 'nope' }, 404))
    await expect(conciarApi.auth.resendOtp('user@example.com', 'email')).rejects.toMatchObject({
      status: 404,
      body: { message: 'nope' },
    })
  })

  it('handles a non-ok response with a non-JSON body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 500, ok: false, json: async () => { throw new Error('not json') },
    }))
    await expect(conciarApi.auth.resendOtp('user@example.com', 'email')).rejects.toMatchObject({ status: 500, body: null })
  })

  it('flags maintenance mode on a 503 and throws store_maintenance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 503, ok: false, json: async () => ({ maintenance: true, message: 'Down for upgrades' }),
    }))
    await expect(conciarApi.auth.resendOtp('user@example.com', 'email')).rejects.toThrow('store_maintenance')
    expect(maintenanceState.active).toBe(true)
    expect(maintenanceState.message).toBe('Down for upgrades')
  })

  it('a 503 with a non-JSON body still throws store_maintenance without flagging maintenance', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 503, ok: false, json: async () => { throw new Error('not json') },
    }))
    await expect(conciarApi.auth.resendOtp('user@example.com', 'email')).rejects.toThrow('store_maintenance')
    expect(maintenanceState.active).toBe(false)
  })

  it('auth.verifyOtp and cart.init/sync/get all resolve through request()', async () => {
    vi.stubGlobal('fetch', fetchOk({ status: true, data: {} }))
    await conciarApi.auth.verifyOtp('user@example.com', 'email', '123456')

    vi.stubGlobal('fetch', fetchOk({ data: { cart_token: 'tok' } }))
    expect((await conciarApi.cart.init()).cart_token).toBe('tok')

    vi.stubGlobal('fetch', fetchOk({ cart: { items: [] } }))
    expect((await conciarApi.cart.sync({ cart_token: 'tok', items: [] })).items).toEqual([])
    expect((await conciarApi.cart.get('tok')).items).toEqual([])
  })

  it('discounts.apply resolves through request()', async () => {
    vi.stubGlobal('fetch', fetchOk({ data: { code: 'SAVE10' } }))
    expect((await conciarApi.discounts.apply('SAVE10')).code).toBe('SAVE10')
  })
})

describe('conciarApi — live mode (VITE_CONCIAR_API_URL set)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function loadLiveApi() {
    vi.stubEnv('VITE_CONCIAR_API_URL', 'https://api.test')
    vi.resetModules()
    return (await import('./conciar')).conciarApi
  }

  it('products.list builds query params and maps the response', async () => {
    vi.stubGlobal('fetch', fetchOk({
      data: { data: [{ id: 1, active: true, is_subscription: false, default_info: { name: 'A', description: null }, resolved_info: null, variants: [], retail_price: null, converted_retail_price: null, compare_price: null, converted_compare_price: null, subscription_detail: null }] },
    }))
    const liveApi = await loadLiveApi()
    const result = await liveApi.products.list({ featured: true, subscription: false })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('shipping.locations hits the real endpoint and returns the response list', async () => {
    vi.stubGlobal('fetch', fetchOk({ locations: [{ code: 'L1' }] }))
    const liveApi = await loadLiveApi()
    expect(await liveApi.shipping.locations({ country_code: 'NL', postal_code: '1234AB' })).toEqual([{ code: 'L1' }])
  })

  it('connect.products.list builds query params via the real endpoint', async () => {
    vi.stubGlobal('fetch', fetchOk({ data: { data: [], current_page: 1, last_page: 1, per_page: 20, total: 0 } }))
    const liveApi = await loadLiveApi()
    const result = await liveApi.connect.products.list({ q: 'test', price_min: 1, price_max: 10, per_page: 5, page: 2, subscription: true, properties: { color: ['red', 'blue'] } })
    expect(result.total).toBe(0)
  })

  it('orders.create includes every optional field when present', async () => {
    const fetchMock = fetchOk({ order: { reference: 'ORD-1' }, payment_url: null, transaction_key: null })
    vi.stubGlobal('fetch', fetchMock)
    const liveApi = await loadLiveApi()
    await liveApi.orders.create({
      cartToken: 'tok', accessToken: 'atok', shippingMethodId: 1, paymentMethodKey: 'ideal',
      paymentServiceProviderKey: 'mollie', returnUrl: 'https://x/return',
      shippingAddress: { city: 'Amsterdam' } as never,
      billingAddress: { city: 'Rotterdam' } as never,
      customer: { email: 'a@b.com' } as never,
      pickupLocationCode: 'PICKUP-1',
      customerNotes: 'Leave at door',
      cardToken: 'card-tok', paymentData: { foo: 'bar' }, applePayToken: 'apple-tok',
      applePayPaymentData: { baz: 'qux' },
    } as never)
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body).toMatchObject({
      billing_address: { city: 'Rotterdam' },
      customer: { email: 'a@b.com' },
      pickup_location_code: 'PICKUP-1',
      card_token: 'card-tok',
      payment_data: { foo: 'bar' },
      apple_pay_token: 'apple-tok',
      apple_pay_payment_data: { baz: 'qux' },
    })
  })

  it('orders.create omits optional fields when absent', async () => {
    const fetchMock = fetchOk({ order: { reference: 'ORD-1' }, payment_url: null, transaction_key: null })
    vi.stubGlobal('fetch', fetchMock)
    const liveApi = await loadLiveApi()
    await liveApi.orders.create({
      cartToken: 'tok', shippingMethodId: 1, paymentMethodKey: 'ideal',
      paymentServiceProviderKey: 'mollie', returnUrl: 'https://x/return',
      shippingAddress: { city: 'Amsterdam' } as never,
    } as never)
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.billing_address).toBeUndefined()
    expect(body.customer).toBeUndefined()
    expect(body.pickup_location_code).toBeUndefined()
    expect(body.card_token).toBeUndefined()
  })

  it('hits the real (non-mock) endpoint for products.get, getDetail, paymentMethods and shippingMethods', async () => {
    const liveApi = await loadLiveApi()

    vi.stubGlobal('fetch', fetchOk({ data: { id: 1, resolved_info: { name: 'A' } } }))
    expect((await liveApi.products.get('1')).id).toBe('1')

    vi.stubGlobal('fetch', fetchOk({ data: { id: 1 } }))
    expect((await liveApi.products.getDetail('1')).id).toBe(1)

    vi.stubGlobal('fetch', fetchOk({ data: [{ id: 1 }] }))
    expect(await liveApi.paymentMethods.list()).toEqual([{ id: 1 }])

    vi.stubGlobal('fetch', fetchOk({ data: [{ id: 1 }] }))
    expect(await liveApi.shippingMethods.list()).toEqual([{ id: 1 }])
  })

  it('hits the real endpoint for discounts.apply and shipping.deliveryOptions', async () => {
    const liveApi = await loadLiveApi()
    vi.stubGlobal('fetch', fetchOk({ data: { code: 'SAVE10' } }))
    expect((await liveApi.discounts.apply('SAVE10')).code).toBe('SAVE10')

    vi.stubGlobal('fetch', fetchOk({ delivery_options: [{ date: '2026-01-01' }] }))
    expect(await liveApi.shipping.deliveryOptions({ country_code: 'NL', postal_code: '1000AA', house_number: '1' })).toEqual([{ date: '2026-01-01' }])
  })

  it('hits the real endpoint for orders.list/get/getStatus/getStatusByTransaction', async () => {
    const liveApi = await loadLiveApi()
    vi.stubGlobal('fetch', fetchOk([{ id: '1' }]))
    expect(await liveApi.orders.list()).toEqual([{ id: '1' }])

    vi.stubGlobal('fetch', fetchOk({ id: '1' }))
    expect(await liveApi.orders.get('1')).toEqual({ id: '1' })

    vi.stubGlobal('fetch', fetchOk({ order: { reference: 'ORD-1' } }))
    expect((await liveApi.orders.getStatus('ORD-1')).reference).toBe('ORD-1')

    vi.stubGlobal('fetch', fetchOk({ transaction_key: 'txn-1' }))
    expect((await liveApi.orders.getStatusByTransaction('txn-1')).transaction_key).toBe('txn-1')
  })

  it('hits the real endpoint for customerOrders.list/get and storePaymentMethods.list', async () => {
    const liveApi = await loadLiveApi()
    vi.stubGlobal('fetch', fetchOk({ orders: { data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 } }))
    expect((await liveApi.customerOrders.list('tok', { page: 2, per_page: 5 })).total).toBe(0)

    vi.stubGlobal('fetch', fetchOk({ order: { reference: 'ORD-1' } }))
    expect((await liveApi.customerOrders.get('tok', 'ORD-1')).reference).toBe('ORD-1')

    vi.stubGlobal('fetch', fetchOk({ payment_methods: [{ id: 1 }] }))
    expect(await liveApi.storePaymentMethods.list('tok')).toEqual([{ id: 1 }])
  })

  it('hits the real endpoint for every customerSubscriptions action', async () => {
    const liveApi = await loadLiveApi()

    vi.stubGlobal('fetch', fetchOk({ subscriptions: [{ id: 1 }] }))
    expect(await liveApi.customerSubscriptions.list('tok')).toEqual([{ id: 1 }])

    vi.stubGlobal('fetch', fetchOk({ subscription: { id: 1 } }))
    expect((await liveApi.customerSubscriptions.get('tok', 1)).id).toBe(1)

    vi.stubGlobal('fetch', fetchOk({ subscription: { id: 1, skip_count: 2 } }))
    expect((await liveApi.customerSubscriptions.skip('tok', 1, 2)).skip_count).toBe(2)

    vi.stubGlobal('fetch', fetchOk({ subscription: { id: 1 } }))
    await liveApi.customerSubscriptions.unskip('tok', 1, 1)
    await liveApi.customerSubscriptions.unskip('tok', 1) // no `times` — covers the ternary's other branch

    vi.stubGlobal('fetch', fetchOk({ subscription: { id: 1, status: { name: 'paused' } } }))
    expect((await liveApi.customerSubscriptions.pause('tok', 1)).status.name).toBe('paused')

    vi.stubGlobal('fetch', fetchOk({ subscription: { id: 1, status: { name: 'active' } } }))
    expect((await liveApi.customerSubscriptions.resume('tok', 1)).status.name).toBe('active')

    vi.stubGlobal('fetch', fetchOk({ subscription: { id: 1, status: { name: 'cancelled' } } }))
    await liveApi.customerSubscriptions.cancel('tok', 1, 'reason given')
    await liveApi.customerSubscriptions.cancel('tok', 1) // no reason — covers the ?? branch

    vi.stubGlobal('fetch', fetchOk({ products: [] }))
    expect(await liveApi.customerSubscriptions.swapOptions('tok', 1)).toEqual({ products: [] })

    vi.stubGlobal('fetch', fetchOk({ subscription: { id: 1 } }))
    await liveApi.customerSubscriptions.swap('tok', 1, 5, 6) // productId + variantId
    await liveApi.customerSubscriptions.swap('tok', 1, null) // neither present

    vi.stubGlobal('fetch', fetchOk({ payment_url: null, transaction_key: null }))
    expect(await liveApi.customerSubscriptions.updatePaymentMethod('tok', 1, 2, 3, 'https://return')).toEqual({ payment_url: null, transaction_key: null })

    vi.stubGlobal('fetch', fetchOk({ shipping_methods: [{ id: 1 }] }))
    expect(await liveApi.customerSubscriptions.shippingMethods('tok', 1, { country_code: 'NL' })).toEqual([{ id: 1 }])
    vi.stubGlobal('fetch', fetchOk({})) // no shipping_methods key — covers the ?? [] fallback
    expect(await liveApi.customerSubscriptions.shippingMethods('tok', 1, { country_code: 'NL' })).toEqual([])

    vi.stubGlobal('fetch', fetchOk({ subscription: { id: 1 } }))
    await liveApi.customerSubscriptions.updateShipping('tok', 1, { shipping_method_id: 1, shipping_address: {} as never })
  })
})
