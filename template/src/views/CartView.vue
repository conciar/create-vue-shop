<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCartStore } from '@/stores/cart'
import { useStoreConfigStore } from '@/stores/storeConfig'
import { useCountriesStore, formatCountryName } from '@/stores/countries'
import { useCoupon } from '@/composables/useCoupon'
import PromoBadge from '@/components/promo/PromoBadge.vue'

const { t } = useI18n()
const cart        = useCartStore()
const {
  code: couponCode,
  loading: couponLoading,
  error: couponError,
  stackable: couponsStackable,
  apply: applyCoupon,
  remove: removeCoupon,
} = useCoupon()
const storeConfig = useStoreConfigStore()
const countries   = useCountriesStore()
const router      = useRouter()

const COUNTRY_KEY = 'cellier_cart_country'
const selectedCountry = ref<string>(localStorage.getItem(COUNTRY_KEY) ?? '')

function onCountryChange(iso: string) {
  selectedCountry.value = iso
  localStorage.setItem(COUNTRY_KEY, iso)
}

onMounted(() => countries.fetch())

// Free-shipping progress is driven by the cart response (cart.totals.free_shipping),
// recomputed server-side on every change. null = no offer → hide the bar.
const freeShipping = computed(() => cart.freeShipping)
const showFreeShipping = computed(() => !!freeShipping.value && freeShipping.value.threshold > 0)
const freeShippingProgress = computed(() => {
  const fs = freeShipping.value
  if (!fs || fs.threshold <= 0) return 0
  if (fs.qualified) return 100
  return Math.min(100, Math.max(0, (1 - fs.remaining / fs.threshold) * 100))
})

// Shipping line in the summary: free once the cart qualifies, else TBD at checkout
const shippingEstimate = computed(() =>
  freeShipping.value?.qualified
    ? { label: t('cart.free'), free: true }
    : { label: t('cart.calculatedAtCheckout'), free: false }
)

// Preview total from the server money summary (subtotal − discount, no shipping)
const total = computed(() => cart.total)

