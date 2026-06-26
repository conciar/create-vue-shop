<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useCompareStore } from '@/stores/compare'
import PromoBadge from '@/components/promo/PromoBadge.vue'
import { conciarApi } from '@/api/conciar'
import { formatMoney, discountDisplay } from '@/utils/money'
import type { ConciarProduct, ConciarVariant } from '@/api/conciar-types'
import type { Product } from '@/types'

const route   = useRoute()
const cart    = useCartStore()
const compare = useCompareStore()

const product = ref<ConciarProduct | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    product.value = await conciarApi.products.getDetail(route.params.id as string)
    // Default to the first in-stock variant (or the first) so the CTA has a concrete selection.
    const active = (product.value?.variants ?? []).filter(v => v.active)
    if (active.length) selectedVariantId.value = (active.find(v => !v.out_of_stock) ?? active[0]).id
  } finally {
    loading.value = false
  }
})

const name        = computed(() => product.value ? (product.value.resolved_info ?? product.value.default_info).name : '')
const description = computed(() => product.value ? (product.value.resolved_info ?? product.value.default_info).description : null)
// ── Variants ──────────────────────────────────────────────────────────────────
const selectedVariantId = ref<number | null>(null)
const variants       = computed(() => (product.value?.variants ?? []).filter(v => v.active))
const hasVariants    = computed(() => variants.value.length > 0)
const selectedVariant = computed(() => variants.value.find(v => v.id === selectedVariantId.value) ?? null)
const variantLabel = (v: ConciarVariant) => v.resolved_info?.name ?? v.default_info?.name ?? v.sku ?? `#${v.id}`

// Price / stock follow the selected variant when the product has variants, else the product itself.
const effConvertedPrice   = computed(() => selectedVariant.value?.converted_retail_price ?? product.value?.converted_retail_price ?? null)
const effConvertedCompare = computed(() => selectedVariant.value?.converted_compare_price ?? product.value?.converted_compare_price ?? null)
const effOutOfStock       = computed(() => (selectedVariant.value ?? product.value)?.out_of_stock ?? false)

const displayPrice = computed(() => effConvertedPrice.value?.display_price ?? null)
// Strike-through "was" price + saving, shown only when a compare_price exists
// and is genuinely higher than the selling price.
const discount = computed(() => {
  const selling = effConvertedPrice.value?.amount
  if (selling == null) return null
  return discountDisplay(selling, effConvertedCompare.value)
})
// Tax decomposed out of the gross (displayed) price; null = no tax rule.
const tax = computed(() => selectedVariant.value?.tax ?? product.value?.tax ?? null)
const image       = computed(() => product.value?.files?.find(f => f.type?.name === 'image')?.url ?? null)

// Properties hidden from the generic spec list
const HIDDEN_KEYS = new Set(['tags', 'label'])

// All product properties, rendered as a generic key/value spec list
const specs = computed(() =>
  (product.value?.property_values ?? [])
    .filter(pv => pv.default_info?.value && !HIDDEN_KEYS.has(pv.property.key))
    .map(pv => ({
      label: pv.property.default_info?.label ?? pv.property.key,
      value: pv.default_info!.value,
    })),
)

// ── Subscription helpers ──────────────────────────────────────────────────────
const INTERVAL_LABELS: Record<string, string> = {
  weekly:      'Weekly',
  four_weekly: 'Every 4 weeks',
  monthly:     'Monthly',
  quarterly:   'Quarterly',
  yearly:      'Yearly',
}

const intervalLabel = computed(() => {
  const sd = product.value?.subscription_detail
  if (!sd) return null
  return INTERVAL_LABELS[sd.billing_cycle_unit]
    ?? sd.billing_cycle_unit.replace(/_/g, ' ')
})

// Only offer comparison when the product actually has properties to compare
const hasProperties = computed(() =>
  (product.value?.property_values ?? []).some(pv => pv.default_info?.value),
)

