import { reactive } from 'vue'
import type { SubscriptionBox, Order, CheckoutForm, CartItem } from '@/types'
import type { ConciarProduct, ConciarPaginated, ConciarResponse, ConciarPaymentMethod, ConciarShippingMethod, ConciarCartShippingMethod, ConciarCartPaymentMethod, ConciarPickupLocation, ConciarDeliveryOption, ConciarDiscount, ConciarCartSyncRequest, ConciarCartData, ConciarCartInitData, ConciarCartGetResponse, OtpIdentifierType, OtpVerifyResponse, ConciarCountry, ConciarStoreConfig, ConciarConnectProduct, ConciarConnectProductsData, ConciarFilter, ConciarProductListParams, ConciarOrderCreateParams, ConciarCreatedOrder, ConciarOrderCreateResponse, ConciarCheckoutCheckResponse, ConciarOrderStatus, ConciarPaymentStatus, ConciarCustomerOrdersData, ConciarCustomerOrderDetail, ConciarCustomerSubscription, ConciarCustomerPaymentMethod, ConciarMandatePaymentMethod, ConciarSwapOptions } from './conciar-types'
import { mockSubscriptions, mockOrders, mockProducts } from './mock'

const useMock = !import.meta.env.VITE_CONCIAR_API_URL

// Set by the request() function when any store/* endpoint returns HTTP 503.
// App.vue watches this to show the maintenance screen.
export const maintenanceState = reactive({ active: false, message: '' })

const mockStoreConfig: ConciarStoreConfig = {
  general: {
    store_name: 'Cellier',
    store_type: 'general',
    store_size: 100,
    online_store: true,
    extended_holiday_hours: false,
  },
  checkout: {
    guestCheckout: true,
    requirePhone: false,
    requireShipping: true,
    termsUrl: null,
    privacyUrl: null,
    confirmationEmailEnabled: true,
    orderPrefix: 'ORD-',
  },
  seo: {
    metaTitle: null,
    metaDescription: null,
    ogImage: null,
    googleAnalyticsId: null,
    facebookPixelId: null,
  },
  operating_hours: {
    weekdays: { enabled: true, open: '09:00', close: '21:00' },
    saturday: { enabled: true, open: '10:00', close: '22:00' },
    sunday:   { enabled: true, open: '11:00', close: '20:00' },
  },
  supported_countries: ['NL', 'DE', 'BE', 'US', 'GB'],
  allowSubscriptionProductSwap: false,
  subscriptionSwapVariantsOnly: false,
  couponsStackable: false,
}