const shipsToCountries = computed(() => {
  const allowed = storeConfig.supportedCountries
  const source = allowed.length
    ? countries.countries.filter(c => allowed.includes(c.iso_code_2.toUpperCase()))
    : countries.countries
  return source
    .map(c => ({ iso: c.iso_code_2.toUpperCase(), name: formatCountryName(c.name) }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

const selectedCountryName = computed(() =>
  shipsToCountries.value.find(c => c.iso === selectedCountry.value)?.name ?? null
)
</script>

<template>
  <div class="bg-cream min-h-screen">
    <div class="max-w-5xl mx-auto px-6 py-12 pb-28 lg:pb-12">

      <!-- Header -->
      <div class="flex items-baseline justify-between mb-10">
        <div>
          <h1 class="font-display text-4xl font-semibold">{{ t('cart.title') }}</h1>
          <p v-if="cart.items.length" class="font-mono text-sm text-gray-400 mt-1">
            {{ t('cart.itemCount', cart.count) }}
          </p>
        </div>
        <RouterLink to="/products" class="font-mono text-sm text-gray-400 hover:text-charcoal transition-colors flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
            <path fill-rule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd"/>
          </svg>
          {{ t('cart.continueShopping') }}
        </RouterLink>
      </div>

      <!-- ── Empty state ─────────────────────────────────────────────────── -->
      <div v-if="!cart.items.length" class="py-24 flex flex-col items-center gap-6 text-center">
        <div class="w-20 h-20 rounded-full bg-white border border-black/8 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" class="w-10 h-10 text-gray-300">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3h6M9 3v3.5c0 .5-.2 1-.5 1.4L6 11v9a1 1 0 001 1h10a1 1 0 001-1v-9l-2.5-3.1c-.3-.4-.5-.9-.5-1.4V3M9 3h6"/>
          </svg>
        </div>
        <div>
          <p class="font-display text-2xl font-semibold mb-1">{{ t('cart.empty.title') }}</p>
          <p class="text-gray-400 text-sm">{{ t('cart.empty.subtitle') }}</p>
        </div>
        <RouterLink
          to="/products"
          class="bg-charcoal text-white font-mono font-medium text-sm px-6 py-3 rounded-xl hover:bg-primary transition-colors"
        >
          {{ t('cart.empty.browse') }}
        </RouterLink>
      </div>

      <!-- ── Cart content ────────────────────────────────────────────────── -->
      <div v-else class="grid lg:grid-cols-[1fr_360px] gap-8 items-start">

        <!-- LEFT: Items -->
        <div class="flex flex-col gap-3">
          <TransitionGroup name="list" tag="div" class="flex flex-col gap-3">
            <div
              v-for="item in cart.items"
              :key="item.id"
              class="bg-white rounded-2xl border border-black/8 p-5 flex gap-5"
            >
              <!-- Image -->
              <RouterLink :to="`/product/${item.id}/${item.product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`"
                class="shrink-0 w-16 h-22 rounded-xl overflow-hidden bg-cream border border-black/6 flex items-center justify-center"
                style="height: 88px"
              >
                <img
                  v-if="item.product.image"
                  :src="item.product.image"
                  :alt="item.product.name"
                  class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
                <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 text-gray-300">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 3h6M9 3v3.5c0 .5-.2 1-.5 1.4L6 11v9a1 1 0 001 1h10a1 1 0 001-1v-9l-2.5-3.1c-.3-.4-.5-.9-.5-1.4V3M9 3h6"/>
                </svg>
              </RouterLink>

              <!-- Info -->
              <div class="flex-1 min-w-0 flex flex-col gap-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-display font-semibold leading-snug">{{ item.product.name }}</p>

                    <!-- Subscription badge -->
                    <span v-if="item.type === 'subscription'"
                      class="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full mt-1.5 bg-primary/8 text-primary border border-primary/15">
                      ↻ {{ item.interval ?? t('cart.subscriptionBadge') }}
                    </span>

                    <!-- One-time badge -->
                    <span v-else
                      class="inline-flex items-center gap-1 font-mono text-xs font-medium px-2.5 py-0.5 rounded-full mt-1.5 bg-gray-100 text-gray-500">
                      {{ t('cart.oneTime') }}
                    </span>

                    <!-- Automatic promotion badges -->
                    <PromoBadge :rules="item.product.priceRules" class="mt-1.5" />
                  </div>
                  <p class="font-mono font-semibold shrink-0 text-base">
                    {{ cart.formatMoney(item.price * item.quantity) }}
                  </p>
                </div>

                <div class="flex items-center justify-between">
                  <!-- Quantity stepper -->
                  <div class="flex items-center gap-0 bg-cream rounded-xl border border-black/10 overflow-hidden">
                    <button
                      @click="cart.updateQty(item.id, item.quantity - 1, item.type)"
                      class="w-9 h-9 flex items-center justify-center hover:bg-black/6 transition-colors text-lg font-mono leading-none"
                      :disabled="item.quantity <= 1"
                    >−</button>
                    <span class="w-9 text-center font-mono text-sm font-medium">{{ item.quantity }}</span>
                    <button
                      @click="cart.updateQty(item.id, item.quantity + 1, item.type)"
                      class="w-9 h-9 flex items-center justify-center hover:bg-black/6 transition-colors text-lg font-mono leading-none"
                    >+</button>
                  </div>

                  <div class="flex items-center gap-4">
                    <span class="font-mono text-xs text-gray-400">
                      {{ cart.formatMoney(item.price) }}{{ item.type === 'subscription' && item.interval ? ` / ${item.interval.toLowerCase().replace('every ', '')}` : ` ${t('cart.each')}` }}
                    </span>
                    <button
                      @click="cart.remove(item.id, item.type)"
                      class="text-gray-300 hover:text-red-400 transition-colors"
                      :title="t('cart.remove')"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                        <path fill-rule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clip-rule="evenodd"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </TransitionGroup>

          <!-- Free shipping progress (server-driven; hidden when no offer) -->
          <template v-if="showFreeShipping && freeShipping">
            <div v-if="freeShipping.qualified" class="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-green-500 shrink-0">
                <path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd"/>
              </svg>
              <p class="font-mono text-xs text-green-700 font-medium">{{ t('cart.freeShippingUnlocked') }}</p>
            </div>
            <div v-else class="bg-white rounded-2xl border border-black/8 px-5 py-4">
              <div class="flex items-center justify-between mb-2">
                <i18n-t keypath="cart.addForFreeShipping" tag="p" class="font-mono text-xs text-gray-500">
                  <template #amount><span class="font-semibold text-charcoal">{{ cart.formatMoney(freeShipping.remaining) }}</span></template>
                </i18n-t>
                <p class="font-mono text-xs text-gray-400">{{ cart.formatMoney(freeShipping.threshold) }}</p>
              </div>
              <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary rounded-full transition-all duration-500"
                  :style="{ width: `${freeShippingProgress}%` }"
                />
              </div>
            </div>
          </template>
        </div>

        <!-- RIGHT: Summary -->
        <div class="lg:sticky lg:top-24 flex flex-col gap-4">

          <!-- Summary card -->
          <div class="bg-white rounded-2xl border border-black/8 overflow-hidden">

            <!-- Delivery destination -->
            <div class="px-6 pt-6 pb-5 border-b border-black/6">
              <label class="font-mono text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2.5">
                {{ t('cart.deliverTo') }}
              </label>
              <div v-if="countries.loading" class="h-10 bg-cream rounded-xl animate-pulse" />
              <select
                v-else
                :value="selectedCountry"
                @change="onCountryChange(($event.target as HTMLSelectElement).value)"
                class="w-full border border-black/15 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-charcoal transition-colors bg-white"
              >
                <option value="" disabled>{{ t('cart.selectCountry') }}</option>
                <option v-for="c in shipsToCountries" :key="c.iso" :value="c.iso">
                  {{ c.name }}
                </option>
              </select>
            </div>

            <!-- Line items -->
            <div class="px-6 py-5 flex flex-col gap-3 text-sm">
              <div class="flex justify-between text-gray-500">
                <span>{{ t('cart.subtotal') }}</span>
                <span class="font-mono font-medium text-charcoal">{{ cart.formatMoney(cart.subtotal) }}</span>
              </div>

              <div v-if="cart.discountAmount > 0" class="flex justify-between text-green-600 font-medium">
                <span>{{ t('cart.discount') }}</span>
                <span class="font-mono">-{{ cart.formatMoney(cart.discountAmount) }}</span>
              </div>

              <div class="flex justify-between text-gray-500">
                <span>{{ selectedCountryName ? t('cart.shippingTo', { country: selectedCountryName }) : t('cart.shipping') }}</span>
                <span :class="['font-mono font-medium', shippingEstimate.free ? 'text-green-600' : 'text-charcoal']">
                  {{ shippingEstimate.label }}
                </span>
              </div>

              <p class="font-mono text-xs text-gray-400 -mt-1">
                {{ t('cart.exactShipping') }}
              </p>
            </div>

            <!-- Coupon codes -->
            <div class="px-6 pb-5 border-t border-black/6 pt-5">
              <!-- Applied coupons -->
              <div v-if="cart.appliedCoupons.length" class="flex flex-col gap-2 mb-3">
                <div
                  v-for="c in cart.appliedCoupons"
                  :key="c.code"
                  class="flex items-center justify-between text-sm text-green-600 bg-green-50 rounded-xl px-3 py-2.5 border border-green-200"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 shrink-0">
                      <path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" />
                    </svg>
                    <span class="font-medium shrink-0">{{ c.code }}</span>
                    <span v-if="c.default_info?.name" class="text-green-500/90 truncate">{{ c.default_info.name }}</span>
                    <span v-if="c.discount_percentage != null" class="text-green-500 shrink-0">(-{{ c.discount_percentage }}%)</span>
                  </div>
                  <button type="button" @click="removeCoupon(c.code)" class="text-green-400 hover:text-green-600 transition-colors text-xs font-mono shrink-0 ml-2">
                    {{ t('cart.remove') }}
                  </button>
                </div>
              </div>

              <!-- Code input — hidden once a coupon is applied unless stacking is on -->
              <div v-if="couponsStackable || !cart.appliedCoupons.length">
                <div class="flex gap-2">
                  <input
                    v-model="couponCode"
                    type="text"
                    :placeholder="t('cart.couponCode')"
                    @keyup.enter="applyCoupon"
                    class="flex-1 border border-black/15 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-charcoal transition-colors bg-white min-w-0"
                  />
                  <button
                    type="button"
                    @click="applyCoupon"
                    :disabled="!couponCode.trim() || couponLoading"
                    class="shrink-0 bg-charcoal text-white text-sm font-mono font-medium px-4 py-2.5 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg v-if="couponLoading" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span v-else>{{ t('cart.apply') }}</span>
                  </button>
                </div>
                <p v-if="couponError" class="text-xs text-red-500 mt-2">{{ couponError }}</p>
              </div>
            </div>

            <!-- Total + CTA -->
            <div class="px-6 pb-6 flex flex-col gap-4 border-t border-black/6 pt-5">
              <div class="flex justify-between items-baseline">
                <span class="font-display font-semibold text-lg">{{ t('cart.total') }}</span>
                <div class="text-right">
                  <p class="font-mono font-semibold text-2xl">{{ cart.formatMoney(total) }}</p>
                  <p class="font-mono text-xs text-gray-400">
                    {{ t('cart.taxIncluded') }}<span v-if="!shippingEstimate.free"> · {{ t('cart.plusShipping') }}</span>
                  </p>
                </div>
              </div>

              <button
                @click="router.push('/checkout')"
                class="w-full bg-charcoal text-white font-mono font-medium py-4 rounded-xl hover:bg-primary transition-colors text-sm flex items-center justify-center gap-2"
              >
                {{ t('cart.proceedToCheckout') }}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                  <path fill-rule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clip-rule="evenodd"/>
                </svg>
              </button>

              <!-- Trust signals -->
              <div class="flex items-center justify-center gap-5 pt-1">
                <div class="flex items-center gap-1.5 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
                    <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd"/>
                  </svg>
                  <span class="font-mono text-xs">{{ t('cart.secureCheckout') }}</span>
                </div>
                <div class="flex items-center gap-1.5 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
                    <path d="M1 8.5A1.5 1.5 0 0 1 2.5 7h.26a.5.5 0 0 0 .44-.26l1.34-2.46A1.5 1.5 0 0 1 5.86 3.5h4.28a1.5 1.5 0 0 1 1.32.78l1.34 2.46a.5.5 0 0 0 .44.26h.26A1.5 1.5 0 0 1 15 8.5v4a.5.5 0 0 1-.5.5H14a2 2 0 0 1-4 0H6a2 2 0 0 1-4 0h-.5a.5.5 0 0 1-.5-.5v-4Z"/>
                  </svg>
                  <span class="font-mono text-xs">{{ t('cart.freeReturns') }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Mobile sticky checkout CTA -->
    <div
      v-if="cart.items.length"
      class="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-black/8 px-5 py-3.5 flex items-center gap-4"
    >
      <div class="min-w-0">
        <p class="font-mono text-lg font-semibold leading-none">{{ cart.formatMoney(total) }}</p>
        <p class="font-mono text-[11px] text-gray-400 mt-0.5">{{ t('cart.taxIncluded') }}</p>
      </div>
      <button
        @click="router.push('/checkout')"
        class="flex-1 bg-charcoal text-white font-mono font-medium py-3.5 rounded-xl hover:bg-primary transition-colors text-sm"
      >
        {{ t('cart.checkout') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.25s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
