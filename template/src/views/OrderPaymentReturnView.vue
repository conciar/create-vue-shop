<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { conciarApi } from '@/api/conciar'

const { t } = useI18n()
const router         = useRouter()
const transactionKey = sessionStorage.getItem('pending_transaction_key')

type State = 'loading' | 'paid' | 'failed' | 'timeout' | 'not_found'

const state          = ref<State>('loading')
const orderReference = ref<string | null>(null)
const amount         = ref<number | null>(null)

const MAX_ATTEMPTS = 10
let attempts  = 0
let pollTimer: ReturnType<typeof setTimeout> | null = null

async function pollStatus() {
  try {
    const result = await conciarApi.orders.getStatusByTransaction(transactionKey!)

    const isPaid   = result.is_paid   || result.status === 'paid'
    const isFailed = result.is_failed || result.status === 'failed' || result.status === 'cancelled'

    if (isPaid) {
      orderReference.value = result.order_reference
      amount.value         = parseFloat(String(result.amount))
      state.value          = 'paid'
      sessionStorage.removeItem('pending_transaction_key')
      setTimeout(() => router.push({ name: 'order-confirmation', params: { reference: result.order_reference } }), 2500)
      return
    }

    if (isFailed) {
      state.value = 'failed'
      sessionStorage.removeItem('pending_transaction_key')
      return
    }

    // is_pending — keep polling
    attempts++
    if (attempts < MAX_ATTEMPTS) {
      pollTimer = setTimeout(pollStatus, 3000)
    } else {
      state.value = 'timeout'
    }
  } catch (e: any) {
    state.value = e?.status === 404 ? 'not_found' : 'failed'
  }
}

onMounted(() => {
  if (!transactionKey) { state.value = 'not_found'; return }
  pollStatus()
})

onUnmounted(() => { if (pollTimer) clearTimeout(pollTimer) })
</script>

<template>
  <div class="bg-cream min-h-screen flex items-center justify-center px-6">
    <div class="max-w-md w-full text-center">

      <!-- Icon -->
      <div :class="[
        'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 transition-all',
        state === 'paid'    ? 'bg-green-100' :
        state === 'failed'  ? 'bg-red-50' :
        state === 'timeout' ? 'bg-amber-50' :
        'bg-white border border-black/8',
      ]">
        <svg v-if="state === 'paid'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-green-600">
          <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd"/>
        </svg>
        <svg v-else-if="state === 'failed'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-red-400">
          <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clip-rule="evenodd"/>
        </svg>
        <svg v-else-if="state === 'timeout'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-amber-500">
          <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd"/>
        </svg>
        <svg v-else class="w-8 h-8 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>

      <!-- Paid -->
      <template v-if="state === 'paid'">
        <h1 class="font-display text-3xl font-semibold mb-2">{{ t('paymentReturn.confirmed') }}</h1>
        <p v-if="orderReference" class="font-mono text-sm text-gray-400 mb-1">{{ orderReference }}</p>
        <p v-if="amount" class="font-mono text-base font-semibold text-primary mb-4">€ {{ amount.toFixed(2).replace('.', ',') }}</p>
        <p class="text-sm text-gray-500 mb-8">{{ t('paymentReturn.confirmedEmail') }}</p>
        <RouterLink
          v-if="orderReference"
          :to="{ name: 'order-confirmation', params: { reference: orderReference } }"
          class="inline-block bg-charcoal text-white font-mono font-medium px-6 py-3.5 rounded-xl hover:bg-primary transition-colors text-sm"
        >
          {{ t('paymentReturn.viewOrder') }}
        </RouterLink>
      </template>

      <!-- Pending / polling -->
      <template v-else-if="state === 'loading'">
        <h1 class="font-display text-3xl font-semibold mb-2">{{ t('paymentReturn.processing') }}</h1>
        <p class="text-sm text-gray-500 mb-8">{{ t('paymentReturn.processingDesc') }}</p>
      </template>

      <!-- Timeout — still pending after max attempts -->
      <template v-else-if="state === 'timeout'">
        <h1 class="font-display text-3xl font-semibold mb-2">{{ t('paymentReturn.timeoutTitle') }}</h1>
        <p class="text-sm text-gray-500 mb-8">
          {{ t('paymentReturn.timeoutDesc') }}
        </p>
        <RouterLink to="/orders" class="inline-block bg-charcoal text-white font-mono font-medium px-6 py-3.5 rounded-xl hover:bg-primary transition-colors text-sm">
          {{ t('paymentReturn.viewOrders') }}
        </RouterLink>
      </template>

      <!-- Failed / cancelled -->
      <template v-else-if="state === 'failed'">
        <h1 class="font-display text-3xl font-semibold mb-2">{{ t('paymentReturn.failedTitle') }}</h1>
        <p class="text-sm text-gray-500 mb-8">
          {{ t('paymentReturn.failedDesc') }}
        </p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <RouterLink to="/checkout" class="flex-1 text-center bg-charcoal text-white font-mono font-medium px-6 py-3.5 rounded-xl hover:bg-primary transition-colors text-sm">
            {{ t('paymentReturn.retry') }}
          </RouterLink>
          <RouterLink to="/orders" class="flex-1 text-center border border-black/15 font-mono font-medium px-6 py-3.5 rounded-xl hover:border-black/40 transition-colors text-sm">
            {{ t('paymentReturn.myOrders') }}
          </RouterLink>
        </div>
      </template>

      <!-- 404 — session lost -->
      <template v-else>
        <h1 class="font-display text-3xl font-semibold mb-2">{{ t('paymentReturn.notFoundTitle') }}</h1>
        <p class="text-sm text-gray-500 mb-8">
          {{ t('paymentReturn.notFoundDesc') }}
        </p>
        <RouterLink to="/orders" class="inline-block border border-black/15 font-mono font-medium px-6 py-3.5 rounded-xl hover:border-black/40 transition-colors text-sm">
          {{ t('paymentReturn.myOrders') }}
        </RouterLink>
      </template>

    </div>
  </div>
</template>
