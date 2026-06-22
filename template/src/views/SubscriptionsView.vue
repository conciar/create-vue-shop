<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCatalogStore } from '@/stores/catalog'
import ProductCard from '@/components/product/ProductCard.vue'

const { t } = useI18n()
const catalog = useCatalogStore()

onMounted(() => catalog.fetchConnectProducts({ subscription: true }))
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-12">

    <!-- Header -->
    <div class="text-center max-w-xl mx-auto mb-14">
      <span class="font-mono text-xs tracking-[0.2em] uppercase text-primary mb-4 block">{{ t('subscriptions.eyebrow') }}</span>
      <h1 class="font-display text-4xl font-semibold leading-tight">{{ t('subscriptions.title') }}</h1>
      <p class="text-gray-500 mt-4 leading-relaxed">
        {{ t('subscriptions.subtitle') }}
      </p>
    </div>

    <!-- Perks strip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
      <div
        v-for="perk in [
          { icon: '🍷', label: t('subscriptions.perks.handpicked') },
          { icon: '📦', label: t('subscriptions.perks.freeDelivery') },
          { icon: '📖', label: t('subscriptions.perks.tastingNotes') },
          { icon: '✕',  label: t('subscriptions.perks.cancelAnytime') },
        ]"
        :key="perk.label"
        class="bg-cream rounded-2xl p-4 flex items-center gap-3"
      >
        <span class="text-lg">{{ perk.icon }}</span>
        <span class="font-medium text-gray-700 text-sm">{{ perk.label }}</span>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="catalog.connectLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="n in 5" :key="n" class="rounded-2xl overflow-hidden border border-black/8 bg-white">
        <div class="aspect-[3/4] bg-gray-100 animate-pulse" />
        <div class="p-4 space-y-2">
          <div class="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
          <div class="h-3 bg-gray-100 rounded animate-pulse w-1/3" />
          <div class="h-8 bg-gray-100 rounded-xl animate-pulse mt-3" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="!catalog.connectProducts.length" class="py-20 text-center text-gray-400">
      <p>{{ t('subscriptions.empty') }}</p>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <ProductCard
        v-for="product in catalog.connectProducts"
        :key="product.id"
        :product="product"
      />
    </div>

    <i18n-t keypath="subscriptions.manage" tag="p" class="text-center text-sm text-gray-400 mt-12">
      <template #link><RouterLink to="/account/subscriptions" class="text-primary hover:underline">{{ t('subscriptions.manageLink') }}</RouterLink></template>
    </i18n-t>

  </div>
</template>
