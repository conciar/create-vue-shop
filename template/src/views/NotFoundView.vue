<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="bg-cream min-h-screen flex items-center justify-center px-6">
    <div class="text-center max-w-md">
      <p class="font-mono text-xs tracking-[0.2em] uppercase text-gray-400">{{ t('notFound.eyebrow') }}</p>
      <h1 class="font-display text-5xl font-semibold mt-2 mb-3">{{ t('notFound.title') }}</h1>
      <p class="text-sm text-gray-500 leading-relaxed mb-8">{{ t('notFound.subtitle') }}</p>
      <div class="flex flex-wrap items-center justify-center gap-3">
        <RouterLink
          to="/"
          class="bg-charcoal text-white font-mono font-medium text-sm px-6 py-3 rounded-xl hover:bg-primary transition-colors"
        >
          {{ t('notFound.home') }}
        </RouterLink>
        <RouterLink
          to="/products"
          class="border border-black/12 font-mono font-medium text-sm px-6 py-3 rounded-xl hover:bg-black/4 transition-colors"
        >
          {{ t('notFound.browse') }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
