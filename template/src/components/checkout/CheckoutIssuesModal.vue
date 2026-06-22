<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useModalA11y } from '@/composables/useModalA11y'
import type { ConciarCheckoutIssue } from '@/api/conciar-types'

defineProps<{ issues: ConciarCheckoutIssue[] }>()
const emit = defineEmits<{ close: []; remove: [issue: ConciarCheckoutIssue] }>()

const { t } = useI18n()
const router = useRouter()

const dialogRef = ref<HTMLElement | null>(null)
useModalA11y(dialogRef, () => emit('close'))

function label(type: string) {
  const key = `checkout.issues.${type}`
  const translated = t(key)
  return translated !== key ? translated : t('checkout.issues.fallback')
}

function goToCart() {
  emit('close')
  router.push('/cart')
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-6">
    <div class="absolute inset-0 bg-charcoal/50 backdrop-blur-sm" @click="emit('close')" />

    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-issues-title"
      class="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
    >

      <!-- Header -->
      <div class="flex items-start gap-4 p-6 border-b border-black/8">
        <div class="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-red-500">
            <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd"/>
          </svg>
        </div>
        <div>
          <h2 id="checkout-issues-title" class="font-display font-semibold text-lg leading-tight">{{ t('checkout.issues.title') }}</h2>
          <p class="text-sm text-gray-500 mt-0.5">{{ t('checkout.issues.subtitle') }}</p>
        </div>
      </div>

      <!-- Issue rows -->
      <div class="px-6 py-4 flex flex-col gap-2">
        <div
          v-for="issue in issues"
          :key="issue.sku"
          class="flex items-center gap-3 py-3 border-b border-black/6 last:border-0"
        >
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ issue.name }}</p>
            <p class="font-mono text-xs text-gray-400">{{ issue.sku }}</p>
          </div>
          <span class="shrink-0 font-mono text-xs font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-full">
            {{ label(issue.type) }}
          </span>
          <button
            type="button"
            @click="emit('remove', issue)"
            class="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            :title="t('checkout.issues.removeItem')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.712Z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Action -->
      <div class="px-6 pb-6">
        <button
          type="button"
          @click="goToCart"
          class="w-full bg-charcoal text-white font-mono font-medium text-sm py-3.5 rounded-xl hover:bg-primary transition-colors"
        >
          {{ t('checkout.issues.goToCart') }}
        </button>
      </div>

    </div>
  </div>
</template>