const mockCountries: ConciarCountry[] = [
  { id: 146, name: 'netherlands',    iso_code_2: 'NL', iso_code_3: 'NLD', call_prefix: 31,  zipcode_format: '^\\d{4}\\s?[A-Z]{2}$', address_format: '{street} {house_number} {apartment}\n{zipcode} {city}\n{country}',                      has_state: false, has_zipcode: true,  phone_format: '06 12345678',     phone_digits: 9,  date_format: 'DD/MM/YYYY', icon: 'netherlands.svg',    active: true  },
  { id: 20,  name: 'belgium',        iso_code_2: 'BE', iso_code_3: 'BEL', call_prefix: 32,  zipcode_format: '^\\d{4}$',             address_format: '{street} {house_number} {apartment}\n{zipcode} {city}\n{country}',                      has_state: false, has_zipcode: true,  phone_format: '0470 12 34 56',   phone_digits: 9,  date_format: 'DD/MM/YYYY', icon: 'belgium.svg',        active: false },
  { id: 75,  name: 'germany',        iso_code_2: 'DE', iso_code_3: 'DEU', call_prefix: 49,  zipcode_format: '^\\d{5}$',             address_format: '{street} {house_number} {apartment}\n{zipcode} {city}\n{country}',                      has_state: true,  has_zipcode: true,  phone_format: '0151 12345678',   phone_digits: 10, date_format: 'DD.MM.YYYY', icon: 'germany.svg',        active: false },
  { id: 70,  name: 'france',         iso_code_2: 'FR', iso_code_3: 'FRA', call_prefix: 33,  zipcode_format: '^\\d{5}$',             address_format: '{house_number} {street} {apartment}\n{zipcode} {city}\n{country}',                      has_state: false, has_zipcode: true,  phone_format: '06 12 34 56 78',  phone_digits: 9,  date_format: 'DD/MM/YYYY', icon: 'france.svg',         active: false },
  { id: 218, name: 'united_kingdom', iso_code_2: 'GB', iso_code_3: 'GBR', call_prefix: 44,  zipcode_format: null,                   address_format: '{house_number} {street} {apartment}\n{city}\n{state}\n{zipcode}\n{country}',              has_state: true,  has_zipcode: true,  phone_format: '07700 900000',    phone_digits: 10, date_format: 'DD/MM/YYYY', icon: 'united-kingdom.svg', active: false },
  { id: 96,  name: 'ireland',        iso_code_2: 'IE', iso_code_3: 'IRL', call_prefix: 353, zipcode_format: null,                   address_format: '{street} {house_number} {apartment}\n{city}\n{state}\n{zipcode}\n{country}',              has_state: true,  has_zipcode: true,  phone_format: '085 123 4567',    phone_digits: 9,  date_format: 'DD/MM/YYYY', icon: 'ireland.svg',        active: false },
  { id: 193, name: 'spain',          iso_code_2: 'ES', iso_code_3: 'ESP', call_prefix: 34,  zipcode_format: '^\\d{5}$',             address_format: '{street} {house_number} {apartment}\n{zipcode} {city} {state}\n{country}',               has_state: true,  has_zipcode: true,  phone_format: '612 34 56 78',    phone_digits: 9,  date_format: 'DD/MM/YYYY', icon: 'spain.svg',          active: false },
  { id: 99,  name: 'italy',          iso_code_2: 'IT', iso_code_3: 'ITA', call_prefix: 39,  zipcode_format: '^\\d{5}$',             address_format: '{street} {house_number} {apartment}\n{zipcode} {city} {state}\n{country}',               has_state: true,  has_zipcode: true,  phone_format: '312 345 6789',    phone_digits: 10, date_format: 'DD/MM/YYYY', icon: 'italy.svg',          active: false },
  { id: 167, name: 'portugal',       iso_code_2: 'PT', iso_code_3: 'PRT', call_prefix: 351, zipcode_format: '^\\d{4}-\\d{3}$',      address_format: '{street} {house_number} {apartment}\n{zipcode} {city}\n{country}',                      has_state: false, has_zipcode: true,  phone_format: '912 345 678',     phone_digits: 9,  date_format: 'DD/MM/YYYY', icon: 'portugal.svg',       active: false },
  { id: 219, name: 'united_states',  iso_code_2: 'US', iso_code_3: 'USA', call_prefix: 1,   zipcode_format: '^\\d{5}(-\\d{4})?$',   address_format: '{house_number} {street} {apartment}\n{city}, {state} {zipcode}\n{country}',              has_state: true,  has_zipcode: true,  phone_format: '(555) 555-5555',  phone_digits: 10, date_format: 'MM/DD/YYYY', icon: 'united-states.svg',  active: false },
  { id: 36,  name: 'canada',         iso_code_2: 'CA', iso_code_3: 'CAN', call_prefix: 1,   zipcode_format: null,                   address_format: '{house_number} {street} {apartment}\n{city} {state} {zipcode}\n{country}',               has_state: true,  has_zipcode: true,  phone_format: '(555) 555-5555',  phone_digits: 10, date_format: 'DD/MM/YYYY', icon: 'canada.svg',         active: false },
  { id: 12,  name: 'australia',      iso_code_2: 'AU', iso_code_3: 'AUS', call_prefix: 61,  zipcode_format: '^\\d{4}$',             address_format: '{house_number} {street} {apartment}\n{city} {state} {zipcode}\n{country}',               has_state: true,  has_zipcode: true,  phone_format: '0412 345 678',    phone_digits: 9,  date_format: 'DD/MM/YYYY', icon: 'australia.svg',      active: false },
  { id: 101, name: 'japan',          iso_code_2: 'JP', iso_code_3: 'JPN', call_prefix: 81,  zipcode_format: '^\\d{3}-\\d{4}$',      address_format: '{zipcode}\n{state}{city}{street}{house_number} {apartment}\n{country}',                  has_state: true,  has_zipcode: true,  phone_format: '090-1234-5678',   phone_digits: 10, date_format: 'YYYY/MM/DD', icon: 'japan.svg',          active: false },
]

