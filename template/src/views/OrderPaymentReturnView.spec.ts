import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import OrderPaymentReturnView from './OrderPaymentReturnView.vue'
import { conciarApi } from '@/api/conciar'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/payments/:psp/return', component: OrderPaymentReturnView },
      { path: '/order/:reference', name: 'order-confirmation', component: { template: '<div/>' } },
      { path: '/orders', component: { template: '<div/>' } },
      { path: '/checkout', component: { template: '<div/>' } },
    ],
  })
}

async function mountView() {
  const router = testRouter()
  await router.push('/payments/mollie/return')
  const wrapper = mountWithPlugins(OrderPaymentReturnView, { global: { plugins: [router] } })
  return { wrapper, router }
}

beforeEach(() => {
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  vi.useFakeTimers()
})

afterEach(() => vi.useRealTimers())

describe('OrderPaymentReturnView — no pending transaction', () => {
  it('shows the "not found" state immediately when there is no stored transaction key', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Order not found')
  })
})

describe('OrderPaymentReturnView — polling', () => {
  beforeEach(() => sessionStorage.setItem('pending_transaction_key', 'txn-1'))

  it('shows paid, clears the pending key, and redirects to the order confirmation after a delay', async () => {
    vi.spyOn(conciarApi.orders, 'getStatusByTransaction').mockResolvedValue({
      is_paid: true, is_pending: false, is_failed: false, status: 'paid', amount: 42.5, order_reference: 'ORD-9', transaction_key: 'txn-1',
    })
    const { wrapper, router } = await mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Order confirmed!'))
    expect(wrapper.text()).toContain('ORD-9')
    expect(wrapper.text()).toContain('€ 42,50')
    expect(sessionStorage.getItem('pending_transaction_key')).toBeNull()

    await vi.advanceTimersByTimeAsync(2500)
    expect(router.currentRoute.value.name).toBe('order-confirmation')
  })

  it('shows the authorized (capture-on-shipment) state as a terminal success', async () => {
    vi.spyOn(conciarApi.orders, 'getStatusByTransaction').mockResolvedValue({
      is_paid: false, is_pending: false, is_failed: false, status: 'authorized', amount: 10, order_reference: 'ORD-8', transaction_key: 'txn-1',
    })
    const { wrapper } = await mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Order placed!'))
  })

  it('shows failed for a failed or cancelled status', async () => {
    vi.spyOn(conciarApi.orders, 'getStatusByTransaction').mockResolvedValue({
      is_paid: false, is_pending: false, is_failed: true, status: 'failed', amount: 0, order_reference: '', transaction_key: 'txn-1',
    })
    const { wrapper } = await mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Payment failed or cancelled'))
    expect(sessionStorage.getItem('pending_transaction_key')).toBeNull()
  })

  it('keeps polling while pending, and times out after the max attempts', async () => {
    vi.spyOn(conciarApi.orders, 'getStatusByTransaction').mockResolvedValue({
      is_paid: false, is_pending: true, is_failed: false, status: 'pending', amount: 0, order_reference: '', transaction_key: 'txn-1',
    })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain("We're processing your payment")

    await vi.advanceTimersByTimeAsync(3000 * 10)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Payment is being processed'))
  })

  it('shows not-found on a 404 from the status check', async () => {
    vi.spyOn(conciarApi.orders, 'getStatusByTransaction').mockRejectedValue(Object.assign(new Error('gone'), { status: 404 }))
    const { wrapper } = await mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Order not found'))
  })

  it('shows failed on a non-404 error from the status check', async () => {
    vi.spyOn(conciarApi.orders, 'getStatusByTransaction').mockRejectedValue(new Error('network down'))
    const { wrapper } = await mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Payment failed or cancelled'))
  })

  it('omits the reference and amount lines when the paid response carries neither', async () => {
    vi.spyOn(conciarApi.orders, 'getStatusByTransaction').mockResolvedValue({
      is_paid: true, is_pending: false, is_failed: false, status: 'paid', amount: 0, order_reference: '', transaction_key: 'txn-1',
    })
    const { wrapper } = await mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Order confirmed!'))
    expect(wrapper.text()).not.toContain('€')
    expect(wrapper.text()).not.toContain('View your order')
  })

  it('omits the reference and amount lines on an authorized response carrying neither', async () => {
    vi.spyOn(conciarApi.orders, 'getStatusByTransaction').mockResolvedValue({
      is_paid: false, is_pending: false, is_failed: false, status: 'authorized', amount: 0, order_reference: '', transaction_key: 'txn-1',
    })
    const { wrapper } = await mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Order placed!'))
    expect(wrapper.text()).not.toContain('€')
  })
})
