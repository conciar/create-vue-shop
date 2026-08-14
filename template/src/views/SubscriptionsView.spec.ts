import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountWithPlugins } from '@/test-support/mount'
import SubscriptionsView from './SubscriptionsView.vue'
import { conciarApi } from '@/api/conciar'
import type { ConciarConnectProductsData, ConciarFilter } from '@/api/conciar-types'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

const productsData = (data: unknown[] = []): ConciarConnectProductsData =>
  ({ data, current_page: 1, last_page: 1, per_page: 20, total: data.length } as never)

describe('SubscriptionsView', () => {
  it('shows a loading skeleton, then the product grid once loaded', async () => {
    let resolveList!: (v: ConciarConnectProductsData) => void
    vi.spyOn(conciarApi.connect.products, 'list').mockReturnValue(new Promise(r => (resolveList = r)))
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([] as ConciarFilter[])

    const wrapper = mountWithPlugins(SubscriptionsView)
    await wrapper.vm.$nextTick() // connectLoading flips true synchronously inside onMounted, needs a tick to render
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)

    resolveList(productsData([{ id: 1, resolved_info: { name: 'Box A' }, files: [] }]))
    await vi.waitFor(() => expect(wrapper.text()).toContain('Box A'))
  })

  it('shows an empty message when there are no subscription boxes', async () => {
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(productsData([]))
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    const wrapper = mountWithPlugins(SubscriptionsView)
    await vi.waitFor(() => expect(wrapper.text()).toContain('No subscription boxes'))
  })

  it('requests subscription products (not all products) on mount', () => {
    const list = vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(productsData([]))
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    mountWithPlugins(SubscriptionsView)
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ subscription: true }))
  })

  it('renders the perks strip and a link to manage subscriptions', async () => {
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(productsData([]))
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    const wrapper = mountWithPlugins(SubscriptionsView)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cancel anytime'))
    expect(wrapper.find('a[href="/account/subscriptions"]').exists()).toBe(true)
  })
})
