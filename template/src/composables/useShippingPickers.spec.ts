import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useShippingPickers } from './useShippingPickers'
import { conciarApi } from '@/api/conciar'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('useShippingPickers — pickup locations', () => {
  it('fetchLocations is a no-op without both country and postal code', async () => {
    const list = vi.spyOn(conciarApi.shipping, 'locations')
    const { fetchLocations } = useShippingPickers()
    await fetchLocations(undefined, '1234AB')
    await fetchLocations('NL', undefined)
    expect(list).not.toHaveBeenCalled()
  })

  it('fetches and stores locations, then serves the second call from cache', async () => {
    const list = vi.spyOn(conciarApi.shipping, 'locations').mockResolvedValue([{ code: 'L1' } as never])
    const picker = useShippingPickers()
    await picker.fetchLocations('NL', '1234AB')
    expect(picker.locations.value).toEqual([{ code: 'L1' }])
    expect(picker.locationsLoading.value).toBe(false)

    await picker.fetchLocations('nl', '1234ab') // same key, different case
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('degrades to an empty list and caches it on a 404 (carrier not enabled)', async () => {
    const err = Object.assign(new Error('not found'), { status: 404 })
    const list = vi.spyOn(conciarApi.shipping, 'locations').mockRejectedValue(err)
    const picker = useShippingPickers()
    await picker.fetchLocations('NL', '1234AB')
    expect(picker.locations.value).toEqual([])

    await picker.fetchLocations('NL', '1234AB')
    expect(list).toHaveBeenCalledTimes(1) // cached empty result, no retry
  })

  it('clears results without caching on a non-404 error', async () => {
    vi.spyOn(conciarApi.shipping, 'locations').mockRejectedValue(new Error('network down'))
    const picker = useShippingPickers()
    await picker.fetchLocations('NL', '1234AB')
    expect(picker.locations.value).toEqual([])
  })
})

describe('useShippingPickers — delivery options', () => {
  it('fetchDeliveryOptions is a no-op without country, postal code and house number', async () => {
    const options = vi.spyOn(conciarApi.shipping, 'deliveryOptions')
    const { fetchDeliveryOptions } = useShippingPickers()
    await fetchDeliveryOptions('NL', '1234AB', undefined)
    expect(options).not.toHaveBeenCalled()
  })

  it('fetches and caches delivery options', async () => {
    const options = vi.spyOn(conciarApi.shipping, 'deliveryOptions').mockResolvedValue([{ date: '2026-01-01' } as never])
    const picker = useShippingPickers()
    await picker.fetchDeliveryOptions('NL', '1234AB', '10')
    expect(picker.deliveryOptions.value).toEqual([{ date: '2026-01-01' }])

    await picker.fetchDeliveryOptions('NL', '1234AB', '10')
    expect(options).toHaveBeenCalledTimes(1)
  })

  it('degrades to an empty list on a 404', async () => {
    const err = Object.assign(new Error('not found'), { status: 404 })
    vi.spyOn(conciarApi.shipping, 'deliveryOptions').mockRejectedValue(err)
    const picker = useShippingPickers()
    await picker.fetchDeliveryOptions('NL', '1234AB', '10')
    expect(picker.deliveryOptions.value).toEqual([])
  })
})

describe('useShippingPickers — reset', () => {
  it('clears selections and results', async () => {
    vi.spyOn(conciarApi.shipping, 'locations').mockResolvedValue([{ code: 'L1' } as never])
    const picker = useShippingPickers()
    await picker.fetchLocations('NL', '1234AB')
    picker.selectedLocationCode.value = 'L1'
    picker.selectedTimeframe.value = { date: '2026-01-01' } as never

    picker.reset()

    expect(picker.locations.value).toEqual([])
    expect(picker.selectedLocationCode.value).toBeNull()
    expect(picker.deliveryOptions.value).toEqual([])
    expect(picker.selectedTimeframe.value).toBeNull()
  })
})
