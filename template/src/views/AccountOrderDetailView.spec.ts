import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import AccountOrderDetailView from './AccountOrderDetailView.vue'
import { useCustomerStore } from '@/stores/customer'
import { conciarApi } from '@/api/conciar'
import type { ConciarCustomerOrderDetail } from '@/api/conciar-types'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: { template: '<div/>' } },
      { path: '/account/orders', name: 'orders', component: { template: '<div/>' } },
      { path: '/account/orders/:reference', component: AccountOrderDetailView },
    ],
  })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  useCustomerStore().accessToken = 'tok'
})

const baseOrder = (over: Partial<ConciarCustomerOrderDetail> = {}): ConciarCustomerOrderDetail => ({
  reference: 'ORD-1',
  created_at: '2026-01-15T10:00:00Z',
  status: { name: 'paid' },
  customer_notes: null,
  lines: [
    { id: 1, name: 'Product A', qty: 2, type: { name: 'product' }, prices: [{ display_price: '€ 20,00' }] },
    { id: 2, name: 'Shipping', qty: 1, type: { name: 'shipping' }, prices: [{ amount: '0.00', display_price: '€ 0,00' }] },
  ] as never,
  prices: [{ display_price: '€ 20,00' }, { display_price: '€ 20,00' }] as never,
  address: null,
  billing_address: null,
  invoice: null,
  credit_notes: [],
  ...over,
} as never)

async function mountAt(reference = 'ORD-1') {
  const router = testRouter()
  await router.push(`/account/orders/${reference}`)
  return { wrapper: mountWithPlugins(AccountOrderDetailView, { global: { plugins: [router] } }), router }
}

