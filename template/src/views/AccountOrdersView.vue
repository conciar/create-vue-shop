<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCustomerStore } from '@/stores/customer'
import { conciarApi } from '@/api/conciar'
import type { ConciarCustomerOrder, ConciarCustomerOrdersData, ConciarCustomerOrderLine } from '@/api/conciar-types'

const { t } = useI18n()
const router   = useRouter()
const customer = useCustomerStore()

const orders  = ref<ConciarCustomerOrder[]>([])
const pagination = ref<Omit<ConciarCustomerOrdersData, 'data'> | null>(null)
const loading = ref(true)
const page    = ref(1)

async function fetchOrders(p = 1) {
  loading.value = true
  try {
    const res = await conciarApi.customerOrders.list(customer.accessToken!, { page: p, per_page: 10 })
    orders.value    = res.data
    pagination.value = { current_page: res.current_page, last_page: res.last_page, per_page: res.per_page, total: res.total }
    page.value = p
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchOrders())

// Last price entry in the array is the grand total
function totalDisplay(order: ConciarCustomerOrder) {
  return order.prices.at(-1)?.display_price ?? '–'
}

function productLines(order: ConciarCustomerOrder): ConciarCustomerOrderLine[] {
  return order.lines.filter(l => l.type.name === 'product')
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<template>
  <div class="bg-cream min-h-screen">
    <div class="max-w-3xl mx-auto px-6 py-12">

      <div class="mb-8">
        <span class="font-mono text-xs tracking-[0.2em] uppercase text-gray-400">{{ t('account.eyebrow') }}</span>
        <h1 class="font-display text-4xl font-semibold mt-1">{{ t('account.orders.title') }}</h1>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="flex flex-col gap-4">
        <div v-for="n in 4" :key="n" class="bg-white rounded-2xl h-24 border border-black/8 animate-pulse" />
      </div>

      <!-- Empty -->
      <div v-else-if="!orders.length" class="py-20 text-center">
        <p class="font-mono text-gray-400 mb-4">{{ t('account.orders.empty') }}</p>
        <RouterLink to="/products" class="text-sm font-mono text-primary hover:underline">{{ t('account.orders.browse') }}</RouterLink>
      </div>

      <!-- List -->
      <div v-else class="flex flex-col gap-3">
        <RouterLink
          v-for="order in orders"
          :key="order.id"
          :to="{ name: 'order-detail', params: { reference: order.reference } }"
          class="bg-white border border-black/8 rounded-2xl p-5 flex items-center gap-4 hover:border-black/20 hover:shadow-sm transition-all group"
        >
          <!-- Reference + date -->
          <div class="flex-1 min-w-0">
            <p class="font-mono text-sm font-semibold text-charcoal">{{ order.reference }}</p>
            <p class="font-mono text-xs text-gray-400 mt-0.5">{{ formatDate(order.created_at) }}</p>
          </div>

          <!-- Status badge -->
          <span
            class="shrink-0 font-mono text-xs font-semibold px-2.5 py-1 rounded-full border capitalize"
            :style="order.status.color ? { borderColor: order.status.color + '40', color: order.status.color, backgroundColor: order.status.color + '15' } : {}"
          >
            {{ order.status.name }}
          </span>

          <!-- Product summary -->
          <p class="shrink-0 font-mono text-xs text-gray-400 hidden sm:block">
            {{ t('account.orders.itemCount', productLines(order).length) }}
          </p>

          <!-- Total -->
          <p class="shrink-0 font-mono text-sm font-semibold">{{ totalDisplay(order) }}</p>

          <!-- Chevron -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
            class="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0">
            <path fill-rule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
          </svg>
        </RouterLink>
      </div>

      <!-- Pagination -->
      <div v-if="pagination && pagination.last_page > 1" class="flex items-center justify-center gap-2 mt-8">
        <button
          :disabled="page <= 1"
          @click="fetchOrders(page - 1)"
          class="w-9 h-9 flex items-center justify-center rounded-xl border border-black/15 font-mono text-sm hover:border-black/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >‹</button>
        <span class="font-mono text-sm text-gray-500">{{ page }} / {{ pagination.last_page }}</span>
        <button
          :disabled="page >= pagination.last_page"
          @click="fetchOrders(page + 1)"
          class="w-9 h-9 flex items-center justify-center rounded-xl border border-black/15 font-mono text-sm hover:border-black/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >›</button>
      </div>

    </div>
  </div>
</template>
