<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import CartDrawer from '@/components/cart/CartDrawer.vue'
import { useCartStore } from '@/stores/cart'
import { useStoreConfigStore } from '@/stores/storeConfig'
import { maintenanceState } from '@/api/conciar'
import CompareTray from '@/components/compare/CompareTray.vue'
import { SHOP_NAME } from '@/config'

const route = useRoute()
const fullscreen = computed(() => !!route.meta.fullscreen)

const cart = useCartStore()
const storeConfig = useStoreConfigStore()

onMounted(() => {
  cart.init()
  storeConfig.fetch()
})
</script>

<template>
  <!-- Loading screen while store config resolves -->
  <div v-if="!storeConfig.loaded" class="min-h-screen bg-cream flex items-center justify-center">
    <div class="flex flex-col items-center gap-4">
      <p class="font-display text-3xl tracking-tight">{{ SHOP_NAME }}</p>
      <svg class="w-5 h-5 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  </div>

  <!-- Maintenance (any store/* endpoint returned HTTP 503) -->
  <div v-else-if="maintenanceState.active" class="min-h-screen bg-cream flex items-center justify-center px-6">
    <div class="text-center max-w-sm">
      <p class="font-display text-4xl mb-4">{{ SHOP_NAME }}</p>
      <p class="font-mono text-gray-500 text-sm">{{ maintenanceState.message || 'We are temporarily offline for maintenance. Please check back soon.' }}</p>
    </div>
  </div>

  <template v-else-if="fullscreen">
    <RouterView />
  </template>
  <template v-else>
    <AppNavbar />
    <CartDrawer />
    <CompareTray />
    <main class="min-h-screen">
      <RouterView />
    </main>
    <AppFooter />
  </template>
</template>