describe('AccountOrderDetailView', () => {
  it('shows a loading skeleton, then the order detail', async () => {
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(baseOrder())
    const { wrapper } = await mountAt()
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
    await vi.waitFor(() => expect(wrapper.text()).toContain('ORD-1'))
    expect(wrapper.text()).toContain('Product A')
    expect(wrapper.text()).toContain('Gratis') // free shipping line
  })

  it('shows a non-free shipping amount when present', async () => {
    const order = baseOrder()
    ;(order.lines as never as { prices: { amount: string; display_price: string }[] }[])[1].prices[0] = { amount: '5.00', display_price: '€ 5,00' }
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(order)
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('€ 5,00'))
  })

  it('shows customer notes when present', async () => {
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(baseOrder({ customer_notes: 'Leave at the door' }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Leave at the door'))
  })

  it('shows the shipping address, and a separate billing address only when it differs', async () => {
    const order = baseOrder({
      address: { street: 'Main', house_number: '1', apartment: null, zipcode: '1000AA', city: 'Town', state: null, country: { name: 'netherlands' } } as never,
      billing_address: { street: 'Main', house_number: '1', apartment: null, zipcode: '1000AA', city: 'Town', state: null, country: { name: 'netherlands' } } as never,
    })
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(order)
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Bezorgadres'))
    expect(wrapper.text()).not.toContain('Factuuradres') // same as shipping

    vi.restoreAllMocks()
    useCustomerStore().accessToken = 'tok'
    const order2 = baseOrder({
      address: { street: 'Main', house_number: '1', apartment: '2B', zipcode: '1000AA', city: 'Town', state: 'NH', country: { name: 'netherlands' } } as never,
      billing_address: { street: 'Other', house_number: '9', apartment: null, zipcode: '2000BB', city: 'Elsewhere', state: null, country: { name: 'belgium' } } as never,
    })
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(order2)
    const { wrapper: wrapper2 } = await mountAt()
    await vi.waitFor(() => expect(wrapper2.text()).toContain('Factuuradres'))
    expect(wrapper2.text()).toContain('Netherlands')
    expect(wrapper2.text()).toContain('Belgium')
  })

  it('shows the payment transaction with logo, status and paid-at date', async () => {
    const order = baseOrder({
      invoice: {
        transactions: [{
          payment_method: { name: 'iDEAL', logo: 'https://example.com/ideal.png' },
          status: { name: 'paid', color: '#0a0' },
          amount: '20.00',
          paid_at: '2026-01-15T10:05:00Z',
        }],
      } as never,
    })
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(order)
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))
    expect(wrapper.text()).toContain('€ 20,00')
    expect(wrapper.find('img[alt="iDEAL"]').exists()).toBe(true)
  })

  it('shows credit notes (refunds) with their line totals', async () => {
    const order = baseOrder({
      credit_notes: [{
        id: 1,
        reference: 'CN-1',
        created_at: '2026-01-20T00:00:00Z',
        lines: [{ id: 1, name: 'Product A', quantity: 1, prices: [{ type: { name: 'total_price' }, amount: '10.00', display_price: '€ 10,00' }] }],
      }] as never,
    })
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(order)
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Terugbetaald'))
    expect(wrapper.text()).toContain('CN-1')
    expect(wrapper.text()).toContain('€ 10,00')
  })

  it('shows a not-found error for a non-401 failure', async () => {
    vi.spyOn(conciarApi.customerOrders, 'get').mockRejectedValue(new Error('boom'))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Bestelling niet gevonden'))
  })

  it('logs out and redirects to /login on a 401', async () => {
    vi.spyOn(conciarApi.customerOrders, 'get').mockRejectedValue(Object.assign(new Error('unauth'), { status: 401 }))
    const { router } = await mountAt()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    expect(useCustomerStore().isLoggedIn).toBe(false)
  })

  it('applies a status color style when the order status carries one', async () => {
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(baseOrder({ status: { name: 'paid', color: '#00aa00' } } as never))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('ORD-1'))
    const badge = wrapper.findAll('span').find(s => s.text() === 'paid')!
    expect(badge.attributes('style')).toContain('color')
  })

  it('falls back to "–" for a product line with no price', async () => {
    const order = baseOrder()
    ;(order.lines as never as { prices: unknown[] }[])[0].prices = []
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(order)
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
    expect(wrapper.text()).toContain('–')
  })

  it('shows apartment and state on both shipping and billing addresses when present', async () => {
    const order = baseOrder({
      address: { street: 'Main', house_number: '1', apartment: '3C', zipcode: '1000AA', city: 'Town', state: 'NH', country: { name: 'netherlands' } } as never,
      billing_address: { street: 'Other', house_number: '9', apartment: '4D', zipcode: '2000BB', city: 'Elsewhere', state: 'ZH', country: null } as never,
    })
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(order)
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('3C'))
    expect(wrapper.text()).toContain('NH')
    expect(wrapper.text()).toContain('4D')
    expect(wrapper.text()).toContain('ZH')
  })

  it('shows the payment method logo, falls back for a missing name, and omits paid-at when absent', async () => {
    const order = baseOrder({
      invoice: {
        transactions: [{
          payment_method: { logo: 'https://example.com/ideal.png' },
          status: { name: 'paid', color: '#0a0' },
          amount: '20.00',
          paid_at: null,
        }],
      } as never,
    })
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(order)
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('€ 20,00'))
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.text()).toContain('–')
    expect(wrapper.text()).not.toContain('Betaald op')
  })

  it('falls back through unit_price then the first price entry for a credit note line total', async () => {
    const order = baseOrder({
      credit_notes: [{
        id: 1, reference: 'CN-1', created_at: '2026-01-20T00:00:00Z',
        lines: [
          { id: 1, name: 'Uses unit_price', quantity: 1, prices: [{ type: { name: 'unit_price' }, amount: '5.00', display_price: '€ 5,00' }] },
          { id: 2, name: 'Uses first price', quantity: 1, prices: [{ type: null, amount: '2.00', display_price: '€ 2,00' }] },
        ],
      }] as never,
    })
    vi.spyOn(conciarApi.customerOrders, 'get').mockResolvedValue(order)
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('CN-1'))
    expect(wrapper.text()).toContain('€ 5,00')
    expect(wrapper.text()).toContain('€ 2,00')
    expect(wrapper.text()).toContain('€ 7,00') // sum of both line totals
  })
})
