<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useCompareStore } from '@/stores/compare'
import PromoBadge from '@/components/promo/PromoBadge.vue'
import { formatMoney, discountDisplay } from '@/utils/money'
import type { ConciarConnectProduct } from '@/api/conciar-types'
import type { Product, SubscriptionBox } from '@/types'

const props = defineProps<{ product: ConciarConnectProduct }>()
const cart    = useCartStore()
const compare = useCompareStore()

// Only offer comparison when the product actually has properties to compare
const hasProperties = computed(() => {
  const p = props.product
  if (p.property_values?.some(pv => pv.default_info?.value)) return true
  return Object.values(p.properties ?? {}).some(Boolean)
})

const inCompare  = computed(() => compare.isSelected(props.product.id))
const compareFull = computed(() => compare.isFull && !inCompare.value)

function toggleCompare(e: Event) {
  e.preventDefault()
  compare.toggle(props.product)
}

const image = computed(() => props.product.files?.find(f => f.type?.name === 'image')?.url ?? null)
const name  = computed(() => props.product.resolved_info?.name ?? `Product ${props.product.id}`)
const price = computed(() => props.product.converted_retail_price?.display_price ?? null)

// Strike-through "was" price + saving, shown only when a compare_price exists
// and is genuinely higher than the selling price.
const discount = computed(() => {
  const selling = props.product.converted_retail_price?.amount
  if (selling == null) return null
  return discountDisplay(selling, props.product.converted_compare_price)
})

// Gross is the headline price; show a small note decomposing the tax out of it.
// Labels come from the merchant's rule (BTW, Accijns, …) — never hardcoded.
const taxNote = computed(() => {
  const tax = props.product.tax
  if (!tax || tax.tax_total <= 0) return null
  const labels = tax.components.map(c => c.name).join(' + ')
  return `Incl. ${formatMoney(tax.tax_total, tax.currency)}${labels ? ` ${labels}` : ''}`
})
const slug  = computed(() => name.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))

const intervalLabel = computed(() => {
  const sd = props.product.subscription_detail
  if (!sd) return null
  const map: Record<string, string> = {
    weekly:      'Weekly',
    four_weekly: 'Every 4 weeks',
    monthly:     'Monthly',
    quarterly:   'Quarterly',
    yearly:      'Yearly',
  }
  return map[sd.billing_cycle_unit] ?? sd.billing_cycle_unit.replace(/_/g, ' ')
})

function asCartProduct(): Product | SubscriptionBox {
  const base = {
    id: String(props.product.id),
    name: name.value,
    price: props.product.converted_retail_price?.amount ?? 0,
    image: image.value ?? '',
    priceRules: props.product.price_rules,
  }
  if (props.product.is_subscription) {
    const sd = props.product.subscription_detail
    return {
      ...base,
      isSubscription: true,
      tagline: '',
      description: props.product.resolved_info?.description ?? '',
      bottles: 0,
      frequency: sd?.billing_cycle_unit === 'quarterly' ? 'quarterly' : 'monthly',
      highlights: [],
      minimumCommitmentCycles: sd?.minimum_commitment_cycles ?? null,
      renewCommitmentOnCycle: sd?.renew_commitment_on_cycle ?? null,
    } satisfies SubscriptionBox
  }
  return {
    ...base,
  } satisfies Product
}

// When a product supports both purchase types, let the customer choose
const canChoosePurchaseType = computed(() =>
  props.product.is_subscription && props.product.is_one_time_purchase
)
const selectedPurchaseType = ref<'subscription' | 'one_time'>(
  props.product.is_subscription ? 'subscription' : 'one_time'
)

function addToCart(e: Event) {
  e.preventDefault()
  const isSubscription = selectedPurchaseType.value === 'subscription'
  const type = isSubscription ? 'subscription' : 'product'
  cart.add(asCartProduct(), type, isSubscription ? (intervalLabel.value ?? undefined) : undefined)
}
</script>

