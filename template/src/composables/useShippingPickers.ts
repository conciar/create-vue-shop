import { ref } from 'vue'
import { conciarApi } from '@/api/conciar'
import type { ConciarPickupLocation, ConciarDeliveryOption, ConciarDeliveryTimeframe } from '@/api/conciar-types'

export interface SelectedTimeframe extends ConciarDeliveryTimeframe {
  date: string
}

/**
 * PostNL pickup-point and home-delivery-timeframe lookups for the checkout
 * shipping step. Results are cached per (country, postcode[, house number]) for
 * the lifetime of this checkout session to avoid redundant live PostNL calls.
 *
 * Both endpoints 404 when the carrier isn't enabled — we degrade gracefully
 * (empty list, no error) and cache the empty result so we don't retry.
 */
export function useShippingPickers() {
  const locations = ref<ConciarPickupLocation[]>([])
  const locationsLoading = ref(false)
  const selectedLocationCode = ref<string | null>(null)

  const deliveryOptions = ref<ConciarDeliveryOption[]>([])
  const deliveryLoading = ref(false)
  const selectedTimeframe = ref<SelectedTimeframe | null>(null)

  const locationsCache = new Map<string, ConciarPickupLocation[]>()
  const deliveryCache = new Map<string, ConciarDeliveryOption[]>()

  async function fetchLocations(countryCode?: string, postalCode?: string) {
    if (!countryCode || !postalCode) return
    const key = `${countryCode}|${postalCode}`.toUpperCase()
    if (locationsCache.has(key)) { locations.value = locationsCache.get(key)!; return }

    locationsLoading.value = true
    try {
      const result = await conciarApi.shipping.locations({ country_code: countryCode, postal_code: postalCode })
      locationsCache.set(key, result)
      locations.value = result
    } catch (e: any) {
      // 404 = carrier not enabled → no picker. Cache empty to avoid retrying.
      if (e?.status === 404) locationsCache.set(key, [])
      locations.value = []
    } finally {
      locationsLoading.value = false
    }
  }

  async function fetchDeliveryOptions(countryCode?: string, postalCode?: string, houseNumber?: string) {
    if (!countryCode || !postalCode || !houseNumber) return
    const key = `${countryCode}|${postalCode}|${houseNumber}`.toUpperCase()
    if (deliveryCache.has(key)) { deliveryOptions.value = deliveryCache.get(key)!; return }

    deliveryLoading.value = true
    try {
      const result = await conciarApi.shipping.deliveryOptions({
        country_code: countryCode, postal_code: postalCode, house_number: houseNumber,
      })
      deliveryCache.set(key, result)
      deliveryOptions.value = result
    } catch (e: any) {
      if (e?.status === 404) deliveryCache.set(key, [])
      deliveryOptions.value = []
    } finally {
      deliveryLoading.value = false
    }
  }

  // Clear current selections/results (e.g. when the shipping method changes).
  function reset() {
    locations.value = []
    selectedLocationCode.value = null
    deliveryOptions.value = []
    selectedTimeframe.value = null
  }

  return {
    locations, locationsLoading, selectedLocationCode,
    deliveryOptions, deliveryLoading, selectedTimeframe,
    fetchLocations, fetchDeliveryOptions, reset,
  }
}