const inCompare   = computed(() => product.value ? compare.isSelected(product.value.id) : false)
const compareFull = computed(() => compare.isFull && !inCompare.value)

function toggleCompare() {
  if (!product.value) return
  const p = product.value
  compare.toggle({
    id: p.id,
    sku: p.sku,
    ean_13: null,
    active: p.active,
    out_of_stock: p.out_of_stock,
    resolved_info: p.resolved_info
      ? { name: p.resolved_info.name, description: p.resolved_info.description }
      : null,
    converted_retail_price: p.converted_retail_price,
    type: p.type,
    files: p.files ?? [],
    is_subscription: p.is_subscription,
    subscription_detail: p.subscription_detail
      ? {
          billing_cycle_unit: p.subscription_detail.billing_cycle_unit,
          billing_cycle_interval: p.subscription_detail.billing_cycle_interval,
          minimum_commitment_cycles: p.subscription_detail.minimum_commitment_cycles,
          renew_commitment_on_cycle: p.subscription_detail.renew_commitment_on_cycle,
        }
      : null,
  })
}

function buildCartProduct(): Product {
  const p = product.value!
  const v = selectedVariant.value
  return {
    id: String(p.id),
    name: v ? `${name.value} · ${variantLabel(v)}` : name.value,
    price: (v?.converted_retail_price ?? p.converted_retail_price)?.amount ?? 0,
    image: image.value ?? '',
    priceRules: p.price_rules,
    variantId: v ? String(v.id) : undefined,
  }
}

function addToCart() {
  if (!product.value) return
  cart.add(
    buildCartProduct(),
    product.value.is_subscription ? 'subscription' : 'product',
    product.value.is_subscription ? (intervalLabel.value ?? undefined) : undefined,
  )
}

function addOneTime() {
  if (!product.value) return
  cart.add(buildCartProduct(), 'product')
}
</script>

