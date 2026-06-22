<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCustomerStore } from '@/stores/customer'
import { conciarApi } from '@/api/conciar'
import type { ConciarCustomerSubscription } from '@/api/conciar-types'

const { t } = useI18n()
const router   = useRouter()
const customer = useCustomerStore()

const subscriptions = ref<ConciarCustomerSubscription[]>([])
const loading = ref(true)
const error   = ref(false)

onMounted(async () => {
  try {
    subscriptions.value = await conciarApi.customerSubscriptions.list(customer.accessToken!)
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
    else error.value = true
  } finally {
    loading.value = false
  }
})

function billingLabel(detail: { billing_cycle_unit: string; billing_cycle_interval: number }) {
  if (detail.billing_cycle_unit === 'four_weekly')
    return t('account.subscriptions.billing.everyFourWeeks', { n: detail.billing_cycle_interval * 4 })
  const singular: Record<string, string> = {
    week: t('account.subscriptions.billing.week'),
    month: t('account.subscriptions.billing.month'),
    year: t('account.subscriptions.billing.year'),
    day: t('account.subscriptions.billing.day'),
  }
  const plural: Record<string, string> = {
    week: t('account.subscriptions.billing.weeks'),
    month: t('account.subscriptions.billing.months'),
    year: t('account.subscriptions.billing.years'),
    day: t('account.subscriptions.billing.days'),
  }
  if (detail.billing_cycle_interval === 1)
    return t('account.subscriptions.billing.every', { unit: singular[detail.billing_cycle_unit] ?? detail.billing_cycle_unit })
  return t('account.subscriptions.billing.everyN', {
    n: detail.billing_cycle_interval,
    units: plural[detail.billing_cycle_unit] ?? detail.billing_cycle_unit,
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-green-50 text-green-700 border-green-200',
  paused:    'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
  inactive:  'bg-gray-100 text-gray-500 border-black/10',
}
function statusLabel(name: string) {
  const labels: Record<string, string> = {
    active: t('account.subscriptions.statusLabel.active'),
    paused: t('account.subscriptions.statusLabel.paused'),
    cancelled: t('account.subscriptions.statusLabel.cancelled'),
    inactive: t('account.subscriptions.statusLabel.inactive'),
  }
  return labels[name] ?? name
}
</script>

<template>
  <div class="bg-cream min-h-screen">
    <div class="max-w-3xl mx-auto px-6 py-12">

      <div class="mb-8">
        <span class="font-mono text-xs tracking-[0.2em] uppercase text-gray-400">{{ t('account.eyebrow') }}</span>
        <h1 class="font-display text-4xl font-semibold mt-1">{{ t('account.subscriptions.title') }}</h1>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="flex flex-col gap-4">
        <div v-for="n in 2" :key="n" class="bg-white rounded-2xl h-24 border border-black/8 animate-pulse" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-16">
        <p class="font-mono text-gray-400">{{ t('account.subscriptions.loadError') }}</p>
      </div>

      <!-- Empty -->
      <div v-else-if="!subscriptions.length" class="bg-white rounded-2xl border border-black/8 p-10 text-center">
        <p class="font-mono text-sm text-gray-400 mb-4">{{ t('account.subscriptions.empty') }}</p>
        <RouterLink to="/subscriptions"
          class="inline-block bg-charcoal text-white font-mono font-medium text-sm px-6 py-3 rounded-xl hover:bg-primary transition-colors">
          {{ t('account.subscriptions.browse') }}
        </RouterLink>
      </div>

      <!-- List -->
      <div v-else class="flex flex-col gap-4">
        <RouterLink
          v-for="sub in subscriptions"
          :key="sub.id"
          :to="{ name: 'subscription-detail', params: { id: sub.id } }"
          class="bg-white border border-black/8 rounded-2xl p-5 flex items-center gap-4 hover:border-black/20 hover:shadow-sm transition-all group"
        >
          <div class="flex-1 min-w-0">
            <p class="font-display font-semibold leading-snug">{{ (sub.product.defaultInfo ?? sub.product.default_info)?.name ?? '' }}</p>
            <div class="flex flex-wrap items-center gap-2 mt-1.5">
              <span :class="['font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full border', STATUS_STYLES[sub.status.name] ?? STATUS_STYLES.inactive]">
                {{ statusLabel(sub.status.name) }}
              </span>
              <span v-if="sub.product.subscription_detail" class="font-mono text-xs text-gray-400">
                {{ billingLabel(sub.product.subscription_detail) }}
              </span>
              <span v-if="sub.skip_count > 0" class="font-mono text-xs text-amber-600">
                ⏭ {{ t('account.subscriptions.skipCount', { n: sub.skip_count }) }}
              </span>
            </div>
            <p v-if="sub.next_billing_at && sub.status.name === 'active'" class="font-mono text-xs text-gray-400 mt-1">
              {{ t('account.subscriptions.nextDelivery', { date: formatDate(sub.next_billing_at) }) }}
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="font-mono text-base font-semibold">
              {{ sub.product.retail_price?.display_price ?? '–' }}
            </p>
            <p class="font-mono text-xs text-gray-400 mt-0.5">× {{ sub.quantity }}</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
            class="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0">
            <path fill-rule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
          </svg>
        </RouterLink>
      </div>

    </div>
  </div>
</template>
