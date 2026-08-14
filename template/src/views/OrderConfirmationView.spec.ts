import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import OrderConfirmationView from './OrderConfirmationView.vue'
import type { ConciarCreatedOrder } from '@/api/conciar-types'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/order/:reference', name: 'order-confirmation', component: OrderConfirmationView },
      { path: '/orders', component: { template: '<div/>' } },
      { path: '/products', component: { template: '<div/>' } },
    ],
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  window.history.replaceState(null, '')
})

const order = (): ConciarCreatedOrder => ({
  lines: [
    { name: 'Wine A', type: { name: 'product' }, qty: 2, prices: [{ amount: '10.00' }] },
    { name: 'Spring sale', type: { name: 'promotion_discount' }, qty: 1, prices: [{ amount: '-2.00' }] },
    { name: 'Shipping', type: { name: 'shipping' }, qty: 1, prices: [{ amount: '0.00' }] },
  ] as never,
  prices: [
    { type: { name: 'subtotal' }, amount: '20.00' },
    { type: { name: 'total_tax' }, amount: '3.50' },
    { type: { name: 'coupon_discount' }, amount: '-1.00' },
    { type: { name: 'total_price' }, amount: '20.50' },
  ] as never,
} as never)

async function mountAt(reference: string, historyState?: unknown) {
  if (historyState !== undefined) window.history.replaceState(historyState, '')
  const router = testRouter()
  await router.push(`/order/${reference}`)
  return mountWithPlugins(OrderConfirmationView, { global: { plugins: [router] } })
}

describe('OrderConfirmationView — with order state (fresh navigation)', () => {
  it('renders product lines, discounts and totals from router state', async () => {
    const wrapper = await mountAt('ORD-1', { order: order() })
    expect(wrapper.text()).toContain('ORD-1')
    expect(wrapper.text()).toContain('Wine A')
    expect(wrapper.text()).toContain('€ 20,50') // total
    expect(wrapper.text()).toContain('€ 20,00') // subtotal
    expect(wrapper.text()).toContain('€ 3,50') // tax
    expect(wrapper.text()).toContain('Spring sale')
    expect(wrapper.text()).toContain('− € 2,00')
    expect(wrapper.text()).toContain('− € 1,00') // coupon discount
  })

  it('shows "Free" for a zero-amount shipping line', async () => {
    const wrapper = await mountAt('ORD-1', { order: order() })
    expect(wrapper.text()).toContain('Free')
  })

  it('shows a non-zero shipping amount when present', async () => {
    const o = order()
    ;(o.lines as never as { prices: { amount: string }[] }[])[2].prices[0].amount = '5.00'
    const wrapper = await mountAt('ORD-1', { order: o })
    expect(wrapper.text()).toContain('€ 5,00')
  })

  it('renders a payment fee line when present', async () => {
    const o = order()
    ;(o.lines as unknown[]).push({ name: 'Fee', type: { name: 'payment_fee' }, qty: 1, prices: [{ amount: '1.50' }] })
    const wrapper = await mountAt('ORD-1', { order: o })
    expect(wrapper.text()).toContain('€ 1,50')
  })
})

describe('OrderConfirmationView — without order state (page refresh)', () => {
  it('shows the fallback message referencing the order number', async () => {
    const wrapper = await mountAt('ORD-2', null)
    expect(wrapper.text()).toContain('ORD-2')
    expect(wrapper.text()).toContain('has been placed')
  })
})

describe('OrderConfirmationView — totals fallbacks', () => {
  it('prefers the total_ex_tax row over the legacy subtotal row', async () => {
    const o = order()
    ;(o.prices as unknown[]).unshift({ type: { name: 'total_ex_tax' }, amount: '17.00' })
    const wrapper = await mountAt('ORD-1', { order: o })
    expect(wrapper.text()).toContain('€ 17,00')
  })

  it('renders an order with no lines and no price rows at all', async () => {
    const wrapper = await mountAt('ORD-1', { order: { lines: [], prices: [] } })
    expect(wrapper.text()).toContain('ORD-1')
    expect(wrapper.text()).toContain('Items ordered')
    expect(wrapper.text()).not.toContain('Subtotal')
    expect(wrapper.text()).not.toContain('Total')
  })

  it('hides the tax line when tax_total is zero', async () => {
    const wrapper = await mountAt('ORD-1', {
      order: {
        lines: [],
        prices: [
          { type: { name: 'subtotal' }, amount: '20.00' },
          { type: { name: 'total_tax' }, amount: '0.00' },
          { type: { name: 'total_price' }, amount: '20.00' },
        ],
      },
    })
    expect(wrapper.text()).not.toContain('Tax')
  })

  it('falls back to a generic "Discount" label for unnamed promotion and coupon rows', async () => {
    const wrapper = await mountAt('ORD-1', {
      order: {
        lines: [{ name: null, type: { name: 'promotion_discount' }, qty: 1, prices: [{ amount: '-2.00' }] }],
        prices: [
          { type: { name: 'subtotal' }, amount: '20.00' },
          { type: { name: 'coupon_discount' }, name: null, amount: '-1.00' },
          { type: { name: 'total_price' }, amount: '17.00' },
        ],
      },
    })
    expect(wrapper.text()).toContain('Discount')
    expect(wrapper.text()).toContain('− € 2,00')
    expect(wrapper.text()).toContain('− € 1,00')
  })

  it('falls back to zero for a product line with no price entry', async () => {
    const wrapper = await mountAt('ORD-1', {
      order: {
        lines: [{ name: 'Mystery item', type: { name: 'product' }, qty: 2, prices: [] }],
        prices: [],
      },
    })
    expect(wrapper.text()).toContain('Mystery item')
    expect(wrapper.text()).toContain('€ 0,00')
  })

  it('falls back to a non-free shipping label when the shipping line has no price entry', async () => {
    const wrapper = await mountAt('ORD-1', {
      order: {
        lines: [{ name: 'Courier', type: { name: 'shipping' }, qty: 1, prices: [] }],
        prices: [],
      },
    })
    expect(wrapper.text()).toContain('Courier')
    expect(wrapper.text()).not.toContain('Free')
  })

  it('falls back to zero for a payment fee line with no price entry', async () => {
    const wrapper = await mountAt('ORD-1', {
      order: {
        lines: [{ name: 'Fee', type: { name: 'payment_fee' }, qty: 1, prices: [] }],
        prices: [],
      },
    })
    expect(wrapper.text()).toContain('Fee')
    expect(wrapper.text()).toContain('€ 0,00')
  })
})