async function request<T>(path: string, options: RequestInit = {}, authToken?: string): Promise<T> {
  const token = authToken ?? sessionStorage.getItem('cellier_token')
  const locale = localStorage.getItem('locale') ?? 'nl'

  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': locale,
      'X-Language': locale,
      'X-Currency': 'EUR',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (res.status === 503) {
    try {
      const body = await res.json()
      if (body.maintenance) {
        maintenanceState.active = true
        maintenanceState.message = body.message ?? ''
      }
    } catch {}
    throw new Error('store_maintenance')
  }
  if (!res.ok) {
    let body: unknown = null
    try { body = await res.json() } catch { /* non-JSON body */ }
    const err = new Error(`Conciar API ${res.status}: ${path}`) as Error & { status: number; body: unknown }
    err.status = res.status
    err.body = body
    throw err
  }
  return res.json() as Promise<T>
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapBillingCycle(unit: string): 'monthly' | 'quarterly' {
  if (unit === 'quarterly') return 'quarterly'
  return 'monthly' // four_weekly, monthly, weekly all treated as monthly
}

function mapProduct(p: ConciarProduct): SubscriptionBox {
  const name = (p.resolved_info ?? p.default_info).name
  const bottleMatch = name.match(/\d+/)
  const activeVariant = p.variants?.find(v => v.active)
  const price = activeVariant?.converted_retail_price?.amount
    ?? (activeVariant?.retail_price ? parseFloat(activeVariant.retail_price.amount) : null)
    ?? p.converted_retail_price?.amount
    ?? (p.retail_price ? parseFloat(p.retail_price.amount) : 0)

  return {
    id: String(p.id),
    variantId: activeVariant ? String(activeVariant.id) : undefined,
    isSubscription: p.is_subscription,
    name,
    tagline: '',
    description: (p.resolved_info ?? p.default_info).description ?? '',
    bottles: bottleMatch ? parseInt(bottleMatch[0]) : 0,
    price,
    frequency: p.subscription_detail
      ? mapBillingCycle(p.subscription_detail.billing_cycle_unit)
      : 'monthly',
    minimumCommitmentCycles: p.subscription_detail?.minimum_commitment_cycles ?? null,
    renewCommitmentOnCycle: p.subscription_detail?.renew_commitment_on_cycle ?? null,
    image: '',
    highlights: [],
    popular: false,
  }
}

// ─── Connect v1 mock data & helpers ──────────────────────────────────────────

const mockConnectProducts: ConciarConnectProduct[] = mockProducts.map((prod, i) => ({
  id: i + 1,
  sku: null,
  ean_13: null,
  active: true,
  out_of_stock: false,
  is_subscription: false,
  subscription_detail: null,
  resolved_info: { name: prod.name, description: '' },
  converted_retail_price: {
    amount: prod.price,
    display_price: `€ ${prod.price.toFixed(2).replace('.', ',')}`,
    currency: { symbol: 'EUR', symbol_icon: '€' },
  },
  type: { name: 'physical' },
  files: prod.image ? [{ url: prod.image, type: { name: 'image' } }] : [],
  properties: {},
}))

function buildMockFilters(_products: ConciarConnectProduct[]): ConciarFilter[] {
  return []
}

function applyMockFilters(
  products: ConciarConnectProduct[],
  params: ConciarProductListParams,
): ConciarConnectProduct[] {
  let list = products.filter(p => p.active)
  if (params.q) {
    const q = params.q.toLowerCase()
    list = list.filter(p => p.resolved_info?.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
  }
  if (params.price_min !== undefined) list = list.filter(p => (p.converted_retail_price?.amount ?? 0) >= params.price_min!)
  if (params.price_max !== undefined) list = list.filter(p => (p.converted_retail_price?.amount ?? 0) <= params.price_max!)
  if (params.subscription !== undefined) list = list.filter(p => p.is_subscription === params.subscription)
  return list
}

function buildConnectParams(params: ConciarProductListParams): URLSearchParams {
  const qs = new URLSearchParams()
  if (params.q)         qs.set('q', params.q)
  if (params.type)      qs.set('type', params.type)
  if (params.category)  qs.set('category', String(params.category))
  if (params.price_min !== undefined) qs.set('price_min', String(params.price_min))
  if (params.price_max !== undefined) qs.set('price_max', String(params.price_max))
  if (params.per_page)  qs.set('per_page', String(params.per_page))
  if (params.page && params.page > 1) qs.set('page', String(params.page))
  if (params.subscription !== undefined) qs.set('subscription', params.subscription ? '1' : '0')
  if (params.properties) {
    for (const [key, val] of Object.entries(params.properties)) {
      const values = Array.isArray(val) ? val : [val]
      for (const v of values) qs.append(`property[${key}]`, v)
    }
  }
  return qs
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const conciarApi = {
  storeConfig: {
    async get(): Promise<ConciarStoreConfig> {
      if (useMock) return mockStoreConfig
      const res = await request<{ config: ConciarStoreConfig }>('/store/config')
      return res.config
    },
  },

  countries: {
    async list(): Promise<ConciarCountry[]> {
      if (useMock) return mockCountries
      const res = await request<{ countries: ConciarCountry[] }>('/countries')
      return res.countries
    },
  },

  products: {
    async list(params?: { type?: string; featured?: boolean; subscription?: boolean }): Promise<SubscriptionBox[]> {
      if (useMock) return mockSubscriptions

      const qs = new URLSearchParams()
      if (params?.type) qs.set('type', params.type)
      if (params?.featured) qs.set('featured', '1')
      if (params?.subscription !== undefined) qs.set('subscription', params.subscription ? '1' : '0')

      const res = await request<ConciarResponse<ConciarPaginated<ConciarProduct>>>(
        `/store/products${qs.size ? `?${qs}` : ''}`,
      )
      return res.data.data.filter(p => p.active).map(mapProduct)
    },

    async get(id: string): Promise<SubscriptionBox> {
      if (useMock) {
        const box = mockSubscriptions.find(s => s.id === id)
        if (!box) return Promise.reject(new Error('Not found'))
        return box
      }
      const res = await request<ConciarResponse<ConciarProduct>>(`/store/products/${id}`)
      return mapProduct(res.data)
    },

    async getDetail(id: string): Promise<ConciarProduct> {
      if (useMock) {
        const mock = mockConnectProducts.find(p => String(p.id) === id)
        if (!mock) return Promise.reject(new Error('Not found'))
        return {
          id: mock.id,
          organization_id: 1,
          type_id: 1,
          tax_rule_id: null,
          sku: mock.sku,
          out_of_stock: mock.out_of_stock,
          active: mock.active,
          is_physical: true,
          is_digital: false,
          is_one_time_purchase: !mock.properties,
          is_subscription: false,
          created_at: '',
          updated_at: '',
          retail_price: null,
          // mock (Connect) price carries a narrower currency shape than the detail type
          converted_retail_price: mock.converted_retail_price as ConciarProduct['converted_retail_price'],
          resolved_info: mock.resolved_info ? { id: mock.id, product_id: mock.id, language_id: 1, name: mock.resolved_info.name, description: mock.resolved_info.description, created_at: '', updated_at: '' } : null,
          default_info: { id: mock.id, product_id: mock.id, language_id: 1, name: mock.resolved_info?.name ?? '', description: mock.resolved_info?.description ?? null, created_at: '', updated_at: '' },
          type: { id: 1, name: 'physical', created_at: '', updated_at: '' },
          subscription_detail: null,
          variants: [],
          property_values: [],
          files: mock.files,
        }
      }
      const res = await request<ConciarResponse<ConciarProduct>>(`/store/products/${id}`)
      return res.data
    },
  },

  paymentMethods: {
    async list(): Promise<ConciarPaymentMethod[]> {
      if (useMock) return []
      const res = await request<ConciarResponse<ConciarPaymentMethod[]>>('/payment-methods')
      return res.data
    },
  },

  auth: {
    async requestOtp(identifier: string, type: OtpIdentifierType): Promise<void> {
      await request<{ expires_in: string }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ identifier, type }),
      })
    },
    async verifyOtp(identifier: string, type: OtpIdentifierType, code: string): Promise<OtpVerifyResponse> {
      return request<OtpVerifyResponse>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ identifier, type, code }),
      })
    },
    async resendOtp(identifier: string, type: OtpIdentifierType): Promise<void> {
      await request<void>('/auth/otp/resend', {
        method: 'POST',
        body: JSON.stringify({ identifier, type }),
      })
    },
  },

  cart: {
    async init(): Promise<ConciarCartInitData> {
      const res = await request<ConciarResponse<ConciarCartInitData>>('/store/cart/init', {
        method: 'POST',
      })
      return res.data
    },
    async sync(body: ConciarCartSyncRequest): Promise<ConciarCartData> {
      // Sync responds with { cart: ... } (like GET), not { data: ... }
      const res = await request<ConciarCartGetResponse>('/store/cart/sync', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return res.cart
    },
    async get(cartToken: string): Promise<ConciarCartData> {
      // GET /store/cart/{token} returns { cart: ... } not { data: ... }
      const res = await request<ConciarCartGetResponse>(`/store/cart/${cartToken}`)
      return res.cart
    },

    async shippingMethods(
      cartToken: string,
      body: { country_code: string; postal_code?: string; city?: string; province?: string },
      signal?: AbortSignal,
    ): Promise<ConciarCartShippingMethod[]> {
      if (useMock) return []
      const res = await request<{ shipping_methods: ConciarCartShippingMethod[] }>(
        `/store/cart/${cartToken}/shipping-methods`,
        { method: 'POST', body: JSON.stringify(body), signal },
      )
      return res.shipping_methods
    },

    async paymentMethods(
      cartToken: string,
      body: { shipping_method_id: number; country_id: number },
    ): Promise<ConciarCartPaymentMethod[]> {
      if (useMock) return []
      const res = await request<{ payment_methods: ConciarCartPaymentMethod[] }>(
        `/store/cart/${cartToken}/payment-methods`,
        { method: 'POST', body: JSON.stringify(body) },
      )
      return res.payment_methods
    },

    async checkoutCheck(cartToken: string): Promise<ConciarCheckoutCheckResponse> {
      if (useMock) return { can_proceed: true, issues: [], has_changes: false, warnings: [] }
      return request<ConciarCheckoutCheckResponse>(`/store/cart/${cartToken}/checkout-check`)
    },
  },

  // Carrier (PostNL) lookups — return 404 when the carrier isn't enabled;
  // callers degrade gracefully (don't show the picker).
  shipping: {
    async locations(params: { country_code: string; postal_code: string }): Promise<ConciarPickupLocation[]> {
      if (useMock) return []
      const qs = new URLSearchParams({ country_code: params.country_code, postal_code: params.postal_code })
      const res = await request<{ locations: ConciarPickupLocation[] }>(`/store/shipping/locations?${qs}`)
      return res.locations
    },
    async deliveryOptions(params: { country_code: string; postal_code: string; house_number: string }): Promise<ConciarDeliveryOption[]> {
      if (useMock) return []
      const qs = new URLSearchParams({
        country_code: params.country_code,
        postal_code: params.postal_code,
        house_number: params.house_number,
      })
      const res = await request<{ delivery_options: ConciarDeliveryOption[] }>(`/store/shipping/delivery-options?${qs}`)
      return res.delivery_options
    },
  },

  discounts: {
    async apply(code: string): Promise<ConciarDiscount> {
      const res = await request<ConciarResponse<ConciarDiscount>>('/discount-codes/validate', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      return res.data
    },
  },

  shippingMethods: {
    async list(): Promise<ConciarShippingMethod[]> {
      if (useMock) return []
      const res = await request<ConciarResponse<ConciarShippingMethod[]>>('/shipping-methods')
      return res.data
    },
  },

  orders: {
    list(): Promise<Order[]> {
      if (useMock) return Promise.resolve(mockOrders)
      return request<Order[]>('/connect/v1/orders')
    },

    get(id: string): Promise<Order> {
      if (useMock) {
        const order = mockOrders.find((o) => o.id === id)
        if (!order) return Promise.reject(new Error('Not found'))
        return Promise.resolve(order)
      }
      return request<Order>(`/connect/v1/orders/${id}`)
    },

    async getStatus(reference: string): Promise<ConciarOrderStatus> {
      if (useMock) {
        return { reference, status: { name: 'paid' }, payment_status: { name: 'paid' }, total: null, currency: null }
      }
      const res = await request<{ order: ConciarOrderStatus }>(`/store/orders/${reference}`)
      return res.order
    },

    async getStatusByTransaction(transactionKey: string): Promise<ConciarPaymentStatus> {
      if (useMock) {
        return { transaction_key: transactionKey, status: 'paid', is_paid: true, is_pending: false, is_failed: false, amount: 0, order_reference: '' }
      }
      return request<ConciarPaymentStatus>(`/store/payment/${transactionKey}/status`)
    },

    async create(params: ConciarOrderCreateParams): Promise<ConciarOrderCreateResponse> {
      if (useMock) {
        return {
          order: {
            id: Date.now(),
            reference: `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            status: { name: 'pending' },
            currency: { symbol: 'EUR', symbol_icon: '€' },
            customer_notes: params.customerNotes ?? null,
            lines: [],
            prices: [
              { type: { name: 'subtotal' },    amount: '0.00' },
              { type: { name: 'total_price' }, amount: '0.00' },
            ],
          },
          payment_url: null,
          transaction_key: null,
        }
      }
      return request<ConciarOrderCreateResponse>(
        '/store/orders',
        {
          method: 'POST',
          body: JSON.stringify({
            cart_token: params.cartToken,
            shipping_method_id: params.shippingMethodId,
            payment_method_key: params.paymentMethodKey,
          payment_service_provider_key: params.paymentServiceProviderKey,
          return_url: params.returnUrl,
          shipping_address: params.shippingAddress,
          ...(params.billingAddress && { billing_address: params.billingAddress }),
          ...(params.customer && { customer: params.customer }),
          ...(params.pickupLocationCode && { pickup_location_code: params.pickupLocationCode }),
          customer_notes: params.customerNotes ?? null,
          internal_notes: null,
          // Method-specific extras — only include when present
          ...(params.cardToken         && { card_token: params.cardToken }),
          ...(params.paymentData       && { payment_data: params.paymentData }),
          ...(params.applePayToken     && { apple_pay_token: params.applePayToken }),
          ...(params.applePayPaymentData && { apple_pay_payment_data: params.applePayPaymentData }),
          }),
        },
        params.accessToken,   // forwards the customer OTP Bearer token when logged in
      )
    },
  },

  customerSubscriptions: {
    async list(accessToken: string): Promise<ConciarCustomerSubscription[]> {
      if (useMock) return []
      const res = await request<{ subscriptions: ConciarCustomerSubscription[] }>(
        '/store/customer/subscriptions', {}, accessToken,
      )
      return res.subscriptions
    },

    async get(accessToken: string, id: number): Promise<ConciarCustomerSubscription> {
      if (useMock) throw new Error('Not found')
      const res = await request<{ subscription: ConciarCustomerSubscription }>(
        `/store/customer/subscriptions/${id}`, {}, accessToken,
      )
      return res.subscription
    },

    async skip(accessToken: string, id: number, times: number): Promise<ConciarCustomerSubscription> {
      if (useMock) throw new Error('Not found')
      const res = await request<{ subscription: ConciarCustomerSubscription }>(
        `/store/customer/subscriptions/${id}/skip`,
        { method: 'POST', body: JSON.stringify({ times }) },
        accessToken,
      )
      return res.subscription
    },

    async unskip(accessToken: string, id: number, times?: number): Promise<ConciarCustomerSubscription> {
      if (useMock) throw new Error('Not found')
      const res = await request<{ subscription: ConciarCustomerSubscription }>(
        `/store/customer/subscriptions/${id}/unskip`,
        { method: 'POST', body: JSON.stringify(times !== undefined ? { times } : {}) },
        accessToken,
      )
      return res.subscription
    },

    async pause(accessToken: string, id: number): Promise<ConciarCustomerSubscription> {
      if (useMock) throw new Error('Not found')
      const res = await request<{ subscription: ConciarCustomerSubscription }>(
        `/store/customer/subscriptions/${id}/pause`,
        { method: 'POST' },
        accessToken,
      )
      return res.subscription
    },

    async resume(accessToken: string, id: number): Promise<ConciarCustomerSubscription> {
      if (useMock) throw new Error('Not found')
      const res = await request<{ subscription: ConciarCustomerSubscription }>(
        `/store/customer/subscriptions/${id}/resume`,
        { method: 'POST' },
        accessToken,
      )
      return res.subscription
    },

    async cancel(accessToken: string, id: number, reason?: string): Promise<ConciarCustomerSubscription> {
      if (useMock) throw new Error('Not found')
      const res = await request<{ subscription: ConciarCustomerSubscription }>(
        `/store/customer/subscriptions/${id}/cancel`,
        { method: 'POST', body: JSON.stringify({ cancellation_reason: reason ?? null }) },
        accessToken,
      )
      return res.subscription
    },

    async swapOptions(accessToken: string, id: number): Promise<ConciarSwapOptions> {
      if (useMock) return { products: [] }
      return request<ConciarSwapOptions>(
        `/store/customer/subscriptions/${id}/swap-options`, {}, accessToken,
      )
    },

    async swap(accessToken: string, id: number, productId: number | null, variantId?: number): Promise<ConciarCustomerSubscription> {
      if (useMock) throw new Error('Not found')
      const body: Record<string, number> = {}
      if (productId != null) body.product_id = productId
      if (variantId != null) body.product_variant_id = variantId
      const res = await request<{ subscription: ConciarCustomerSubscription }>(
        `/store/customer/subscriptions/${id}/swap`,
        { method: 'POST', body: JSON.stringify(body) },
        accessToken,
      )
      return res.subscription
    },

    async updatePaymentMethod(
      accessToken: string,
      id: number,
      paymentServiceProviderId: number,
      paymentMethodId: number,
      returnUrl: string,
    ): Promise<{ payment_url: string | null; transaction_key: string | null }> {
      if (useMock) return { payment_url: null, transaction_key: null }
      return request<{ payment_url: string | null; transaction_key: string | null }>(
        `/store/customer/subscriptions/${id}/payment-method`,
        {
          method: 'POST',
          body: JSON.stringify({
            payment_service_provider_id: paymentServiceProviderId,
            payment_method_id: paymentMethodId,
            return_url: returnUrl,
          }),
        },
        accessToken,
      )
    },
  },

  storePaymentMethods: {
    async list(accessToken: string): Promise<ConciarMandatePaymentMethod[]> {
      if (useMock) return []
      const res = await request<{ payment_methods: ConciarMandatePaymentMethod[] }>(
        '/store/payment-methods?recurring=1', {}, accessToken,
      )
      return res.payment_methods
    },
  },

  customerOrders: {
    async list(accessToken: string, params?: { page?: number; per_page?: number }): Promise<ConciarCustomerOrdersData> {
      if (useMock) return { data: [], current_page: 1, last_page: 1, per_page: 10, total: 0 }
      const qs = new URLSearchParams()
      if (params?.page && params.page > 1) qs.set('page', String(params.page))
      if (params?.per_page) qs.set('per_page', String(params.per_page))
      const res = await request<{ orders: ConciarCustomerOrdersData }>(
        `/store/customer/orders${qs.size ? `?${qs}` : ''}`,
        {},
        accessToken,
      )
      return res.orders
    },

    async get(accessToken: string, reference: string): Promise<ConciarCustomerOrderDetail> {
      if (useMock) throw new Error('Not found')
      const res = await request<{ order: ConciarCustomerOrderDetail }>(
        `/store/customer/orders/${reference}`,
        {},
        accessToken,
      )
      return res.order
    },
  },

  connect: {
    products: {
      async list(params: ConciarProductListParams = {}): Promise<ConciarConnectProductsData> {
        if (useMock) {
          const filtered = applyMockFilters(mockConnectProducts, params)
          const perPage = params.per_page ?? 20
          const page = params.page ?? 1
          const start = (page - 1) * perPage
          return {
            data: filtered.slice(start, start + perPage),
            current_page: page,
            last_page: Math.max(1, Math.ceil(filtered.length / perPage)),
            per_page: perPage,
            total: filtered.length,
          }
        }
        const qs = buildConnectParams(params)
        const res = await request<{ data: ConciarConnectProductsData }>(
          `/store/products${qs.size ? `?${qs}` : ''}`,
        )
        return res.data
      },

      async filters(params: ConciarProductListParams = {}): Promise<ConciarFilter[]> {
        if (useMock) {
          const filtered = applyMockFilters(mockConnectProducts, params)
          return buildMockFilters(filtered)
        }
        const qs = buildConnectParams(params)
        const res = await request<{ filters: ConciarFilter[] }>(
          `/store/products/filters${qs.size ? `?${qs}` : ''}`,
        )
        return res.filters
      },
    },
  },
}
