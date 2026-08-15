import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import AccountOrdersView from './AccountOrdersView.vue'
import { useCustomerStore } from '@/stores/customer'
import { conciarApi } from '@/api/conciar'
import type { ConciarCustomerOrder } from '@/api/conciar-types'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/login', component: { template: '<div/>' } },
      { path: '/products', component: { template: '<div/>' } },
      { path: '/account/orders/:reference', name: 'order-detail', component: { template: '<div/>' } },
    ],
  })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  useCustomerStore().accessToken = 'tok'
})

const order = (over: Partial<ConciarCustomerOrder> = {}): ConciarCustomerOrder => ({
  id: 1,
  reference: 'ORD-1',
  created_at: '2026-01-15T10:00:00Z',
  status: { name: 'paid' },
  lines: [{ type: { name: 'product' } }, { type: { name: 'shipping' } }] as never,
  prices: [{ type: { name: 'subtotal' }, display_price: '€ 10,00' }, { type: { name: 'total_price' }, display_price: '€ 12,00' }] as never,
  ...over,
} as never)

function mountView() {
  return mountWithPlugins(AccountOrdersView, { global: { plugins: [testRouter()] } })
}

describe('AccountOrdersView', () => {
  it('shows a skeleton, then a list of orders with total and product count', async () => {
    vi.spyOn(conciarApi.customerOrders, 'list').mockResolvedValue({
      data: [order()], current_page: 1, last_page: 1, per_page: 10, total: 1,
    })
    const wrapper = mountView()
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)

    await vi.waitFor(() => expect(wrapper.text()).toContain('ORD-1'))
    expect(wrapper.text()).toContain('€ 12,00')
    expect(wrapper.find('a[href*="ORD-1"]').exists()).toBe(true)
  })

  it('shows the empty state when there are no orders', async () => {
    vi.spyOn(conciarApi.customerOrders, 'list').mockResolvedValue({
      data: [], current_page: 1, last_page: 1, per_page: 10, total: 0,
    })
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain("don't have any orders"))
  })

  it('logs out and redirects to /login on a 401', async () => {
    vi.spyOn(conciarApi.customerOrders, 'list').mockRejectedValue(Object.assign(new Error('unauth'), { status: 401 }))
    const router = testRouter()
    const wrapper = mountWithPlugins(AccountOrdersView, { global: { plugins: [router] } })
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    expect(useCustomerStore().isLoggedIn).toBe(false)
    void wrapper
  })

  it('paginates via the next/previous buttons', async () => {
    const list = vi.spyOn(conciarApi.customerOrders, 'list').mockImplementation(async (_tok, params) => ({
      data: [order({ reference: `ORD-${params?.page ?? 1}` })],
      current_page: params?.page ?? 1,
      last_page: 3,
      per_page: 10,
      total: 30,
    }))
    const wrapper = mountView()
    await vi.waitFor(() => expect(wrapper.text()).toContain('ORD-1'))

    await wrapper.get('button:not([disabled])').trigger('click') // next (prev is disabled on page 1)
    await vi.waitFor(() => expect(wrapper.text()).toContain('ORD-2'))
    expect(list).toHaveBeenLastCalledWith('tok', { page: 2, per_page: 10 })
  })
})
