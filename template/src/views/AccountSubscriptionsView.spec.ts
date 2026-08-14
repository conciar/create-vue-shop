import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import AccountSubscriptionsView from './AccountSubscriptionsView.vue'
import { useCustomerStore } from '@/stores/customer'
import { conciarApi } from '@/api/conciar'
import type { ConciarCustomerSubscription } from '@/api/conciar-types'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/login', component: { template: '<div/>' } },
      { path: '/subscriptions', component: { template: '<div/>' } },
      { path: '/account/subscriptions/:id', name: 'subscription-detail', component: { template: '<div/>' } },
    ],
  })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  useCustomerStore().accessToken = 'tok'
})

const sub = (over: Partial<ConciarCustomerSubscription> = {}): ConciarCustomerSubscription => ({
  id: 1,
  quantity: 2,
  status: { name: 'active' },
  skip_count: 0,
  next_billing_at: '2026-03-01T00:00:00Z',
  product: {
    default_info: { name: 'Box' },
    retail_price: { display_price: '€ 20,00' },
    subscription_detail: { billing_cycle_unit: 'month', billing_cycle_interval: 1 },
  },
  ...over,
} as never)

function mountView() {
  return mountWithPlugins(AccountSubscriptionsView, { global: { plugins: [testRouter()] } })
}

describe('AccountSubscriptionsView', () => {
  it('shows a loading skeleton, then the subscription list', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'list').mockResolvedValue([sub()])
    const wrapper = mountView()
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Box'))
    expect(wrapper.text()).toContain('€ 20,00')
    expect(wrapper.text()).toContain('Every month')
  })

  it('shows the empty state with a browse link', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'list').mockResolvedValue([])
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain("don't have any subscriptions"))
    expect(wrapper.find('a[href="/subscriptions"]').exists()).toBe(true)
  })

  it('shows a generic error message on a non-401 failure', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'list').mockRejectedValue(new Error('boom'))
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Could not load subscriptions'))
  })

  it('logs out and redirects to /login on a 401', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'list').mockRejectedValue(Object.assign(new Error('unauth'), { status: 401 }))
    const router = testRouter()
    mountWithPlugins(AccountSubscriptionsView, { global: { plugins: [router] } })
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    expect(useCustomerStore().isLoggedIn).toBe(false)
  })

  it('shows the skip count and next delivery only when relevant', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'list').mockResolvedValue([
      sub({ id: 1, skip_count: 2, status: { name: 'active' } as never }),
      sub({ id: 2, status: { name: 'paused' } as never, next_billing_at: null }),
    ])
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('2 to skip'))
    expect(wrapper.text()).toContain('Paused')
  })

  it('formats a four-weekly billing cycle distinctly, and pluralizes multi-unit intervals', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'list').mockResolvedValue([
      sub({ id: 1, product: { default_info: { name: 'A' }, retail_price: {}, subscription_detail: { billing_cycle_unit: 'four_weekly', billing_cycle_interval: 1 } } as never }),
      sub({ id: 2, product: { default_info: { name: 'B' }, retail_price: {}, subscription_detail: { billing_cycle_unit: 'month', billing_cycle_interval: 3 } } as never }),
    ])
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Every 4 weeks'))
    expect(wrapper.text()).toContain('Every 3 months')
  })

  it('falls back to the raw unit name for an unrecognized billing unit', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'list').mockResolvedValue([
      sub({ product: { default_info: { name: 'A' }, retail_price: {}, subscription_detail: { billing_cycle_unit: 'fortnight', billing_cycle_interval: 1 } } as never }),
    ])
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Every fortnight'))
  })
})
