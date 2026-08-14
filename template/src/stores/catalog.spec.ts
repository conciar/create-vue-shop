import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCatalogStore } from './catalog'
import { conciarApi } from '@/api/conciar'
import type { SubscriptionBox } from '@/types'
import type { ConciarConnectProductsData, ConciarFilter } from '@/api/conciar-types'

const box = (id: string) => ({ id } as SubscriptionBox)

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('catalog store — products', () => {
  it('fetchProducts populates products on success', async () => {
    vi.spyOn(conciarApi.products, 'list').mockResolvedValue([box('p1')])
    const catalog = useCatalogStore()
    await catalog.fetchProducts({ featured: true })
    expect(catalog.products).toEqual([box('p1')])
    expect(catalog.loading).toBe(false)
    expect(catalog.error).toBeNull()
  })

  it('fetchProducts sets an error message on failure', async () => {
    vi.spyOn(conciarApi.products, 'list').mockRejectedValue(new Error('boom'))
    const catalog = useCatalogStore()
    await catalog.fetchProducts()
    expect(catalog.error).toBe('Failed to load products')
    expect(catalog.loading).toBe(false)
  })

  it('fetchSubscriptions populates subscriptions on success', async () => {
    vi.spyOn(conciarApi.products, 'list').mockResolvedValue([box('s1')])
    const catalog = useCatalogStore()
    await catalog.fetchSubscriptions()
    expect(catalog.subscriptions).toEqual([box('s1')])
  })

  it('fetchSubscriptions sets an error message on failure', async () => {
    vi.spyOn(conciarApi.products, 'list').mockRejectedValue(new Error('boom'))
    const catalog = useCatalogStore()
    await catalog.fetchSubscriptions()
    expect(catalog.error).toBe('Failed to load subscriptions')
  })
})

describe('catalog store — connect products', () => {
  const productsData: ConciarConnectProductsData = {
    data: [{ id: 1 } as never],
    current_page: 1,
    last_page: 2,
    per_page: 20,
    total: 21,
  }
  const filters: ConciarFilter[] = [{ key: 'color' } as never]

  it('fetchConnectProducts populates products, pagination and filters on success', async () => {
    vi.spyOn(conciarApi.connect.products, 'list').mockResolvedValue(productsData)
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue(filters)
    const catalog = useCatalogStore()
    await catalog.fetchConnectProducts({ q: 'test' })
    expect(catalog.connectProducts).toEqual(productsData.data)
    expect(catalog.connectPagination).toEqual({ currentPage: 1, lastPage: 2, total: 21, perPage: 20 })
    expect(catalog.connectFilters).toEqual(filters)
    expect(catalog.connectLoading).toBe(false)
    expect(catalog.connectError).toBeNull()
  })

  it('fetchConnectProducts sets an error message on failure', async () => {
    vi.spyOn(conciarApi.connect.products, 'list').mockRejectedValue(new Error('boom'))
    vi.spyOn(conciarApi.connect.products, 'filters').mockResolvedValue([])
    const catalog = useCatalogStore()
    await catalog.fetchConnectProducts()
    expect(catalog.connectError).toBe('Failed to load products')
    expect(catalog.connectLoading).toBe(false)
  })
})
