<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { ConciarCreatedOrder } from '@/api/conciar-types'

const { t } = useI18n()
const route = useRoute()
const reference = route.params.reference as string

// Order data is passed via router state — may be absent if the user refreshes
const order = computed<ConciarCreatedOrder | null>(() => {
  const s = (history.state as { order?: ConciarCreatedOrder })
  return s?.order ?? null
})

const productLines = computed(() => order.value?.lines.filter(l => l.type.name === 'product') ?? [])
// Automatic promotions, applied server-side — one negative line per promotion.
const promotionLines = computed(() => order.value?.lines.filter(l => l.type.name === 'promotion_discount') ?? [])
const shippingLine = computed(() => order.value?.lines.find(l => l.type.name === 'shipping') ?? null)
const feeLine      = computed(() => order.value?.lines.find(l => l.type.name === 'payment_fee') ?? null)

// Prefer the net row (total_ex_tax) for the subtotal; fall back to the legacy
// subtotal row when the order carries no tax. tax_total renders its own line.
const subtotal = computed(() =>
  order.value?.prices.find(p => p.type.name === 'total_ex_tax')?.amount
  ?? order.value?.prices.find(p => p.type.name === 'subtotal')?.amount
  ?? null,
)
const taxTotal = computed(() => order.value?.prices.find(p => p.type.name === 'total_tax')?.amount ?? null)
const total    = computed(() => order.value?.prices.find(p => p.type.name === 'total_price')?.amount ?? null)
// One row per applied coupon (negative); total_price is already net of these.
const couponDiscounts = computed(() => order.value?.prices.filter(p => p.type.name === 'coupon_discount') ?? [])

function formatAmount(amount: string) {
  return `€ ${parseFloat(amount).toFixed(2).replace('.', ',')}`
}
function formatDiscount(amount: string) {
  return `− € ${Math.abs(parseFloat(amount)).toFixed(2).replace('.', ',')}`
}
</script>

<template>
  <div class="bg-cream min-h-screen py-16">
    <div class="max-w-2xl mx-auto px-6">

      <!-- Success header -->
      <div class="text-center mb-10">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-green-600">
            <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
          </svg>
        </div>
        <h1 class="font-display text-4xl font-semibold mb-2">{{ t('orderConfirmation.title') }}</h1>
        <p class="font-mono text-sm text-gray-400">{{ reference }}</p>
      </div>

      <!-- Check email banner -->
      <div class="bg-white border border-black/8 rounded-2xl px-6 py-4 flex items-start gap-4 mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-primary shrink-0 mt-0.5">
          <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z"/>
          <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z"/>
        </svg>
        <div>
          <p class="font-mono text-sm font-medium">{{ t('orderConfirmation.checkEmail') }}</p>
          <p class="text-sm text-gray-500 mt-0.5">{{ t('orderConfirmation.checkEmailDesc') }}</p>
        </div>
      </div>

      <!-- Order detail card (shown when order data is available via router state) -->
      <div v-if="order" class="bg-white border border-black/8 rounded-2xl overflow-hidden mb-6">

        <!-- Product lines -->
        <div class="p-6 flex flex-col gap-3">
          <p class="font-mono text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{{ t('orderConfirmation.itemsOrdered') }}</p>
          <div v-for="line in productLines" :key="line.name" class="flex items-center justify-between gap-4">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ line.name }}</p>
              <p class="font-mono text-xs text-gray-400">× {{ line.qty }}</p>
            </div>
            <span class="font-mono text-sm font-medium shrink-0">
              {{ formatAmount(String(parseFloat(line.prices[0]?.amount ?? '0') * line.qty)) }}
            </span>
          </div>
        </div>

        <!-- Totals -->
        <div class="border-t border-black/6 px-6 py-5 flex flex-col gap-2.5 text-sm">
          <div v-if="subtotal" class="flex justify-between text-gray-500">
            <span>{{ t('orderConfirmation.subtotal') }}</span>
            <span class="font-mono">{{ formatAmount(subtotal) }}</span>
          </div>

          <!-- Automatic promotion discounts (applied server-side) -->
          <div v-for="(line, i) in promotionLines" :key="`promo-${i}`" class="flex justify-between text-green-600 font-medium">
            <span class="truncate">{{ line.name ?? t('orderConfirmation.discount') }}</span>
            <span class="font-mono shrink-0">{{ formatDiscount(line.prices[0]?.amount ?? '0') }}</span>
          </div>

          <div v-for="(line, i) in couponDiscounts" :key="i" class="flex justify-between text-green-600 font-medium">
            <span class="truncate">{{ line.name ?? t('orderConfirmation.discount') }}</span>
            <span class="font-mono shrink-0">{{ formatDiscount(line.amount) }}</span>
          </div>

          <div v-if="shippingLine" class="flex justify-between text-gray-500">
            <span>{{ shippingLine.name }}</span>
            <span :class="['font-mono', parseFloat(shippingLine.prices[0]?.amount ?? '1') === 0 ? 'text-green-600' : '']">
              {{ parseFloat(shippingLine.prices[0]?.amount ?? '1') === 0 ? t('orderConfirmation.free') : formatAmount(shippingLine.prices[0]?.amount ?? '0') }}
            </span>
          </div>

          <div v-if="feeLine" class="flex justify-between text-gray-500">
            <span>{{ feeLine.name }}</span>
            <span class="font-mono">{{ formatAmount(feeLine.prices[0]?.amount ?? '0') }}</span>
          </div>

          <div v-if="taxTotal && parseFloat(taxTotal) > 0" class="flex justify-between text-gray-500">
            <span>{{ t('orderConfirmation.tax') }}</span>
            <span class="font-mono">{{ formatAmount(taxTotal) }}</span>
          </div>

          <div v-if="total" class="flex justify-between font-mono font-semibold text-base pt-3 border-t border-black/6 mt-1">
            <span>{{ t('orderConfirmation.total') }}</span>
            <span>{{ formatAmount(total) }}</span>
          </div>
        </div>
      </div>

      <!-- Fallback when no order data (page refresh) -->
      <div v-else class="bg-white border border-black/8 rounded-2xl p-6 text-center mb-6">
        <i18n-t keypath="orderConfirmation.placed" tag="p" class="text-sm text-gray-500">
          <template #reference><span class="font-mono font-medium text-charcoal">{{ reference }}</span></template>
        </i18n-t>
        <p class="text-sm text-gray-400 mt-1">{{ t('orderConfirmation.placedDesc') }}</p>
      </div>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-3">
        <RouterLink
          to="/orders"
          class="flex-1 text-center bg-charcoal text-white font-mono font-medium px-6 py-3.5 rounded-xl hover:bg-primary transition-colors text-sm"
        >
          {{ t('orderConfirmation.viewMyOrders') }}
        </RouterLink>
        <RouterLink
          to="/products"
          class="flex-1 text-center border border-black/15 font-mono font-medium px-6 py-3.5 rounded-xl hover:border-black/40 transition-colors text-sm"
        >
          {{ t('orderConfirmation.continueShopping') }}
        </RouterLink>
      </div>

    </div>
  </div>
</template>
