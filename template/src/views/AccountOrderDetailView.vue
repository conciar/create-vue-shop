<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useCustomerStore } from '@/stores/customer'
import { conciarApi } from '@/api/conciar'
import type {
  ConciarCustomerOrderDetail,
  ConciarCustomerCreditNote,
  ConciarCustomerCreditNoteLine,
} from '@/api/conciar-types'

const route    = useRoute()
const router   = useRouter()
const customer = useCustomerStore()

const order   = ref<ConciarCustomerOrderDetail | null>(null)
const loading = ref(true)
const error   = ref(false)

const reference = route.params.reference as string

onMounted(async () => {
  try {
    order.value = await conciarApi.customerOrders.get(customer.accessToken!, reference)
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
    else error.value = true
  } finally {
    loading.value = false
  }
})

const productLines = computed(() => order.value?.lines.filter(l => l.type.name === 'product') ?? [])
const shippingLine = computed(() => order.value?.lines.find(l => l.type.name === 'shipping') ?? null)
const feeLines     = computed(() => order.value?.lines.filter(l => l.type.name === 'payment_fee') ?? [])

// The customer-order price rows expose only a numeric `type_id` (no named type),
// so we rely on the API's documented row order: subtotal first, grand total last.
// (The order-create response in OrderConfirmationView carries `type.name` and is
// matched by name there; this endpoint can't be.)
const subtotalDisplay = computed(() => order.value?.prices[0]?.display_price ?? null)
const totalDisplay    = computed(() => order.value?.prices.at(-1)?.display_price ?? null)

const transaction = computed(() => order.value?.invoice?.transactions?.[0] ?? null)

// Credit notes (refunds). Each line carries unit_price + total_price rows; the line total
// is 'total_price' (unit × qty), falling back to unit_price for safety.
const creditNotes = computed(() => order.value?.credit_notes ?? [])

function creditLineTotal(line: ConciarCustomerCreditNoteLine) {
  return line.prices.find(p => p.type?.name === 'total_price')
      ?? line.prices.find(p => p.type?.name === 'unit_price')
      ?? line.prices[0] ?? null
}

// Refunded total for a credit note = sum of its line totals, formatted like the payment
// amount above (the storefront is EUR-only).
function creditNoteTotal(cn: ConciarCustomerCreditNote): string {
  const sum = cn.lines.reduce((acc, l) => acc + (parseFloat(creditLineTotal(l)?.amount ?? '0') || 0), 0)
  return '€ ' + sum.toFixed(2).replace('.', ',')
}

