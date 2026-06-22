import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { conciarApi } from '@/api/conciar'
import type { ConciarStoreConfig } from '@/api/conciar-types'

export const useStoreConfigStore = defineStore('storeConfig', () => {
  const config = ref<ConciarStoreConfig | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    if (loaded.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      config.value = await conciarApi.storeConfig.get()
    } catch {
      error.value = 'Could not load store configuration.'
    } finally {
      loaded.value = true
      loading.value = false
    }
  }

  // general.active is not present in the current API response — default to true
  const isActive = computed(() => true)

  // ISO-2 codes of shippable countries; empty array means no restriction
  const supportedCountries = computed(() => config.value?.supported_countries ?? [])

  const checkout = computed(() => config.value?.checkout ?? null)

  // Whether multiple coupons may be stacked on the cart (per sales channel)
  const couponsStackable = computed(() => config.value?.couponsStackable === true)

  return { config, loading, loaded, error, isActive, supportedCountries, checkout, couponsStackable, fetch }
})
