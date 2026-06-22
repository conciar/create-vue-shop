<template>
  <footer class="bg-charcoal text-white mt-24" aria-label="Footer">
    <div class="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
      <div>
        <p class="font-display text-xl font-semibold mb-3">Cellier</p>
        <p class="text-sm text-gray-400 leading-relaxed max-w-xs">
          {{ t('footer.tagline') }}
        </p>
      </div>
      <div class="flex flex-col gap-3 text-sm text-gray-400">
        <h2 class="text-white font-medium mb-1">{{ t('footer.shop') }}</h2>
        <RouterLink to="/products" class="hover:text-white transition-colors">{{ t('footer.wines') }}</RouterLink>
        <RouterLink to="/subscriptions" class="hover:text-white transition-colors">{{ t('footer.subscriptions') }}</RouterLink>
        <RouterLink to="/account/orders" class="hover:text-white transition-colors">{{ t('footer.myOrders') }}</RouterLink>
      </div>
      <div class="flex flex-col gap-3 text-sm text-gray-400">
        <h2 class="text-white font-medium mb-1">{{ t('footer.account') }}</h2>
        <a href="https://portal.conciar.com" target="_blank" rel="noopener noreferrer" class="hover:text-white transition-colors">{{ t('footer.merchantPortal') }}</a>
        <a href="mailto:support@conciar.com" class="hover:text-white transition-colors">{{ t('footer.support') }}</a>
      </div>
    </div>
    <div class="border-t border-white/10 px-6 py-5 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
      <span>{{ t('footer.copyright', { year: new Date().getFullYear() }) }}</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
