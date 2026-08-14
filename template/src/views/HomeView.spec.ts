import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountWithPlugins } from '@/test-support/mount'
import HomeView from './HomeView.vue'
import { conciarApi } from '@/api/conciar'
import type { SubscriptionBox } from '@/types'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

const box = (id: string): SubscriptionBox => ({
  id, isSubscription: true, name: `Box ${id}`, tagline: '', description: '', bottles: 3,
  price: 10, frequency: 'monthly', image: '', highlights: [],
})

describe('HomeView', () => {
  it('shows a loading skeleton, then the featured products once loaded', async () => {
    let resolveList!: (v: SubscriptionBox[]) => void
    vi.spyOn(conciarApi.products, 'list').mockReturnValue(new Promise(r => (resolveList = r)))

    const wrapper = mountWithPlugins(HomeView)
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)

    resolveList([box('1'), box('2')])
    await vi.waitFor(() => expect(wrapper.text()).toContain('Box 1'))
    expect(wrapper.findAll('.animate-pulse').length).toBe(0)
  })

  it('shows an empty message when there are no featured products', async () => {
    vi.spyOn(conciarApi.products, 'list').mockResolvedValue([])
    const wrapper = mountWithPlugins(HomeView)
    await vi.waitFor(() => expect(wrapper.text()).toContain('No featured products'))
  })

  it('clears the loading state even if the fetch fails', async () => {
    vi.spyOn(conciarApi.products, 'list').mockRejectedValue(new Error('boom'))
    const wrapper = mountWithPlugins(HomeView)
    await vi.waitFor(() => expect(wrapper.findAll('.animate-pulse').length).toBe(0))
  })

  it('requests featured products on mount', () => {
    const list = vi.spyOn(conciarApi.products, 'list').mockResolvedValue([])
    mountWithPlugins(HomeView)
    expect(list).toHaveBeenCalledWith({ featured: true })
  })
})