<template>
  <!-- Card is a plain container; only the image and title are links so the
       action buttons aren't (invalidly) nested inside an anchor. -->
  <div
    class="group bg-white rounded-2xl border border-black/8 overflow-hidden hover:border-black/20 hover:shadow-lg transition-all duration-300 flex flex-col"
  >
    <!-- Image -->
    <RouterLink :to="`/product/${product.id}/${slug}`" class="relative bg-cream aspect-[3/4] overflow-hidden block">
      <img
        v-if="image"
        :src="image"
        :alt="name"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
      <div v-else class="w-full h-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-10 h-10 text-primary/30">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 3h6M9 3v3.5c0 .5-.2 1-.5 1.4L6 11v9a1 1 0 001 1h10a1 1 0 001-1v-9l-2.5-3.1c-.3-.4-.5-.9-.5-1.4V3M9 3h6" />
        </svg>
      </div>

      <!-- Promo badge (automatic promotions, advertised from price_rules) -->
      <PromoBadge :rules="product.price_rules" :max="1" class="absolute top-2 left-2 z-10 pointer-events-none" />

      <!-- Discount badge (static compare_price "was" price, not a promotion) -->
      <span
        v-if="discount"
        class="absolute top-2 right-2 z-10 pointer-events-none font-mono text-xs font-semibold px-2 py-1 rounded-full bg-charcoal text-white"
      >
        −{{ discount.percentOff }}%
      </span>

      <!-- Out of stock badge -->
      <div v-if="product.out_of_stock" class="absolute inset-0 bg-white/60 flex items-center justify-center">
        <span class="font-mono text-xs font-semibold text-gray-500 bg-white border border-black/10 rounded-full px-3 py-1">
          Out of stock
        </span>
      </div>
    </RouterLink>

    <!-- Content -->
    <div class="p-4 flex flex-col gap-1.5 flex-1">
      <RouterLink
        :to="`/product/${product.id}/${slug}`"
        class="font-display font-semibold text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2"
      >
        {{ name }}
      </RouterLink>
      <p v-if="product.sku" class="font-mono text-xs text-gray-400">{{ product.sku }}</p>

      <!-- Purchase type selector (shown when both subscription + one-time are available) -->
      <div v-if="canChoosePurchaseType" class="flex gap-1 mt-1.5">
        <button
          type="button"
          :class="['flex-1 font-mono text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors', selectedPurchaseType === 'subscription' ? 'bg-primary/8 text-primary border-primary/20' : 'bg-white text-gray-400 border-black/10 hover:border-black/25']"
          @click="selectedPurchaseType = 'subscription'"
        >↻ {{ intervalLabel }}</button>
        <button
          type="button"
          :class="['flex-1 font-mono text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors', selectedPurchaseType === 'one_time' ? 'bg-charcoal text-white border-charcoal' : 'bg-white text-gray-400 border-black/10 hover:border-black/25']"
          @click="selectedPurchaseType = 'one_time'"
        >Once</button>
      </div>

      <!-- Billing interval badge (subscription only, no choice) -->
      <span v-else-if="intervalLabel && product.is_subscription" class="inline-block font-mono text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary/8 text-primary mt-1 self-start">
        {{ intervalLabel }}
      </span>

      <div class="mt-auto pt-3 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <p v-if="price" class="font-mono text-sm font-semibold flex items-baseline gap-1.5 flex-wrap">
            <span>{{ price }}</span>
            <span v-if="discount" class="text-xs font-normal text-gray-400 line-through">{{ discount.was }}</span>
          </p>
          <p v-if="taxNote" class="font-mono text-[10px] text-gray-400 leading-tight truncate">{{ taxNote }}</p>
        </div>
        <button
          v-if="!product.out_of_stock"
          type="button"
          @click="addToCart"
          class="shrink-0 bg-charcoal text-white text-xs font-mono font-medium px-3 py-1.5 rounded-xl hover:bg-primary transition-colors"
        >
          Add to cart
        </button>
        <span v-else class="shrink-0 text-xs font-mono text-gray-400">Out of stock</span>
      </div>

      <!-- Compare toggle -->
      <button
        v-if="hasProperties"
        type="button"
        @click="toggleCompare"
        :disabled="compareFull"
        :aria-pressed="inCompare"
        :class="[
          'mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-mono transition-all border',
          inCompare
            ? 'bg-primary/8 border-primary/20 text-primary'
            : 'border-black/10 text-gray-400 hover:border-black/30 hover:text-charcoal',
          compareFull ? 'opacity-30 cursor-not-allowed' : '',
        ]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
          <path fill-rule="evenodd" d="M8.22 3.22a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1-1.06 1.06L9 5.06V10a.75.75 0 0 1-1.5 0V5.06L6.03 6.53a.75.75 0 0 1-1.06-1.06l2.25-2.25ZM5.5 12.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"/>
        </svg>
        {{ inCompare ? 'Added to compare' : 'Compare' }}
      </button>
    </div>
  </div>
</template>