<template>
  <div class="bg-cream min-h-screen pb-28 lg:pb-0">

    <!-- Back link -->
    <div class="max-w-7xl mx-auto px-6 pt-8">
      <RouterLink to="/products" class="inline-flex items-center gap-1.5 text-sm font-mono text-gray-400 hover:text-charcoal transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
          <path fill-rule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
        </svg>
        Back to products
      </RouterLink>
    </div>

    <!-- ── Skeleton ────────────────────────────────────────────────────────── -->
    <div v-if="loading" class="max-w-7xl mx-auto px-6 py-10 grid lg:grid-cols-[440px_1fr] gap-12 animate-pulse">
      <div class="bg-white rounded-3xl aspect-[3/4] shadow-sm" />
      <div class="flex flex-col gap-5 py-4">
        <div class="h-4 bg-white rounded-full w-16" />
        <div class="h-12 bg-white rounded-xl w-2/3" />
        <div class="flex gap-2 mt-2">
          <div class="h-7 w-24 bg-white rounded-full" />
          <div class="h-7 w-20 bg-white rounded-full" />
          <div class="h-7 w-16 bg-white rounded-full" />
        </div>
        <div class="h-28 bg-white rounded-xl mt-2" />
        <div class="grid grid-cols-2 gap-3 mt-2">
          <div v-for="n in 6" :key="n" class="h-14 bg-white rounded-xl" />
        </div>
      </div>
    </div>

    <!-- ── Content ────────────────────────────────────────────────────────── -->
    <div v-else-if="product" class="max-w-7xl mx-auto px-6 py-10">
      <div class="grid lg:grid-cols-[440px_1fr] gap-12 xl:gap-20 items-start">

        <!-- LEFT: Image (sticky on desktop) -->
        <div class="lg:sticky lg:top-24 flex flex-col gap-4">
          <div class="bg-white rounded-3xl overflow-hidden shadow-md aspect-[3/4] flex items-center justify-center relative">
            <img v-if="image" :src="image" :alt="name" class="w-full h-full object-contain p-6" />
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.75" class="w-32 h-32 text-gray-200">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 3h6M9 3v3.5c0 .5-.2 1-.5 1.4L6 11v9a1 1 0 001 1h10a1 1 0 001-1v-9l-2.5-3.1c-.3-.4-.5-.9-.5-1.4V3M9 3h6" />
            </svg>
            <div v-if="effOutOfStock" class="absolute inset-0 bg-white/70 flex items-center justify-center">
              <span class="font-mono text-sm font-semibold text-gray-500 border border-black/10 bg-white px-4 py-2 rounded-full">Out of stock</span>
            </div>
          </div>

          <!-- Desktop CTA card -->
          <div class="hidden lg:block bg-white rounded-2xl p-5 shadow-sm border border-black/6 space-y-3">
            <div class="flex items-end justify-between mb-4">
              <div>
                <div class="flex items-baseline gap-2 flex-wrap">
                  <p class="font-mono text-3xl font-semibold">{{ displayPrice ?? '–' }}</p>
                  <span v-if="discount" class="font-mono text-base text-gray-400 line-through">{{ discount.was }}</span>
                  <span v-if="discount" class="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-charcoal text-white">−{{ discount.percentOff }}%</span>
                </div>
                <p v-if="intervalLabel" class="font-mono text-xs text-gray-400 mt-0.5">
                  {{ intervalLabel }}
                </p>
              </div>
              <span v-if="product.sku" class="font-mono text-xs text-gray-400">{{ product.sku }}</span>
            </div>

            <!-- Tax breakdown (decomposed out of the gross price) -->
            <div v-if="tax && tax.tax_total > 0" class="-mt-1 mb-4 border-t border-black/6 pt-3 flex flex-col gap-1 text-xs font-mono">
              <div class="flex justify-between text-gray-400">
                <span>Excl. btw</span>
                <span>{{ formatMoney(tax.net, tax.currency) }}</span>
              </div>
              <div v-for="(c, i) in tax.components" :key="i" class="flex justify-between text-gray-400">
                <span>{{ c.name }}<span v-if="c.type === 'percentage'" class="text-gray-300"> ({{ c.rate }}%)</span></span>
                <span>{{ formatMoney(c.amount, tax.currency) }}</span>
              </div>
              <div class="flex justify-between text-gray-500 font-medium">
                <span>Incl. {{ tax.components.map(c => c.name).join(' + ') || 'btw' }}</span>
                <span>{{ formatMoney(tax.gross, tax.currency) }}</span>
              </div>
            </div>

            <button
              :disabled="effOutOfStock"
              @click="addToCart"
              class="w-full bg-charcoal text-white font-mono font-medium py-3.5 rounded-xl hover:bg-primary transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {{ effOutOfStock ? 'Out of stock' : product.is_subscription ? 'Subscribe' : 'Add to cart' }}
            </button>
            <!-- One-time purchase option for subscriptions -->
            <button
              v-if="product.is_subscription && product.subscription_detail?.allow_one_time_purchase && !effOutOfStock"
              @click="addOneTime"
              class="w-full border border-black/15 text-charcoal font-mono font-medium py-3 rounded-xl hover:border-black/40 transition-colors text-sm"
            >
              Order once · {{ displayPrice }}
            </button>
            <button
              v-if="hasProperties"
              type="button"
              :disabled="compareFull"
              @click="toggleCompare"
              :class="[
                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono border transition-all',
                inCompare
                  ? 'bg-primary/8 border-primary/20 text-primary'
                  : 'border-black/10 text-gray-500 hover:border-black/30 hover:text-charcoal',
                compareFull ? 'opacity-30 cursor-not-allowed' : '',
              ]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                <path fill-rule="evenodd" d="M8.22 3.22a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1-1.06 1.06L9 5.06V10a.75.75 0 0 1-1.5 0V5.06L6.03 6.53a.75.75 0 0 1-1.06-1.06l2.25-2.25ZM5.5 12.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"/>
              </svg>
              {{ inCompare ? 'Added to compare' : compareFull ? 'Compare full' : 'Add to compare' }}
            </button>
          </div>
        </div>

        <!-- RIGHT: Details -->
        <div class="flex flex-col gap-7">

          <!-- Promotion + subscription badges -->
          <div class="flex flex-wrap gap-2 items-center">
            <!-- Automatic promotions (advertised from price_rules) -->
            <PromoBadge :rules="product.price_rules" show-scope />
            <!-- Subscription badge -->
            <span v-if="product.is_subscription && intervalLabel"
              class="font-mono text-xs font-semibold px-3 py-1.5 rounded-full border bg-primary/8 text-primary border-primary/20">
              {{ intervalLabel }}
            </span>
          </div>

          <!-- Title -->
          <div>
            <h1 class="font-display text-4xl sm:text-5xl font-semibold leading-tight">{{ name }}</h1>
          </div>

          <!-- Description -->
          <p v-if="description" class="text-gray-600 leading-relaxed text-base border-t border-black/6 pt-6">
            {{ description }}
          </p>

          <!-- Variant selector -->
          <div v-if="hasVariants" class="border-t border-black/6 pt-6">
            <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em] mb-3">Options</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="v in variants"
                :key="v.id"
                type="button"
                :disabled="v.out_of_stock"
                @click="selectedVariantId = v.id"
                :class="[
                  'px-4 py-2.5 rounded-xl border text-sm font-mono transition-all',
                  selectedVariantId === v.id
                    ? 'border-primary bg-primary/8 text-primary'
                    : 'border-black/10 text-charcoal hover:border-black/30',
                  v.out_of_stock ? 'opacity-40 line-through cursor-not-allowed hover:border-black/10' : '',
                ]"
              >
                {{ variantLabel(v) }}
                <span v-if="v.converted_retail_price" class="text-gray-400"> · {{ v.converted_retail_price.display_price }}</span>
              </button>
            </div>
          </div>

          <!-- Subscription details block -->
          <div v-if="product.is_subscription && product.subscription_detail" class="bg-primary/5 border border-primary/15 rounded-2xl p-5">
            <p class="font-mono text-xs font-semibold text-primary uppercase tracking-widest mb-4">Subscription details</p>
            <dl class="grid grid-cols-2 gap-x-8 gap-y-3">
              <div class="flex flex-col gap-0.5">
                <dt class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">Billing cycle</dt>
                <dd class="font-mono text-sm text-charcoal">{{ intervalLabel }}</dd>
              </div>
              <div class="flex flex-col gap-0.5">
                <dt class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">Auto-renew</dt>
                <dd class="font-mono text-sm text-charcoal">{{ product.subscription_detail.auto_renew ? 'Yes' : 'No' }}</dd>
              </div>
              <div v-if="product.subscription_detail.trial_period_days > 0" class="flex flex-col gap-0.5">
                <dt class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">Trial period</dt>
                <dd class="font-mono text-sm text-charcoal">{{ product.subscription_detail.trial_period_days }} days</dd>
              </div>
              <div v-if="product.subscription_detail.cancellation_notice_days > 0" class="flex flex-col gap-0.5">
                <dt class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">Cancel notice</dt>
                <dd class="font-mono text-sm text-charcoal">{{ product.subscription_detail.cancellation_notice_days }} days</dd>
              </div>
              <div class="flex flex-col gap-0.5">
                <dt class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">One-time order</dt>
                <dd class="font-mono text-sm" :class="product.subscription_detail.allow_one_time_purchase ? 'text-green-600' : 'text-gray-400'">
                  {{ product.subscription_detail.allow_one_time_purchase ? 'Available' : 'Not available' }}
                </dd>
              </div>
              <div v-if="product.subscription_detail.max_subscribers" class="flex flex-col gap-0.5">
                <dt class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">Max subscribers</dt>
                <dd class="font-mono text-sm text-charcoal">{{ product.subscription_detail.max_subscribers }}</dd>
              </div>
              <div v-if="product.subscription_detail.minimum_commitment_cycles" class="flex flex-col gap-0.5">
                <dt class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">Min. commitment</dt>
                <dd class="font-mono text-sm text-charcoal">{{ product.subscription_detail.minimum_commitment_cycles }} cycles</dd>
              </div>
              <div v-if="product.subscription_detail.renew_commitment_on_cycle" class="flex flex-col gap-0.5">
                <dt class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">Commitment renews</dt>
                <dd class="font-mono text-sm text-charcoal">Every {{ product.subscription_detail.renew_commitment_on_cycle }} cycles</dd>
              </div>
            </dl>
          </div>

          <!-- Specifications (generic product properties) -->
          <div v-if="specs.length" class="border-t border-black/6 pt-6">
            <dl class="grid grid-cols-2 gap-x-8 gap-y-4">
              <div v-for="spec in specs" :key="spec.label" class="flex flex-col gap-0.5">
                <dt class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">{{ spec.label }}</dt>
                <dd class="font-mono text-sm text-charcoal">{{ spec.value }}</dd>
              </div>
            </dl>
          </div>

        </div>
      </div>
    </div>

    <!-- Not found -->
    <div v-else class="max-w-7xl mx-auto px-6 py-24 text-center text-gray-400">
      <p>Product not found.</p>
      <RouterLink to="/products" class="text-sm text-primary hover:underline mt-2 inline-block">Back to products</RouterLink>
    </div>

    <!-- ── Mobile sticky CTA ──────────────────────────────────────────────── -->
    <div v-if="product && !loading" class="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-black/8 px-6 py-4 flex items-center gap-3 z-30">
      <div class="shrink-0">
        <p class="font-mono text-lg font-semibold flex items-baseline gap-1.5">
          <span>{{ displayPrice ?? '–' }}</span>
          <span v-if="discount" class="text-xs font-normal text-gray-400 line-through">{{ discount.was }}</span>
        </p>
        <p v-if="discount" class="font-mono text-[10px] font-semibold text-primary">−{{ discount.percentOff }}% off</p>
        <p v-else-if="product.sku" class="font-mono text-xs text-gray-400">{{ product.sku }}</p>
      </div>
      <button
        v-if="hasProperties"
        type="button"
        :disabled="compareFull"
        @click="toggleCompare"
        :class="[
          'shrink-0 flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-mono transition-all',
          inCompare ? 'bg-primary/8 border-primary/20 text-primary' : 'border-black/10 text-gray-500',
          compareFull ? 'opacity-30 cursor-not-allowed' : '',
        ]"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
          <path fill-rule="evenodd" d="M8.22 3.22a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1-1.06 1.06L9 5.06V10a.75.75 0 0 1-1.5 0V5.06L6.03 6.53a.75.75 0 0 1-1.06-1.06l2.25-2.25ZM5.5 12.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"/>
        </svg>
        Compare
      </button>
      <button
        :disabled="effOutOfStock"
        @click="addToCart"
        class="flex-1 bg-charcoal text-white font-mono font-medium py-3 rounded-xl hover:bg-primary transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {{ effOutOfStock ? 'Out of stock' : product.is_subscription ? 'Subscribe' : 'Add to cart' }}
      </button>
      <button
        v-if="product.is_subscription && product.subscription_detail?.allow_one_time_purchase && !effOutOfStock"
        @click="addOneTime"
        class="shrink-0 border border-black/15 font-mono font-medium py-3 px-4 rounded-xl hover:border-black/40 transition-colors text-xs"
      >
        Once
      </button>
    </div>

  </div>
</template>
