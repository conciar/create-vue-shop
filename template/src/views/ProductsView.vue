<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCatalogStore } from '@/stores/catalog'
import ProductCard from '@/components/product/ProductCard.vue'
import type { ConciarProductListParams, ConciarConnectProduct } from '@/api/conciar-types'

const { t } = useI18n()
const route  = useRoute()
const router = useRouter()
const catalog = useCatalogStore()

// ── Search ──────────────────────────────────────────────────────────────────
const searchInput = ref(String(route.query.q ?? ''))
// Keep searchInput in sync with URL (back/forward navigation)
watch(() => route.query.q, v => {
  const s = String(v ?? '')
  if (s !== searchInput.value) searchInput.value = s
}, { immediate: true })

let searchTimer: ReturnType<typeof setTimeout>
watch(searchInput, v => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => pushQuery({ q: v || undefined, page: undefined }), 400)
})

// ── Active property filters from URL ────────────────────────────────────────
const activeProperties = computed<Record<string, string[]>>(() => {
  const props: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(route.query)) {
    const m = key.match(/^property\[(.+)\]$/)
    if (m && value) {
      props[m[1]] = Array.isArray(value)
        ? (value as string[]).filter(Boolean)
        : [value as string]
    }
  }
  return props
})

function isActive(key: string, value: string) {
  return activeProperties.value[key]?.includes(value) ?? false
}

function toggleProperty(key: string, value: string) {
  const current = activeProperties.value[key] ?? []
  const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
  pushQuery({
    [`property[${key}]`]: next.length === 0 ? undefined : next.length === 1 ? next[0] : next,
    page: undefined,
  })
}

// ── Price range ─────────────────────────────────────────────────────────────
const priceMinInput = ref(String(route.query.price_min ?? ''))
const priceMaxInput = ref(String(route.query.price_max ?? ''))

function applyPriceRange() {
  pushQuery({
    price_min: priceMinInput.value || undefined,
    price_max: priceMaxInput.value || undefined,
    page: undefined,
  })
}

function clearPriceRange() {
  priceMinInput.value = ''
  priceMaxInput.value = ''
  pushQuery({ price_min: undefined, price_max: undefined, page: undefined })
}

const hasPriceFilter = computed(() => !!(route.query.price_min || route.query.price_max))

// ── Active chips ─────────────────────────────────────────────────────────────
const activeChips = computed(() => {
  const chips: Array<{ label: string; onRemove: () => void }> = []
  for (const [key, values] of Object.entries(activeProperties.value)) {
    const filterDef = catalog.connectFilters.find(f => f.key === key)
    for (const v of values) {
      chips.push({ label: `${filterDef?.label ?? key}: ${v}`, onRemove: () => toggleProperty(key, v) })
    }
  }
  if (hasPriceFilter.value) {
    const min = route.query.price_min
    const max = route.query.price_max
    chips.push({
      label: `€${min ?? 0} – €${max ?? '∞'}`,
      onRemove: clearPriceRange,
    })
  }
  return chips
})

// ── Pagination ────────────────────────────────────────────────────────────────
const currentPage = computed(() => Number(route.query.page ?? 1))

function goToPage(p: number) {
  pushQuery({ page: p === 1 ? undefined : String(p) })
}

// ── URL helper ────────────────────────────────────────────────────────────────
function pushQuery(patch: Record<string, string | string[] | undefined>) {
  const q = { ...route.query }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete q[k]
    else q[k] = v
  }
  router.push({ query: q })
}

// ── Fetch on route query change ───────────────────────────────────────────────
function buildParams(): ConciarProductListParams {
  const params: ConciarProductListParams = {}
  const q = String(route.query.q ?? '').trim()
  if (q) params.q = q
  const page = Number(route.query.page ?? 1)
  if (page > 1) params.page = page
  if (route.query.price_min) params.price_min = Number(route.query.price_min)
  if (route.query.price_max) params.price_max = Number(route.query.price_max)
  if (Object.keys(activeProperties.value).length) params.properties = activeProperties.value
  return params
}

watch(() => route.query, () => catalog.fetchConnectProducts(buildParams()), { immediate: true, deep: true })

// ── Mobile filter toggle ──────────────────────────────────────────────────────
const showMobileFilters = ref(false)

