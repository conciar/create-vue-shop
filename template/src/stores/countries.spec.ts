import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { formatCountryName, useCountriesStore } from './countries'
import { conciarApi } from '@/api/conciar'
import type { ConciarCountry } from '@/api/conciar-types'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('formatCountryName', () => {
  it('replaces underscores and title-cases each word', () => {
    expect(formatCountryName('new_zealand')).toBe('New Zealand')
    expect(formatCountryName('united_states')).toBe('United States')
  })

  it('capitalises a single word', () => {
    expect(formatCountryName('netherlands')).toBe('Netherlands')
  })

  it('handles an empty string', () => {
    expect(formatCountryName('')).toBe('')
  })

  it('is idempotent on already-formatted input', () => {
    expect(formatCountryName('Netherlands')).toBe('Netherlands')
  })
})

describe('countries store', () => {
  const list: ConciarCountry[] = [{ id: 1, name: 'netherlands' } as never]

  it('fetch loads countries and marks loaded', async () => {
    vi.spyOn(conciarApi.countries, 'list').mockResolvedValue(list)
    const store = useCountriesStore()
    await store.fetch()
    expect(store.countries).toEqual(list)
    expect(store.loaded).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetch sets an error message on failure', async () => {
    vi.spyOn(conciarApi.countries, 'list').mockRejectedValue(new Error('boom'))
    const store = useCountriesStore()
    await store.fetch()
    expect(store.error).toBe('Could not load countries.')
    expect(store.loaded).toBe(false)
    expect(store.loading).toBe(false)
  })

  it('fetch is a no-op once already loaded', async () => {
    const list_ = vi.spyOn(conciarApi.countries, 'list').mockResolvedValue(list)
    const store = useCountriesStore()
    await store.fetch()
    await store.fetch()
    expect(list_).toHaveBeenCalledTimes(1)
  })
})
