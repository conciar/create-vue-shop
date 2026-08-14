import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useStoreConfigStore } from './storeConfig'
import { conciarApi } from '@/api/conciar'
import type { ConciarStoreConfig } from '@/api/conciar-types'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

const config = (over: Partial<ConciarStoreConfig> = {}) =>
  ({ supported_countries: ['NL'], checkout: { guestCheckout: true }, couponsStackable: true, ...over }) as ConciarStoreConfig

describe('storeConfig store', () => {
  it('fetch loads the config and exposes derived getters', async () => {
    vi.spyOn(conciarApi.storeConfig, 'get').mockResolvedValue(config())
    const store = useStoreConfigStore()
    await store.fetch()
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.isActive).toBe(true)
    expect(store.supportedCountries).toEqual(['NL'])
    expect(store.checkout).toEqual({ guestCheckout: true })
    expect(store.couponsStackable).toBe(true)
  })

  it('fetch sets an error and still marks loaded on failure', async () => {
    vi.spyOn(conciarApi.storeConfig, 'get').mockRejectedValue(new Error('boom'))
    const store = useStoreConfigStore()
    await store.fetch()
    expect(store.error).toBe('Could not load store configuration.')
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
  })

  it('fetch is a no-op once already loaded', async () => {
    const get = vi.spyOn(conciarApi.storeConfig, 'get').mockResolvedValue(config())
    const store = useStoreConfigStore()
    await store.fetch()
    await store.fetch()
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('defaults derived getters when no config has loaded', () => {
    const store = useStoreConfigStore()
    expect(store.supportedCountries).toEqual([])
    expect(store.checkout).toBeNull()
    expect(store.couponsStackable).toBe(false)
  })
})