function formatCountryName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<template>
  <div class="bg-cream min-h-screen">
    <div class="max-w-2xl mx-auto px-6 py-12">

      <RouterLink :to="{ name: 'orders' }" class="inline-flex items-center gap-1.5 text-sm font-mono text-gray-400 hover:text-charcoal transition-colors mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
          <path fill-rule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd"/>
        </svg>
        Mijn bestellingen
      </RouterLink>

      <!-- Skeleton -->
      <div v-if="loading" class="bg-white rounded-2xl border border-black/8 p-8 animate-pulse space-y-4">
        <div class="h-7 w-36 bg-gray-100 rounded" />
        <div class="h-4 w-24 bg-gray-100 rounded" />
        <div class="h-px bg-gray-100 my-4" />
        <div v-for="n in 3" :key="n" class="h-10 bg-gray-100 rounded" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-16">
        <p class="font-mono text-gray-400 mb-3">Bestelling niet gevonden.</p>
        <RouterLink :to="{ name: 'orders' }" class="text-sm font-mono text-primary hover:underline">Terug naar bestellingen</RouterLink>
      </div>

      <!-- Detail -->
      <div v-else-if="order" class="bg-white rounded-2xl border border-black/8 overflow-hidden">

        <!-- Header -->
        <div class="p-6 border-b border-black/8 flex items-start justify-between gap-4">
          <div>
            <h1 class="font-display text-2xl font-semibold">{{ order.reference }}</h1>
            <p class="font-mono text-xs text-gray-400 mt-1">{{ formatDate(order.created_at) }}</p>
          </div>
          <span
            class="shrink-0 font-mono text-xs font-semibold px-3 py-1.5 rounded-full border capitalize mt-1"
            :style="order.status.color
              ? { borderColor: order.status.color + '40', color: order.status.color, backgroundColor: order.status.color + '15' }
              : {}"
          >
            {{ order.status.name }}
          </span>
        </div>

        <!-- Product lines -->
        <div class="p-6 flex flex-col gap-3">
          <div v-for="line in productLines" :key="line.id" class="flex items-center justify-between gap-4">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ line.name }}</p>
              <p class="font-mono text-xs text-gray-400">× {{ line.qty }}</p>
            </div>
            <span class="font-mono text-sm font-medium shrink-0">
              {{ line.prices[0]?.display_price ?? '–' }}
            </span>
          </div>
        </div>

        <!-- Totals -->
        <div class="border-t border-black/8 px-6 py-5 flex flex-col gap-2.5 text-sm">
          <div v-if="subtotalDisplay" class="flex justify-between text-gray-500">
            <span>Subtotaal</span>
            <span class="font-mono">{{ subtotalDisplay }}</span>
          </div>

          <div v-if="shippingLine" class="flex justify-between text-gray-500">
            <span>{{ shippingLine.name }}</span>
            <span class="font-mono" :class="shippingLine.prices[0]?.amount === '0.00' ? 'text-green-600' : ''">
              {{ shippingLine.prices[0]?.amount === '0.00' ? 'Gratis' : shippingLine.prices[0]?.display_price ?? '–' }}
            </span>
          </div>

          <div v-for="fee in feeLines" :key="fee.id" class="flex justify-between text-gray-500">
            <span>{{ fee.name }}</span>
            <span class="font-mono">{{ fee.prices[0]?.display_price ?? '–' }}</span>
          </div>

          <div v-if="totalDisplay" class="flex justify-between font-mono font-semibold text-base pt-3 border-t border-black/8 mt-1">
            <span>Totaal</span>
            <span>{{ totalDisplay }}</span>
          </div>
        </div>

        <!-- Customer notes -->
        <div v-if="order.customer_notes" class="border-t border-black/8 px-6 py-4">
          <p class="font-mono text-xs text-gray-400 uppercase tracking-wider mb-1">Opmerking</p>
          <p class="text-sm text-gray-600">{{ order.customer_notes }}</p>
        </div>

        <!-- Addresses + payment -->
        <div class="border-t border-black/8 grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-black/8">

          <!-- Shipping address -->
          <div v-if="order.address" class="px-6 py-5">
            <p class="font-mono text-xs text-gray-400 uppercase tracking-wider mb-3">Bezorgadres</p>
            <div class="text-sm text-gray-700 leading-relaxed space-y-0.5">
              <p v-if="order.address.street">
                {{ order.address.street }} {{ order.address.house_number }}
                <span v-if="order.address.apartment"> {{ order.address.apartment }}</span>
              </p>
              <p>{{ order.address.zipcode }} {{ order.address.city }}</p>
              <p v-if="order.address.state" class="text-gray-500">{{ order.address.state }}</p>
              <p v-if="order.address.country" class="text-gray-500">{{ formatCountryName(order.address.country.name) }}</p>
            </div>
          </div>

          <!-- Billing address (only shown when different from shipping) -->
          <div
            v-if="order.billing_address && (order.billing_address.street !== order.address?.street || order.billing_address.city !== order.address?.city)"
            class="px-6 py-5 border-t sm:border-t-0 sm:border-l border-black/8 col-span-2 sm:col-span-1"
          >
            <p class="font-mono text-xs text-gray-400 uppercase tracking-wider mb-3">Factuuradres</p>
            <div class="text-sm text-gray-700 leading-relaxed space-y-0.5">
              <p v-if="order.billing_address.street">
                {{ order.billing_address.street }} {{ order.billing_address.house_number }}
                <span v-if="order.billing_address.apartment"> {{ order.billing_address.apartment }}</span>
              </p>
              <p>{{ order.billing_address.zipcode }} {{ order.billing_address.city }}</p>
              <p v-if="order.billing_address.state" class="text-gray-500">{{ order.billing_address.state }}</p>
              <p v-if="order.billing_address.country" class="text-gray-500">{{ formatCountryName(order.billing_address.country.name) }}</p>
            </div>
          </div>

          <!-- Payment -->
          <div v-if="transaction" class="px-6 py-5">
            <p class="font-mono text-xs text-gray-400 uppercase tracking-wider mb-3">Betaling</p>
            <div class="flex items-center gap-3 mb-3">
              <img
                v-if="transaction.payment_method?.logo"
                :src="transaction.payment_method.logo"
                :alt="transaction.payment_method.name"
                class="h-5 w-auto object-contain"
              />
              <p class="text-sm font-medium">{{ transaction.payment_method?.name ?? '–' }}</p>
            </div>
            <div class="flex items-center justify-between">
              <span
                class="font-mono text-xs font-semibold px-2.5 py-1 rounded-full border capitalize"
                :style="transaction.status.color
                  ? { borderColor: transaction.status.color + '40', color: transaction.status.color, backgroundColor: transaction.status.color + '15' }
                  : {}"
              >
                {{ transaction.status.name }}
              </span>
              <span class="font-mono text-sm font-semibold">€ {{ parseFloat(transaction.amount).toFixed(2).replace('.', ',') }}</span>
            </div>
            <p v-if="transaction.paid_at" class="font-mono text-xs text-gray-400 mt-2">
              Betaald op {{ formatDate(transaction.paid_at) }}
            </p>
          </div>

        </div>

        <!-- Refunds / credit notes -->
        <div v-if="creditNotes.length" class="border-t border-black/8 px-6 py-5">
          <p class="font-mono text-xs text-gray-400 uppercase tracking-wider mb-4">Terugbetalingen</p>

          <div v-for="cn in creditNotes" :key="cn.id" class="mb-5 last:mb-0">
            <div class="flex items-center justify-between gap-2 mb-1">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-mono text-[11px] font-semibold px-2.5 py-1 rounded-full border border-green-600/30 text-green-700 bg-green-600/10 shrink-0">
                  Terugbetaald
                </span>
                <span class="font-mono text-xs text-gray-400 truncate">{{ cn.reference }}</span>
              </div>
              <span class="font-mono text-sm font-semibold text-green-700 shrink-0">{{ creditNoteTotal(cn) }}</span>
            </div>
            <p class="font-mono text-[11px] text-gray-400 mb-2">{{ formatDate(cn.created_at) }}</p>

            <div class="space-y-1">
              <div v-for="l in cn.lines" :key="l.id" class="flex justify-between gap-2 text-xs text-gray-500">
                <span class="truncate">{{ l.name }} <span class="text-gray-400">× {{ l.quantity }}</span></span>
                <span class="font-mono shrink-0">{{ creditLineTotal(l)?.display_price ?? '–' }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