// ── Infinite scroll ───────────────────────────────────────────────────────────
const allProducts = ref<ConciarConnectProduct[]>([])
const sentinel    = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// Serialise query without `page` to detect filter changes vs page changes
const filterKey = computed(() => {
  const { page: _p, ...rest } = route.query
  return JSON.stringify(rest)
})

// Reset accumulated list when filters change
watch(filterKey, () => { allProducts.value = [] })

// Append or replace when the store returns new products
watch(() => catalog.connectProducts, (products) => {
  if (currentPage.value <= 1) {
    allProducts.value = [...products]
  } else {
    // Deduplicate by id in case of rapid navigation
    const seen = new Set(allProducts.value.map(p => p.id))
    allProducts.value = [...allProducts.value, ...products.filter(p => !seen.has(p.id))]
  }
})

const hasMore = computed(() =>
  catalog.connectPagination.currentPage < catalog.connectPagination.lastPage
)

function loadNextPage() {
  if (!hasMore.value || catalog.connectLoading) return
  goToPage(currentPage.value + 1)
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => { if (entries[0].isIntersecting) loadNextPage() },
    { rootMargin: '300px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => observer?.disconnect())

// Re-attach observer when sentinel mounts (e.g. after empty→populated transition)
watch(sentinel, (el) => {
  if (el && observer) observer.observe(el)
})

// ── Filter "show more" ────────────────────────────────────────────────────────
const FILTER_INITIAL = 5
const expandedFilters = ref<Set<string>>(new Set())

function isExpanded(key: string) { return expandedFilters.value.has(key) }
function toggleExpand(key: string) {
  const s = new Set(expandedFilters.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  expandedFilters.value = s
}
function visibleOptions(key: string, options: { value: string; count: number }[]) {
  return isExpanded(key) ? options : options.slice(0, FILTER_INITIAL)
}
</script>

<template>
  <div class="max-w-[1400px] mx-auto px-6 py-12">

    <!-- Header -->
    <div class="mb-10">
      <span class="font-mono text-xs tracking-[0.2em] uppercase text-gray-400">{{ t('products.eyebrow') }}</span>
      <h1 class="font-display text-4xl font-semibold mt-1">{{ t('products.title') }}</h1>
      <p class="text-gray-500 mt-2 max-w-xl">
        {{ t('products.subtitle') }}
      </p>
    </div>

    <div class="flex gap-8 items-start">

      <!-- ── Filter sidebar (desktop) ─────────────────────────────────────── -->
      <aside class="hidden lg:flex flex-col gap-6 w-64 shrink-0 sticky top-24">

        <!-- Price -->
        <div>
          <p class="font-mono text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">{{ t('products.price') }}</p>
          <div class="flex items-center gap-2">
            <input
              v-model="priceMinInput"
              type="number" min="0" :placeholder="t('products.min')"
              @keyup.enter="applyPriceRange"
              class="w-full border border-black/15 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-charcoal transition-colors bg-white"
            />
            <span class="text-gray-400 shrink-0">–</span>
            <input
              v-model="priceMaxInput"
              type="number" min="0" :placeholder="t('products.max')"
              @keyup.enter="applyPriceRange"
              class="w-full border border-black/15 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-charcoal transition-colors bg-white"
            />
          </div>
          <button
            type="button"
            @click="applyPriceRange"
            class="mt-2 w-full text-sm font-mono font-medium bg-charcoal text-white rounded-xl py-2 hover:bg-primary transition-colors"
          >
            {{ t('products.apply') }}
          </button>
        </div>

        <!-- Dynamic filter groups from API -->
        <div
          v-for="filter in catalog.connectFilters"
          :key="filter.key"
        >
          <p class="font-mono text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
            {{ filter.label }}
          </p>
          <div class="flex flex-col gap-2">
            <label
              v-for="option in visibleOptions(filter.key, filter.options)"
              :key="option.value"
              class="flex items-center gap-2.5 cursor-pointer group/opt"
            >
              <input
                type="checkbox"
                :checked="isActive(filter.key, option.value)"
                @change="toggleProperty(filter.key, option.value)"
                class="w-4 h-4 rounded accent-charcoal cursor-pointer shrink-0"
              />
              <span class="text-sm font-mono flex-1 group-hover/opt:text-charcoal transition-colors truncate">
                {{ option.value }}
              </span>
              <span class="text-xs font-mono text-gray-400 shrink-0">{{ option.count }}</span>
            </label>
          </div>
          <button
            v-if="filter.options.length > FILTER_INITIAL"
            type="button"
            @click="toggleExpand(filter.key)"
            class="mt-2 text-xs font-mono text-gray-400 hover:text-charcoal transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
              :class="['w-3 h-3 transition-transform', isExpanded(filter.key) ? 'rotate-180' : '']">
              <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
            </svg>
            {{ isExpanded(filter.key) ? t('products.showLess') : t('products.showMore', { n: filter.options.length - FILTER_INITIAL }) }}
          </button>
        </div>

        <!-- Filter skeleton -->
        <template v-if="catalog.connectLoading && !catalog.connectFilters.length">
          <div v-for="n in 4" :key="n" class="space-y-2">
            <div class="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            <div v-for="i in 4" :key="i" class="h-4 bg-gray-100 rounded animate-pulse" />
          </div>
        </template>

      </aside>

      <!-- ── Main content ──────────────────────────────────────────────────── -->
      <div class="flex-1 min-w-0">

        <!-- Search bar + mobile filter toggle -->
        <div class="flex gap-3 mb-5">
          <div class="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
            </svg>
            <input
              v-model="searchInput"
              type="search" :placeholder="t('products.searchPlaceholder')"
              class="w-full border border-black/15 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:border-charcoal transition-colors bg-white"
            />
          </div>
          <!-- Mobile filters button -->
          <button
            type="button"
            @click="showMobileFilters = !showMobileFilters"
            class="lg:hidden flex items-center gap-2 border border-black/15 rounded-xl px-4 py-2.5 text-sm font-mono hover:border-black/40 transition-colors bg-white shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
              <path d="M14 2H2a.75.75 0 0 0-.75.75v.5c0 .2.08.39.22.53L6 8.31V13a.75.75 0 0 0 1.14.64l3-1.75A.75.75 0 0 0 10.5 11V8.31l4.53-4.53c.14-.14.22-.33.22-.53v-.5A.75.75 0 0 0 14 2Z" />
            </svg>
            {{ t('products.filters') }}
            <span v-if="activeChips.length" class="bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {{ activeChips.length }}
            </span>
          </button>
        </div>

        <!-- Mobile filter panel -->
        <div v-if="showMobileFilters" class="lg:hidden bg-white border border-black/8 rounded-2xl p-5 mb-5 flex flex-col gap-6">
          <!-- Header -->
          <div class="flex items-center justify-between -mb-2">
            <p class="font-display font-semibold text-lg">{{ t('products.filters') }}</p>
            <button
              type="button"
              @click="showMobileFilters = false"
              :aria-label="t('compare.close')"
              class="w-8 h-8 -mr-1.5 flex items-center justify-center rounded-full text-gray-400 hover:text-charcoal hover:bg-black/6 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"/>
              </svg>
            </button>
          </div>
          <!-- Price -->
          <div>
            <p class="font-mono text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">{{ t('products.price') }}</p>
            <div class="flex items-center gap-2">
              <input v-model="priceMinInput" type="number" min="0" :placeholder="t('products.min')" @keyup.enter="applyPriceRange"
                class="w-full border border-black/15 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-charcoal transition-colors bg-white" />
              <span class="text-gray-400 shrink-0">–</span>
              <input v-model="priceMaxInput" type="number" min="0" :placeholder="t('products.max')" @keyup.enter="applyPriceRange"
                class="w-full border border-black/15 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-charcoal transition-colors bg-white" />
            </div>
            <button type="button" @click="applyPriceRange" class="mt-2 w-full text-sm font-mono font-medium bg-charcoal text-white rounded-xl py-2 hover:bg-primary transition-colors">
              {{ t('products.apply') }}
            </button>
          </div>
          <!-- Dynamic filters -->
          <div v-for="filter in catalog.connectFilters" :key="filter.key">
            <p class="font-mono text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">{{ filter.label }}</p>
            <div class="grid grid-cols-2 gap-2">
              <label v-for="option in visibleOptions(filter.key, filter.options)" :key="option.value" class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" :checked="isActive(filter.key, option.value)" @change="toggleProperty(filter.key, option.value)" class="w-4 h-4 rounded accent-charcoal cursor-pointer shrink-0" />
                <span class="text-sm font-mono truncate">{{ option.value }}</span>
                <span class="text-xs font-mono text-gray-400 ml-auto shrink-0">{{ option.count }}</span>
              </label>
            </div>
            <button
              v-if="filter.options.length > FILTER_INITIAL"
              type="button"
              @click="toggleExpand(filter.key)"
              class="mt-2 text-xs font-mono text-gray-400 hover:text-charcoal transition-colors flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                :class="['w-3 h-3 transition-transform', isExpanded(filter.key) ? 'rotate-180' : '']">
                <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
              </svg>
              {{ isExpanded(filter.key) ? t('products.showLess') : t('products.showMore', { n: filter.options.length - FILTER_INITIAL }) }}
            </button>
          </div>

          <!-- Footer actions -->
          <div class="flex items-center gap-3 pt-4 border-t border-black/6">
            <button
              v-if="activeChips.length"
              type="button"
              @click="router.push({ query: { q: route.query.q } })"
              class="text-sm font-mono text-gray-400 hover:text-red-500 transition-colors"
            >
              {{ t('products.clearAll') }}
            </button>
            <button
              type="button"
              @click="showMobileFilters = false"
              class="ml-auto bg-charcoal text-white font-mono font-medium text-sm px-5 py-2.5 rounded-xl hover:bg-primary transition-colors"
            >
              {{ t('products.done') }}
            </button>
          </div>
        </div>

        <!-- Active chips + result count -->
        <div v-if="activeChips.length || !catalog.connectLoading" class="flex flex-wrap items-center gap-2 mb-6">
          <span class="text-sm font-mono text-gray-500 mr-1">
            {{ t('products.resultCount', catalog.connectPagination.total) }}
          </span>
          <button
            v-for="chip in activeChips"
            :key="chip.label"
            type="button"
            @click="chip.onRemove()"
            class="inline-flex items-center gap-1.5 bg-charcoal text-white text-xs font-mono rounded-full px-3 py-1 hover:bg-primary transition-colors"
          >
            {{ chip.label }}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" class="w-3 h-3">
              <path d="M6.53 6l2.735-2.734a.375.375 0 1 0-.53-.531L6 5.47 3.265 2.735a.375.375 0 1 0-.53.531L5.47 6 2.735 8.734a.375.375 0 1 0 .531.531L6 6.53l2.734 2.735a.375.375 0 1 0 .531-.531L6.53 6Z" />
            </svg>
          </button>
          <button
            v-if="activeChips.length > 1"
            type="button"
            @click="router.push({ query: { q: route.query.q } })"
            class="text-xs font-mono text-gray-400 hover:text-red-500 transition-colors underline"
          >
            {{ t('products.clearAll') }}
          </button>
        </div>

        <!-- Initial loading skeleton (first page only) -->
        <div v-if="catalog.connectLoading && !allProducts.length" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <div v-for="n in 6" :key="n" class="rounded-2xl overflow-hidden border border-black/8 bg-white">
            <div class="aspect-[3/4] bg-gray-100 animate-pulse" />
            <div class="p-4 space-y-2">
              <div class="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
              <div class="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
              <div class="h-8 bg-gray-100 rounded-xl animate-pulse mt-3" />
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="!allProducts.length && !catalog.connectLoading" class="py-24 text-center">
          <p class="font-mono text-gray-400 mb-3">{{ t('products.emptyTitle') }}</p>
          <button type="button" @click="router.push({ path: route.path })" class="text-sm font-mono underline text-gray-500 hover:text-charcoal transition-colors">
            {{ t('products.clearAllFilters') }}
          </button>
        </div>

        <!-- Product grid (accumulated) -->
        <div v-else>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            <ProductCard
              v-for="product in allProducts"
              :key="product.id"
              :product="product"
            />
            <!-- Skeleton cards appended while loading next page -->
            <template v-if="catalog.connectLoading && allProducts.length">
              <div v-for="n in 3" :key="`sk-${n}`" class="rounded-2xl overflow-hidden border border-black/8 bg-white">
                <div class="aspect-[3/4] bg-gray-100 animate-pulse" />
                <div class="p-4 space-y-2">
                  <div class="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                  <div class="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
                  <div class="h-8 bg-gray-100 rounded-xl animate-pulse mt-3" />
                </div>
              </div>
            </template>
          </div>

          <!-- Sentinel (triggers next page load) -->
          <div ref="sentinel" class="h-px mt-10" />

          <!-- End-of-results message -->
          <p v-if="!hasMore && allProducts.length" class="text-center font-mono text-xs text-gray-300 mt-6">
            {{ t('products.allLoaded', { n: catalog.connectPagination.total }) }}
          </p>
        </div>

      </div>
    </div>
  </div>
</template>
