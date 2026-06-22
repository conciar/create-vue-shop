<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import type { SubscriptionBox } from '@/types'

const props = defineProps<{ box: SubscriptionBox }>()
const cart = useCartStore()
</script>

<template>
  <article
    :class="[
      'relative rounded-2xl border overflow-hidden flex flex-col transition-all duration-300 hover:shadow-xl',
      box.popular
        ? 'border-primary shadow-lg ring-2 ring-primary/20'
        : 'border-black/10 hover:border-black/20'
    ]"
  >
    <!-- Popular badge -->
    <div v-if="box.popular" class="absolute top-4 right-4 z-10 bg-primary text-white text-xs font-mono font-semibold px-3 py-1 rounded-full">
      Most popular
    </div>

    <!-- Image -->
    <div class="relative overflow-hidden bg-cream h-52">
      <img :src="box.image" :alt="box.name" class="w-full h-full object-cover" loading="lazy" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      <div v-if="box.isSubscription" class="absolute bottom-4 left-5">
        <span class="font-mono text-xs text-white/80 uppercase tracking-widest">{{ box.frequency }}</span>
      </div>
    </div>

    <!-- Content -->
    <div class="p-6 flex flex-col flex-1 gap-4 bg-white">
      <div>
        <RouterLink :to="`/product/${box.id}/${box.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`" class="hover:text-primary transition-colors">
          <h3 class="font-display text-2xl font-semibold">{{ box.name }}</h3>
        </RouterLink>
        <p class="text-primary text-sm font-medium mt-0.5">{{ box.tagline }}</p>
      </div>

      <p class="text-sm text-gray-600 leading-relaxed">{{ box.description }}</p>

      <!-- Highlights -->
      <ul class="flex flex-col gap-2 text-sm text-gray-600">
        <li v-for="h in box.highlights" :key="h" class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-primary shrink-0">
            <path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" />
          </svg>
          {{ h }}
        </li>
      </ul>

      <!-- Price + CTA -->
      <div class="mt-auto pt-4 border-t border-black/6 flex items-center justify-between">
        <div>
          <span class="font-mono text-2xl font-semibold">€{{ box.price.toFixed(2) }}</span>
          <span v-if="box.originalPrice" class="text-sm text-gray-400 line-through ml-2">€{{ box.originalPrice.toFixed(2) }}</span>
          <p v-if="box.isSubscription" class="text-xs text-gray-400 mt-0.5">per {{ box.frequency === 'monthly' ? 'month' : 'quarter' }}</p>
        </div>
        <button
          @click="cart.add(box, box.isSubscription ? 'subscription' : 'product')"
          :class="[
            'text-sm font-medium px-5 py-2.5 rounded-xl transition-colors',
            box.popular
              ? 'bg-primary text-white hover:bg-primary-dark'
              : 'bg-charcoal text-white hover:bg-primary'
          ]"
        >
          {{ box.isSubscription ? 'Subscribe' : 'Add to cart' }}
        </button>
      </div>
    </div>
  </article>
</template>
