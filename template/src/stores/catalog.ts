import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { SubscriptionBox } from '@/types'
import type { ConciarConnectProduct, ConciarFilter, ConciarProductListParams, ConciarCategoryTree } from '@/api/conciar-types'
import { conciarApi } from '@/api/conciar'

export const useCatalogStore = defineStore('catalog', () => {
  // Legacy subscription box state (used by subscriptions page)
  const products = ref<SubscriptionBox[]>([])
  const subscriptions = ref<SubscriptionBox[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProducts(params?: { featured?: boolean; subscription?: boolean }) {
    loading.value = true
    error.value = null
    try {
      products.value = await conciarApi.products.list(params)
    } catch {
      error.value = 'Failed to load products'
    } finally {
      loading.value = false
    }
  }

  async function fetchSubscriptions() {
    loading.value = true
    error.value = null
    try {
      subscriptions.value = await conciarApi.products.list({ subscription: true })
    } catch {
      error.value = 'Failed to load subscriptions'
    } finally {
      loading.value = false
    }
  }

  // Connect v1 product listing state
  const connectProducts = ref<ConciarConnectProduct[]>([])
  const connectFilters = ref<ConciarFilter[]>([])
  const connectPagination = ref({ currentPage: 1, lastPage: 1, total: 0, perPage: 20 })
  const connectLoading = ref(false)
  const connectError = ref<string | null>(null)

  async function fetchConnectProducts(params: ConciarProductListParams = {}) {
    connectLoading.value = true
    connectError.value = null
    try {
      const [productsData, filters] = await Promise.all([
        conciarApi.connect.products.list(params),
        conciarApi.connect.products.filters(params),
      ])
      connectProducts.value = productsData.data
      connectPagination.value = {
        currentPage: productsData.current_page,
        lastPage: productsData.last_page,
        total: productsData.total,
        perPage: productsData.per_page,
      }
      connectFilters.value = filters
    } catch {
      connectError.value = 'Failed to load products'
    } finally {
      connectLoading.value = false
    }
  }

  // Category tree — the store's taxonomy, fetched once and reused for navigation.
  const categories = ref<ConciarCategoryTree[]>([])
  const categoriesLoading = ref(false)
  const categoriesError = ref<string | null>(null)

  async function fetchCategories(force = false) {
    // Categories change far less often than stock, and every page wants them for navigation.
    // Refetching per view would spend a request on an answer we already have.
    if (categories.value.length && !force) return

    categoriesLoading.value = true
    categoriesError.value = null
    try {
      categories.value = await conciarApi.categories.list()
    } catch {
      categoriesError.value = 'Failed to load categories'
    } finally {
      categoriesLoading.value = false
    }
  }

  return {
    products, subscriptions, loading, error, fetchProducts, fetchSubscriptions,
    connectProducts, connectFilters, connectPagination, connectLoading, connectError,
    fetchConnectProducts,
    categories, categoriesLoading, categoriesError, fetchCategories,
  }
})
