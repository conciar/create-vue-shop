<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { conciarApi } from '@/api/conciar'
import type { SubscriptionBox } from '@/types'
import SubscriptionCard from '@/components/subscription/SubscriptionCard.vue'

const { t } = useI18n()

const featured = ref<SubscriptionBox[]>([])
const featuredLoading = ref(true)

onMounted(async () => {
  try {
    featured.value = await conciarApi.products.list({ featured: true })
  } finally {
    featuredLoading.value = false
  }
})
</script>

<template>
  <!-- Hero -->
  <section class="bg-charcoal text-white">
    <div class="max-w-7xl mx-auto px-6 py-28 md:py-36">
      <div class="max-w-2xl">
        <span class="font-mono text-xs tracking-[0.2em] uppercase text-white/50 mb-6 block">{{ t('home.eyebrow') }}</span>
        <h1 class="font-display text-5xl md:text-7xl font-semibold leading-[1.05] tracking-tight">
          {{ t('home.title') }}
        </h1>
        <p class="mt-6 text-lg text-white/80 max-w-md leading-relaxed">{{ t('home.subtitle') }}</p>
        <div class="flex flex-wrap gap-4 mt-10">
          <RouterLink to="/products" class="bg-white text-charcoal font-medium px-8 py-3.5 rounded-xl hover:bg-primary hover:text-white transition-colors text-sm">
            {{ t('home.shopCta') }}
          </RouterLink>
          <RouterLink to="/subscriptions" class="border border-white/40 text-white font-medium px-8 py-3.5 rounded-xl hover:bg-white/10 hover:border-white transition-colors text-sm">
            {{ t('home.subscriptionsCta') }}
          </RouterLink>
        </div>
      </div>
    </div>
  </section>

  <!-- Featured -->
  <section class="max-w-7xl mx-auto px-6 py-20">
    <div class="flex items-end justify-between mb-10">
      <h2 class="font-display text-3xl font-semibold">{{ t('home.featured') }}</h2>
      <RouterLink to="/products" class="text-sm font-medium text-gray-500 hover:text-black transition-colors hidden sm:block">
        {{ t('home.viewAll') }}
      </RouterLink>
    </div>

    <div v-if="featuredLoading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      <div v-for="i in 3" :key="i" class="bg-gray-100 rounded-2xl animate-pulse h-80" />
    </div>
    <div v-else-if="featured.length" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      <SubscriptionCard v-for="box in featured" :key="box.id" :box="box" />
    </div>
    <p v-else class="text-gray-400 text-sm">{{ t('home.featuredEmpty') }}</p>
  </section>
</template>
