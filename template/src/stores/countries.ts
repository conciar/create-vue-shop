import { ref } from 'vue'
import { defineStore } from 'pinia'
import { conciarApi } from '@/api/conciar'
import type { ConciarCountry } from '@/api/conciar-types'

// Converts API snake_case names to display form: "new_zealand" → "New Zealand"
export function formatCountryName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export const useCountriesStore = defineStore('countries', () => {
  const countries = ref<ConciarCountry[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  async function fetch() {
    if (loaded.value || loading.value) return
    loading.value = true
    error.value = null
    try {
      countries.value = await conciarApi.countries.list()
      loaded.value = true
    } catch {
      error.value = 'Could not load countries.'
    } finally {
      loading.value = false
    }
  }

  return { countries, loading, loaded, error, fetch }
})
