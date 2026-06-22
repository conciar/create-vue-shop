<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useModalA11y } from '@/composables/useModalA11y'
import type { ConciarPriceWarning } from '@/api/conciar-types'

defineProps<{ warnings: ConciarPriceWarning[] }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const { t } = useI18n()

const dialogRef = ref<HTMLElement | null>(null)
useModalA11y(dialogRef, () => emit('cancel'))

function fmt(amount: number) {
  return `€ ${amount.toFixed(2).replace('.', ',')}`
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-6">
    <div class="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" />

    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-warning-title"
      class="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
    >

      <!-- Header -->
      <div class="flex items-start gap-4 p-6 border-b border-black/8">
        <div class="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-amber-500">
            <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div>
          <h2 id="price-warning-title" class="font-display font-semibold text-lg leading-tight">{{ t('checkout.priceWarning.title') }}</h2>
          <p class="text-sm text-gray-500 mt-0.5">{{ t('checkout.priceWarning.subtitle') }}</p>
        </div>
      </div>

      <!-- Warning rows -->
      <div class="px-6 py-4 flex flex-col gap-2">
        <div
          v-for="w in warnings"
          :key="w.sku"
          class="flex items-center justify-between gap-4 py-3 border-b border-black/6 last:border-0"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ w.name }}</p>
            <p class="font-mono text-xs text-gray-400">{{ w.sku }}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0 font-mono text-sm">
            <span class="line-through text-gray-400">{{ fmt(w.original_price) }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-gray-300 shrink-0">
              <path fill-rule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clip-rule="evenodd"/>
            </svg>
            <span :class="['font-semibold', w.new_price > w.original_price ? 'text-red-600' : 'text-green-600']">
              {{ fmt(w.new_price) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Note -->
      <div class="px-6 pb-2">
        <p class="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
          {{ t('checkout.priceWarning.note') }}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex gap-3 p-6 pt-4">
        <button
          type="button"
          @click="emit('cancel')"
          class="flex-1 border border-black/15 font-mono font-medium text-sm py-3 rounded-xl hover:border-black/40 transition-colors"
        >
          {{ t('checkout.priceWarning.goBack') }}
        </button>
        <button
          type="button"
          @click="emit('confirm')"
          class="flex-1 bg-charcoal text-white font-mono font-medium text-sm py-3 rounded-xl hover:bg-primary transition-colors"
        >
          {{ t('checkout.priceWarning.confirm') }}
        </button>
      </div>

    </div>
  </div>
</template>
