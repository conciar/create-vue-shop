<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCustomerStore } from '@/stores/customer'
import { useStoreConfigStore } from '@/stores/storeConfig'
import { useCountriesStore, formatCountryName } from '@/stores/countries'
import { conciarApi } from '@/api/conciar'
import { useModalA11y } from '@/composables/useModalA11y'
import type { ConciarCustomerSubscription, ConciarMandatePaymentMethod, ConciarSwapVariant, ConciarSwapProduct, ConciarCartShippingMethod, ConciarOrderAddress } from '@/api/conciar-types'

const route       = useRoute()
const router      = useRouter()
const customer    = useCustomerStore()
const storeConfig = useStoreConfigStore()
const countries   = useCountriesStore()
const { t, locale } = useI18n()

const sub     = ref<ConciarCustomerSubscription | null>(null)
const loading = ref(true)
const error   = ref(false)
const id      = Number(route.params.id)

// ─── Action state ─────────────────────────────────────────────────────────────
const skipCount   = ref(1)
const actionBusy  = ref(false)
const actionError = ref<string | null>(null)

type ModalKind = 'pause' | 'cancel' | 'update_payment' | 'swap' | 'shipping' | null
const modal              = ref<ModalKind>(null)
const cancelReason       = ref('')
const updatePaymentBusy  = ref(false)
const updatePaymentError = ref<string | null>(null)

const mandatePaymentMethods = ref<ConciarMandatePaymentMethod[]>([])
const mandateMethodsLoading = ref(false)
const mandateMethodsError   = ref<string | null>(null)
const selectedMandateMethod = ref<ConciarMandatePaymentMethod | null>(null)
const mandateJustUpdated    = ref(false)

type SwapMode = 'variants' | 'products'
const swapMode            = ref<SwapMode | null>(null)
const swapVariants        = ref<ConciarSwapVariant[]>([])
const swapProductsList    = ref<ConciarSwapProduct[]>([])
const swapProductsLoading = ref(false)
const swapProductsError   = ref<string | null>(null)
const selectedSwapVariant = ref<ConciarSwapVariant | null>(null)
const selectedSwapProduct = ref<ConciarSwapProduct | null>(null)
const swapBusy            = ref(false)
const swapError           = ref<string | null>(null)
const swapJustSucceeded   = ref(false)

const swapAllowed = computed(() =>
  storeConfig.config?.allowSubscriptionProductSwap === true
)

const activeVariantsForSelected = computed(() =>
  selectedSwapProduct.value?.variants?.filter(v => v.active && !v.out_of_stock) ?? []
)

const swapCanSubmit = computed(() => {
  if (swapMode.value === 'variants') return !!selectedSwapVariant.value
  if (swapMode.value === 'products') {
    if (!selectedSwapProduct.value) return false
    if (activeVariantsForSelected.value.length > 1 && !selectedSwapVariant.value) return false
    return true
  }
  return false
})

function selectSwapProduct(product: ConciarSwapProduct) {
  selectedSwapProduct.value = product
  const active = product.variants?.filter(v => v.active && !v.out_of_stock) ?? []
  selectedSwapVariant.value = active.length === 1 ? active[0] : null
}

function openModal(kind: ModalKind) {
  cancelReason.value       = ''
  actionError.value        = null
  updatePaymentError.value = null
  swapError.value          = null
  modal.value              = kind
  if (kind === 'update_payment') fetchMandatePaymentMethods()
  if (kind === 'swap') fetchSwapOptions()
}
function closeModal() { modal.value = null }

// Dialog a11y (Escape, focus trap, focus restore) tied to the active modal.
const modalRef = ref<HTMLElement | null>(null)
useModalA11y(modalRef, closeModal, modal)

async function callAction(fn: () => Promise<ConciarCustomerSubscription>) {
  actionBusy.value  = true
  actionError.value = null
  try {
    const updated = await fn()
    // Action endpoints return a flat subscription without product/cycles.
    // Merge only the fields that can change so product data is preserved.
    if (sub.value) {
      sub.value = {
        ...sub.value,
        status:                      updated.status,
        skip_count:                  updated.skip_count,
        next_billing_at:             updated.next_billing_at,
        current_period_start:        updated.current_period_start,
        current_period_end:          updated.current_period_end,
        cancelled_at:                updated.cancelled_at,
        cancellation_reason:         updated.cancellation_reason,
        cycles_count:                updated.cycles_count,
        commitment_cycles_remaining: updated.commitment_cycles_remaining,
      }
    }
    modal.value        = null
    cancelReason.value = ''
    skipCount.value    = 1
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
    else actionError.value = e?.body?.message ?? t('sub.modal.error')
  } finally {
    actionBusy.value = false
  }
}

const doSkip      = () => callAction(() => conciarApi.customerSubscriptions.skip(customer.accessToken!, id, skipCount.value))
const doUnskip1   = () => callAction(() => conciarApi.customerSubscriptions.unskip(customer.accessToken!, id, 1))
const doUnskipAll = () => callAction(() => conciarApi.customerSubscriptions.unskip(customer.accessToken!, id))
const doResume    = () => callAction(() => conciarApi.customerSubscriptions.resume(customer.accessToken!, id))
const confirmPause  = () => callAction(() => conciarApi.customerSubscriptions.pause(customer.accessToken!, id))
const confirmCancel = () => callAction(() => conciarApi.customerSubscriptions.cancel(customer.accessToken!, id, cancelReason.value || undefined))

async function fetchMandatePaymentMethods() {
  mandateMethodsLoading.value = true
  mandateMethodsError.value   = null
  mandatePaymentMethods.value = []
  selectedMandateMethod.value = null
  try {
    mandatePaymentMethods.value = await conciarApi.storePaymentMethods.list(customer.accessToken!)
    if (mandatePaymentMethods.value.length === 1) {
      selectedMandateMethod.value = mandatePaymentMethods.value[0]
    }
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
    else mandateMethodsError.value = t('sub.modal.payment.loadError')
  } finally {
    mandateMethodsLoading.value = false
  }
}

async function doUpdatePaymentMethod() {
  if (!selectedMandateMethod.value) return
  updatePaymentBusy.value  = true
  updatePaymentError.value = null
  try {
    const returnUrl = `${window.location.origin}/account/subscriptions/${id}?mandate=update`
    const res = await conciarApi.customerSubscriptions.updatePaymentMethod(
      customer.accessToken!, id,
      selectedMandateMethod.value.payment_service_provider_id,
      selectedMandateMethod.value.id,
      returnUrl,
    )
    modal.value = null
    if (res.payment_url) {
      window.location.href = res.payment_url
    }
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
    else updatePaymentError.value = e?.body?.message ?? t('sub.modal.error')
  } finally {
    updatePaymentBusy.value = false
  }
}

async function fetchSwapOptions() {
  swapProductsLoading.value = true
  swapProductsError.value   = null
  swapMode.value            = null
  swapVariants.value        = []
  swapProductsList.value    = []
  selectedSwapVariant.value = null
  selectedSwapProduct.value = null
  try {
    const opts = await conciarApi.customerSubscriptions.swapOptions(customer.accessToken!, id)
    if ('variants' in opts && opts.variants) {
      swapMode.value     = 'variants'
      swapVariants.value = opts.variants
    } else if ('products' in opts && opts.products) {
      swapMode.value         = 'products'
      swapProductsList.value = opts.products
    }
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
    else swapProductsError.value = t('sub.modal.swap.loadError')
  } finally {
    swapProductsLoading.value = false
  }
}

async function doSwap() {
  if (!swapCanSubmit.value) return
  swapBusy.value  = true
  swapError.value = null
  try {
    let updated: ConciarCustomerSubscription
    if (swapMode.value === 'variants') {
      updated = await conciarApi.customerSubscriptions.swap(
        customer.accessToken!, id, null, selectedSwapVariant.value!.id,
      )
    } else {
      const variantId = activeVariantsForSelected.value.length > 0 ? selectedSwapVariant.value?.id : undefined
      updated = await conciarApi.customerSubscriptions.swap(
        customer.accessToken!, id, selectedSwapProduct.value!.id, variantId,
      )
    }
    modal.value = null
    sub.value   = updated
    swapJustSucceeded.value = true
    setTimeout(() => { swapJustSucceeded.value = false }, 5000)
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
    else swapError.value = e?.body?.message ?? t('sub.modal.error')
  } finally {
    swapBusy.value = false
  }
}

// ─── Renewal delivery (shipping address + method for FUTURE renewals) ───────────
interface ShipForm {
  street: string; house_number: string; apartment: string
  zipcode: string; city: string; state: string; district: string
  country_id: number | null
}
const shipForm           = ref<ShipForm>({ street: '', house_number: '', apartment: '', zipcode: '', city: '', state: '', district: '', country_id: null })
const shipMethods        = ref<ConciarCartShippingMethod[]>([])
const shipMethodsLoading = ref(false)
const shipMethodsError   = ref<string | null>(null)
const selectedShipMethod = ref<ConciarCartShippingMethod | null>(null)
const shipBusy           = ref(false)
const shipError          = ref<string | null>(null)
const shipJustSucceeded  = ref(false)

const selectedShipCountry = computed(() => countries.countries.find(c => c.id === shipForm.value.country_id) ?? null)

async function openShippingModal() {
  modal.value             = 'shipping'
  shipError.value         = null
  shipMethodsError.value  = null
  shipMethods.value       = []
  selectedShipMethod.value = null
  await countries.fetch()
  const a = sub.value?.shipping_address ?? null
  const matchId = a?.country ? (countries.countries.find(c => c.iso_code_2 === a.country!.iso_code_2)?.id ?? null) : null
  shipForm.value = {
    street: a?.street ?? '', house_number: a?.house_number ?? '', apartment: a?.apartment ?? '',
    zipcode: a?.zipcode ?? '', city: a?.city ?? '', state: a?.state ?? '', district: '',
    country_id: matchId,
  }
}

async function findShippingMethods() {
  const country = selectedShipCountry.value
  if (!country || !shipForm.value.city) return
  shipMethodsLoading.value = true
  shipMethodsError.value   = null
  shipMethods.value        = []
  selectedShipMethod.value = null
  try {
    shipMethods.value = await conciarApi.customerSubscriptions.shippingMethods(customer.accessToken!, id, {
      country_code: country.iso_code_2,
      postal_code:  shipForm.value.zipcode || undefined,
      province:     shipForm.value.state || undefined,
      city:         shipForm.value.city || undefined,
      district:     shipForm.value.district || undefined,
    })
    if (shipMethods.value.length === 1) selectedShipMethod.value = shipMethods.value[0]
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
    else shipMethodsError.value = t('sub.modal.shipping.loadError')
  } finally {
    shipMethodsLoading.value = false
  }
}

async function doUpdateShipping() {
  if (!selectedShipMethod.value || !shipForm.value.country_id) return
  shipBusy.value  = true
  shipError.value = null
  try {
    const address: ConciarOrderAddress = {
      street:       shipForm.value.street || undefined,
      house_number: shipForm.value.house_number || undefined,
      apartment:    shipForm.value.apartment || null,
      city:         shipForm.value.city,
      zipcode:      shipForm.value.zipcode || undefined,
      district:     shipForm.value.district || null,
      state:        shipForm.value.state || undefined,
      country_id:   shipForm.value.country_id,
    }
    const updated = await conciarApi.customerSubscriptions.updateShipping(customer.accessToken!, id, {
      shipping_method_id: selectedShipMethod.value.id,
      shipping_address:   address,
    })
    modal.value = null
    sub.value   = updated
    shipJustSucceeded.value = true
    setTimeout(() => { shipJustSucceeded.value = false }, 5000)
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
    else shipError.value = e?.body?.message ?? t('sub.modal.error')
  } finally {
    shipBusy.value = false
  }
}

onMounted(async () => {
  storeConfig.fetch()
  if (route.query.mandate === 'update') {
    mandateJustUpdated.value = true
    router.replace(route.path)
    setTimeout(() => { mandateJustUpdated.value = false }, 6000)
  }
  try {
    sub.value = await conciarApi.customerSubscriptions.get(customer.accessToken!, id)
  } catch (e: any) {
    if (e?.status === 401) { customer.logout(); router.push('/login') }
    else error.value = true
  } finally {
    loading.value = false
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function productInfo(s: ConciarCustomerSubscription) {
  return s.product.defaultInfo ?? s.product.default_info ?? { name: '', description: null }
}

function billingLabel(detail: { billing_cycle_unit: string; billing_cycle_interval: number }) {
  if (detail.billing_cycle_unit === 'four_weekly')
    return t('sub.billing.everyFourWeeks', { n: detail.billing_cycle_interval * 4 })
  const unit  = t(`sub.billing.${detail.billing_cycle_unit}` as any, detail.billing_cycle_unit)
  const units = t(`sub.billing.${detail.billing_cycle_unit}s` as any, unit)
  return detail.billing_cycle_interval === 1
    ? t('sub.billing.every', { unit })
    : t('sub.billing.everyN', { n: detail.billing_cycle_interval, units })
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'short' })
}

// ─── Timeline ────────────────────────────────────────────────────────────────
const cycles = computed(() => sub.value?.cycles ?? [])

const delivered    = computed(() => cycles.value.filter(c => ['active', 'paid'].includes(c.status?.name ?? '')).length)
const skippedCount = computed(() => cycles.value.filter(c => c.status?.name === 'skipped').length)

function addInterval(d: Date, unit: string, n: number): Date {
  const r = new Date(d)
  if (unit === 'four_weekly')    r.setDate(r.getDate() + 28 * n)
  else if (unit === 'week')      r.setDate(r.getDate() + 7 * n)
  else if (unit === 'month')     r.setMonth(r.getMonth() + n)
  else if (unit === 'quarterly') r.setMonth(r.getMonth() + 3 * n)
  else if (unit === 'year')      r.setFullYear(r.getFullYear() + n)
  else r.setDate(r.getDate() + 28 * n)
  return r
}

const futureCycles = computed(() => {
  const s = sub.value
  if (!s?.next_billing_at || s.status.name !== 'active') return []
  const d = s.product.subscription_detail
  if (!d) return []
  const result: Array<{ start: Date; end: Date; willSkip: boolean }> = []
  let cursor = new Date(s.next_billing_at)
  for (let i = 0; i < 5; i++) {
    const end = addInterval(cursor, d.billing_cycle_unit, d.billing_cycle_interval)
    result.push({ start: new Date(cursor), end, willSkip: i < s.skip_count })
    cursor = end
  }
  return result
})

const sortedPast = computed(() =>
  [...cycles.value].sort((a, b) => new Date(a.period_start).getTime() - new Date(b.period_start).getTime())
)

type TLEntry =
  | { kind: 'past'; cycle: (typeof cycles.value)[0] }
  | { kind: 'future'; fc: (typeof futureCycles.value)[0]; futureIndex: number }

const allEntries = computed((): TLEntry[] => [
  ...sortedPast.value.map(c => ({ kind: 'past' as const, cycle: c })),
  ...futureCycles.value.map((fc, i) => ({ kind: 'future' as const, fc, futureIndex: i })),
])

const hasPast     = computed(() => cycles.value.length > 0)
const hasFuture   = computed(() => futureCycles.value.length > 0)
const hasTimeline = computed(() => hasPast.value || hasFuture.value)
// Index of first future entry in allEntries
const futureStartIndex = computed(() => sortedPast.value.length)

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_RING: Record<string, string> = {
  active:    'bg-green-50 text-green-700 border-green-200',
  paused:    'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
}
const STATUS_LABEL = computed<Record<string, string>>(() => ({
  active: t('sub.statusLabel.active'), paused: t('sub.statusLabel.paused'), cancelled: t('sub.statusLabel.cancelled'),
}))

function cycleStatusClass(name: string) {
  if (['active', 'paid'].includes(name)) return 'text-green-700 bg-green-50 border-green-200'
  if (name === 'skipped') return 'text-amber-700 bg-amber-50 border-amber-200'
  if (name === 'failed')  return 'text-red-600 bg-red-50 border-red-200'
  return 'text-blue-700 bg-blue-50 border-blue-200'
}
function cycleDotClass(name: string) {
  if (['active', 'paid'].includes(name)) return 'bg-green-400'
  if (name === 'skipped') return 'bg-amber-300'
  if (name === 'failed')  return 'bg-red-400'
  return 'bg-blue-300'
}
function cycleLabel(name: string) {
  return t(`sub.cycleStatus.${name}` as any)
}

const expandedCycles = ref<number[]>([])
function toggleCycle(id: number) {
  const idx = expandedCycles.value.indexOf(id)
  if (idx >= 0) expandedCycles.value.splice(idx, 1)
  else expandedCycles.value.push(id)
}

function orderStatusClass(name: string) {
  if (['completed', 'paid'].includes(name)) return 'bg-green-50 text-green-700 border-green-200'
  if (name === 'processing') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (['failed', 'cancelled'].includes(name)) return 'bg-red-50 text-red-600 border-red-200'
  return 'bg-gray-50 text-gray-500 border-black/8'
}
function orderStatusLabel(name: string) {
  return t(`sub.orderStatus.${name}` as any)
}

// ─── Commitment ───────────────────────────────────────────────────────────────
const commitmentBlocked = computed(() =>
  (sub.value?.commitment_cycles_remaining ?? 0) > 0
)
const commitmentProgress = computed(() => {
  const s = sub.value
  if (!s?.minimum_commitment_cycles) return null
  const remaining = s.commitment_cycles_remaining ?? 0
  const completed = s.minimum_commitment_cycles - remaining
  return { completed, total: s.minimum_commitment_cycles, remaining }
})
</script>

<template>
  <div class="bg-cream min-h-screen">
    <div class="max-w-2xl mx-auto px-6 py-12">

      <RouterLink :to="{ name: 'subscriptions-account' }"
        class="inline-flex items-center gap-1.5 text-sm font-mono text-gray-400 hover:text-charcoal transition-colors mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
          <path fill-rule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd"/>
        </svg>
        {{ t('sub.back') }}
      </RouterLink>

      <!-- Skeleton -->
      <div v-if="loading" class="flex flex-col gap-5">
        <div class="bg-white rounded-2xl border border-black/8 p-6 animate-pulse space-y-4">
          <div class="flex justify-between"><div class="h-7 w-52 bg-gray-100 rounded" /><div class="h-6 w-16 bg-gray-100 rounded-full" /></div>
          <div class="h-4 w-32 bg-gray-100 rounded" />
          <div class="h-px bg-gray-100" />
          <div class="grid grid-cols-3 gap-4">
            <div v-for="n in 3" :key="n" class="space-y-1.5"><div class="h-3 w-16 bg-gray-100 rounded" /><div class="h-5 w-20 bg-gray-100 rounded" /></div>
          </div>
        </div>
        <div class="bg-white rounded-2xl border border-black/8 p-6 animate-pulse space-y-3">
          <div class="h-3 w-32 bg-gray-100 rounded" />
          <div class="h-11 bg-gray-100 rounded-xl" />
          <div class="flex gap-2 pt-2 border-t border-gray-50">
            <div class="h-11 flex-1 bg-gray-100 rounded-xl" />
            <div class="h-11 w-20 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-16">
        <p class="font-mono text-gray-400 mb-3">{{ t('sub.notFound') }}</p>
        <RouterLink :to="{ name: 'subscriptions-account' }" class="text-sm font-mono text-primary hover:underline">{{ t('sub.backLink') }}</RouterLink>
      </div>

      <div v-else-if="sub" class="flex flex-col gap-4">

        <!-- Mandate updated banner -->
        <Transition enter-active-class="transition duration-300" enter-from-class="opacity-0 -translate-y-2"
                    enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-200"
                    leave-from-class="opacity-100" leave-to-class="opacity-0">
          <div v-if="mandateJustUpdated" class="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 shrink-0 text-green-500">
              <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z" clip-rule="evenodd"/>
            </svg>
            <p class="font-mono text-sm text-green-700">
              <span class="font-semibold">{{ t('sub.banner.mandateUpdated') }}</span>
              {{ t('sub.banner.mandateUpdatedDesc') }}
            </p>
          </div>
        </Transition>

        <!-- Swap success banner -->
        <Transition enter-active-class="transition duration-300" enter-from-class="opacity-0 -translate-y-2"
                    enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-200"
                    leave-from-class="opacity-100" leave-to-class="opacity-0">
          <div v-if="swapJustSucceeded" class="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 shrink-0 text-green-500">
              <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z" clip-rule="evenodd"/>
            </svg>
            <p class="font-mono text-sm text-green-700">
              <span class="font-semibold">{{ t('sub.banner.swapSuccess') }}</span>
              {{ t('sub.banner.swapSuccessDesc') }}
            </p>
          </div>
        </Transition>

        <!-- Delivery updated banner -->
        <Transition enter-active-class="transition duration-300" enter-from-class="opacity-0 -translate-y-2"
                    enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-200"
                    leave-from-class="opacity-100" leave-to-class="opacity-0">
          <div v-if="shipJustSucceeded" class="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 shrink-0 text-green-500">
              <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z" clip-rule="evenodd"/>
            </svg>
            <p class="font-mono text-sm text-green-700">{{ t('sub.banner.shippingSuccess') }}</p>
          </div>
        </Transition>

        <!-- ── Header card ──────────────────────────────────────────────────── -->
        <div class="bg-white rounded-2xl border border-black/8 overflow-hidden">
          <div :class="['h-1', sub.status.name === 'active' ? 'bg-green-400' : sub.status.name === 'paused' ? 'bg-amber-400' : 'bg-red-300']" />
          <div class="p-6">
          <div class="flex items-start justify-between gap-4 mb-5">
            <div class="min-w-0">
              <h1 class="font-display text-2xl font-semibold leading-tight">{{ productInfo(sub).name }}</h1>
              <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                <p v-if="sub.product.subscription_detail" class="text-sm text-gray-400">
                  {{ billingLabel(sub.product.subscription_detail) }}
                </p>
                <span v-if="sub.product.subscription_detail" class="text-gray-300 select-none text-xs">·</span>
                <span class="font-mono text-[10px] text-gray-400">#{{ id }}</span>
              </div>
            </div>
            <span :class="['shrink-0 font-mono text-xs font-semibold px-3 py-1.5 rounded-full border', STATUS_RING[sub.status.name] ?? 'bg-gray-100 text-gray-500 border-black/10']">
              {{ STATUS_LABEL[sub.status.name] ?? sub.status.name }}
            </span>
          </div>

          <div class="grid grid-cols-3 gap-2 border-t border-black/6 pt-5">
            <div class="bg-gray-50 rounded-xl px-3 py-3">
              <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{{ t('sub.stats.price') }}</p>
              <p class="font-mono text-sm font-semibold text-charcoal">
                {{ sub.product.retail_price?.display_price ?? (sub.product.retail_price ? `€ ${sub.product.retail_price.amount}` : '–') }}
              </p>
              <p class="font-mono text-xs text-gray-400 mt-0.5">× {{ sub.quantity }}</p>
            </div>
            <div v-if="sub.next_billing_at && sub.status.name === 'active'" class="bg-gray-50 rounded-xl px-3 py-3">
              <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{{ t('sub.stats.next') }}</p>
              <p class="font-mono text-sm font-semibold text-charcoal">{{ fmtShort(sub.next_billing_at) }}</p>
              <p class="font-mono text-xs text-gray-400 mt-0.5">{{ new Date(sub.next_billing_at).getFullYear() }}</p>
            </div>
            <div v-if="hasPast" class="bg-gray-50 rounded-xl px-3 py-3">
              <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{{ t('sub.stats.deliveredLabel') }}</p>
              <p class="font-mono text-sm font-semibold text-charcoal">{{ delivered }}×</p>
              <p v-if="skippedCount" class="font-mono text-xs text-gray-400 mt-0.5">{{ t('sub.stats.skippedCount', { n: skippedCount }) }}</p>
            </div>
          </div>

          <!-- Product swap row -->
          <div v-if="swapAllowed && sub.status.name !== 'cancelled'" class="mt-4 pt-4 border-t border-black/6 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{{ t('sub.product.label') }}</p>
              <p class="font-mono text-sm font-semibold text-charcoal truncate">{{ productInfo(sub).name }}</p>
            </div>
            <button type="button" @click="openModal('swap')"
              class="shrink-0 font-mono text-xs font-medium px-3 py-1.5 rounded-lg border border-black/12 text-charcoal hover:bg-black/4 transition-colors">
              {{ t('sub.product.swap') }}
            </button>
          </div>

          <!-- Payment method -->
          <div v-if="sub.customer_payment_method" class="mt-4 pt-4 border-t border-black/6 flex items-center justify-between gap-3">
            <div>
              <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{{ t('sub.payment.label') }}</p>
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-gray-400 shrink-0">
                  <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v1h14v-1A1.5 1.5 0 0 0 13.5 3h-11Z"/>
                  <path d="M1 8.5v3A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5v-3H1Zm3 3a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm2.25-.75a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z"/>
                </svg>
                <p class="font-mono text-sm font-semibold text-charcoal">
                  {{ sub.customer_payment_method.payment_method?.name ?? '–' }}
                </p>
                <span v-if="sub.customer_payment_method.iban_last_four" class="font-mono text-xs text-gray-400">
                  ···· {{ sub.customer_payment_method.iban_last_four }}
                </span>
                <span v-else-if="sub.customer_payment_method.last_four" class="font-mono text-xs text-gray-400">
                  ···· {{ sub.customer_payment_method.last_four }}
                  <template v-if="sub.customer_payment_method.expiry_month && sub.customer_payment_method.expiry_year">
                    · {{ String(sub.customer_payment_method.expiry_month).padStart(2, '0') }}/{{ String(sub.customer_payment_method.expiry_year).slice(-2) }}
                  </template>
                </span>
              </div>
            </div>
            <button v-if="sub.status.name !== 'cancelled'" type="button"
              @click="openModal('update_payment')"
              class="shrink-0 font-mono text-xs font-medium px-3 py-1.5 rounded-lg border border-black/12 text-charcoal hover:bg-black/4 transition-colors">
              {{ t('sub.payment.change') }}
            </button>
          </div>

          <div v-if="commitmentProgress" class="mt-4 pt-4 border-t border-black/6 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                  class="w-3.5 h-3.5 shrink-0" :class="commitmentBlocked ? 'text-amber-500' : 'text-green-500'">
                  <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd"/>
                </svg>
                <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{{ t('sub.commitment.label') }}</p>
              </div>
              <span class="font-mono text-xs font-semibold tabular-nums" :class="commitmentBlocked ? 'text-amber-600' : 'text-green-600'">
                {{ commitmentProgress.completed }} / {{ commitmentProgress.total }}
              </span>
            </div>

            <!-- Cycle dots for ≤ 12 cycles -->
            <div v-if="commitmentProgress.total <= 12" class="flex gap-1.5">
              <div
                v-for="i in commitmentProgress.total"
                :key="i"
                :class="[
                  'flex-1 h-6 rounded-md flex items-center justify-center font-mono text-[10px] font-semibold transition-all',
                  i < commitmentProgress.completed
                    ? (commitmentBlocked ? 'bg-amber-200 text-amber-700' : 'bg-green-100 text-green-700')
                    : i === commitmentProgress.completed
                      ? (commitmentBlocked ? 'bg-amber-400 text-white' : 'bg-green-400 text-white')
                      : 'bg-gray-100 text-gray-300',
                ]"
              >{{ i }}</div>
            </div>

            <!-- Progress bar fallback for > 12 cycles -->
            <div v-else class="w-full bg-gray-100 rounded-full h-2">
              <div
                class="h-2 rounded-full transition-all"
                :class="commitmentBlocked ? 'bg-amber-400' : 'bg-green-400'"
                :style="{ width: `${(commitmentProgress.completed / commitmentProgress.total) * 100}%` }"
              />
            </div>

            <p class="font-mono text-xs leading-relaxed" :class="commitmentBlocked ? 'text-amber-600' : 'text-green-600'">
              <template v-if="commitmentBlocked">
                {{ t('sub.commitment.remaining', { n: commitmentProgress.remaining }, commitmentProgress.remaining) }}
              </template>
              <template v-else-if="sub.renew_commitment_on_cycle">
                {{ t('sub.commitment.completedRenew') }}
              </template>
              <template v-else>
                {{ t('sub.commitment.completedFree') }}
              </template>
            </p>
          </div>
          </div>
        </div>

        <!-- ── Action bar ───────────────────────────────────────────────────── -->

        <!-- Cancelled -->
        <div v-if="sub.status.name === 'cancelled'" class="bg-white rounded-2xl border border-red-100 p-5 flex items-start gap-3">
          <div class="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-red-400">
              <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm2.78-4.22a.75.75 0 0 1-1.06 0L8 9.06l-1.72 1.72a.75.75 0 1 1-1.06-1.06L6.94 8 5.22 6.28a.75.75 0 0 1 1.06-1.06L8 6.94l1.72-1.72a.75.75 0 1 1 1.06 1.06L9.06 8l1.72 1.72a.75.75 0 0 1 0 1.06Z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div>
            <p class="font-mono text-sm font-semibold text-red-600">
              {{ sub.cancelled_at ? t('sub.cancelledState.cancelledOn', { date: fmt(sub.cancelled_at) }) : t('sub.cancelledState.cancelledOnly') }}
            </p>
            <p v-if="sub.cancellation_reason" class="font-mono text-xs text-gray-400 mt-1">{{ sub.cancellation_reason }}</p>
          </div>
        </div>

        <!-- Paused -->
        <div v-else-if="sub.status.name === 'paused'" class="bg-white rounded-2xl border border-black/8 p-6">
          <div class="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5">
            <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-amber-500">
                <path d="M4.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2ZM9.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2Z"/>
              </svg>
            </div>
            <div>
              <p class="font-mono text-sm font-semibold text-amber-800">{{ t('sub.pausedState.title') }}</p>
              <p class="font-mono text-xs text-amber-700 mt-0.5 leading-relaxed">{{ t('sub.pausedState.desc') }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button type="button" :disabled="actionBusy" @click="doResume"
              class="flex-1 bg-charcoal text-white font-mono font-medium text-sm py-3 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              <svg v-if="actionBusy" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                <path d="M3 3.732a1.5 1.5 0 0 1 2.305-1.265l6.706 4.267a1.5 1.5 0 0 1 0 2.531l-6.706 4.268A1.5 1.5 0 0 1 3 12.267V3.732Z"/>
              </svg>
              {{ t('sub.pausedState.resume') }}
            </button>
            <button
              type="button"
              @click="openModal('cancel')"
              class="font-mono text-sm text-red-400 hover:text-red-600 transition-colors px-4 py-3">
              {{ t('sub.pausedState.cancel') }}
            </button>
          </div>
        </div>

        <!-- Active -->
        <div v-else-if="sub.status.name === 'active'" class="bg-white rounded-2xl border border-black/8 p-6">

          <!-- skip_count > 0: pending skips banner + unskip -->
          <template v-if="sub.skip_count > 0 && !commitmentBlocked">
            <div class="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4">
              <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-amber-500">
                  <path d="M3.75 2a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V9.964l5.544 3.543A.75.75 0 0 0 11.25 12.9V9.964l5.294 3.382-.001.001A.75.75 0 0 0 12 13.286V2.714a.75.75 0 0 0-1.206-.629L5.25 5.629V2.75A.75.75 0 0 0 3.75 2Z"/>
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-mono text-sm font-semibold text-amber-800">
                  {{ t('sub.activeState.skipsActive', { n: sub.skip_count }, sub.skip_count) }}
                </p>
                <p v-if="sub.next_billing_at" class="font-mono text-xs text-amber-700 mt-0.5">
                  {{ t('sub.activeState.nextCharge', { date: fmt(sub.next_billing_at) }) }}
                </p>
              </div>
            </div>
            <div class="flex gap-2 mb-5">
              <button type="button" :disabled="actionBusy" @click="doUnskip1"
                class="flex-1 border border-black/12 text-charcoal font-mono text-sm py-3 rounded-xl hover:bg-black/4 transition-colors disabled:opacity-40">
                {{ t('sub.activeState.removeOneSkip') }}
              </button>
              <button type="button" :disabled="actionBusy" @click="doUnskipAll"
                class="flex-1 border border-black/12 text-charcoal font-mono text-sm py-3 rounded-xl hover:bg-black/4 transition-colors disabled:opacity-40">
                {{ t('sub.activeState.removeAllSkips') }}
              </button>
            </div>
          </template>

          <!-- commitment active: locked state -->
          <template v-else-if="commitmentBlocked">
            <div class="flex flex-col items-center text-center py-3 mb-5">
              <div class="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-5 h-5 text-amber-500">
                  <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd"/>
                </svg>
              </div>
              <p class="font-mono text-sm font-semibold text-charcoal mb-1">{{ t('sub.activeState.commitmentTitle') }}</p>
              <p class="font-mono text-xs text-gray-400 leading-relaxed max-w-xs">
                {{ t('sub.activeState.commitmentDesc') }}
                <span class="font-semibold text-amber-600">{{ t('sub.activeState.commitmentRemaining', { n: commitmentProgress?.remaining ?? 0 }, commitmentProgress?.remaining ?? 0) }}</span>
              </p>
            </div>
          </template>

          <!-- skip_count === 0: skip stepper -->
          <template v-else>
            <div class="flex items-center gap-3 mb-5">
              <div class="flex items-center bg-cream rounded-xl border border-black/10 overflow-hidden shrink-0">
                <button type="button" :disabled="skipCount <= 1" @click="skipCount--"
                  class="w-10 h-11 flex items-center justify-center hover:bg-black/6 transition-colors font-mono text-lg disabled:opacity-30">−</button>
                <span class="w-10 text-center font-mono text-sm font-semibold tabular-nums">{{ skipCount }}</span>
                <button type="button" :disabled="skipCount >= 12" @click="skipCount++"
                  class="w-10 h-11 flex items-center justify-center hover:bg-black/6 transition-colors font-mono text-lg disabled:opacity-30">+</button>
              </div>
              <button type="button" :disabled="actionBusy" @click="doSkip"
                class="flex-1 bg-charcoal text-white font-mono font-medium text-sm py-3 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                <svg v-if="actionBusy" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {{ skipCount === 1 ? t('sub.activeState.skipOne') : t('sub.activeState.skipN', { n: skipCount }) }}
              </button>
            </div>
          </template>

          <!-- Renewal delivery -->
          <div class="pt-4 border-t border-black/6">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em] mb-1">{{ t('sub.delivery.title') }}</p>
                <template v-if="sub.shipping_address">
                  <p class="text-sm text-charcoal truncate">
                    {{ [sub.shipping_address.street, sub.shipping_address.house_number].filter(Boolean).join(' ') }}<span v-if="sub.shipping_address.city">, {{ sub.shipping_address.zipcode }} {{ sub.shipping_address.city }}</span>
                  </p>
                  <p v-if="sub.shipping_method" class="font-mono text-xs text-gray-400 mt-0.5">{{ sub.shipping_method.name }}</p>
                </template>
                <p v-else class="text-sm text-gray-400">{{ t('sub.delivery.none') }}</p>
              </div>
              <button type="button" @click="openShippingModal" class="shrink-0 font-mono text-xs text-primary hover:underline">
                {{ t('sub.delivery.change') }}
              </button>
            </div>
          </div>

          <!-- Secondary actions -->
          <div class="flex items-center gap-2 pt-4 border-t border-black/6">
            <button v-if="!commitmentBlocked" type="button" :disabled="actionBusy" @click="openModal('pause')"
              class="flex-1 border border-black/12 text-charcoal font-mono text-sm py-3 rounded-xl hover:bg-black/4 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5 opacity-60">
                <path d="M4.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2ZM9.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2Z"/>
              </svg>
              {{ t('sub.activeState.pause') }}
            </button>
            <button
              type="button"
              @click="openModal('cancel')"
              :class="[
                'font-mono text-sm text-red-400 hover:text-red-600 transition-colors rounded-xl hover:bg-red-50',
                commitmentBlocked ? 'flex-1 border border-red-200 py-3' : 'px-5 py-3',
              ]">
              {{ t('sub.activeState.cancelSub') }}
            </button>
          </div>
        </div>

        <!-- ── Unified timeline ─────────────────────────────────────────────── -->
        <div v-if="hasTimeline" class="bg-white rounded-2xl border border-black/8 overflow-hidden">
          <div class="px-6 py-4 border-b border-black/6 flex items-center justify-between">
            <p class="font-mono text-xs font-semibold text-gray-400 uppercase tracking-wider">{{ t('sub.timeline.title') }}</p>
            <span class="font-mono text-[10px] text-gray-400">
              {{ hasFuture && hasPast ? t('sub.timeline.both') : hasFuture ? t('sub.timeline.upcoming') : t('sub.timeline.history') }}
            </span>
          </div>

          <div class="px-6 pt-5 pb-2">
            <ol>
              <li v-for="(entry, i) in allEntries" :key="i" class="flex gap-4">

                <!-- Spine column -->
                <div class="flex flex-col items-center shrink-0 w-3">
                  <div :class="[
                    'w-3 h-3 rounded-full ring-2 ring-white shrink-0 mt-0.5',
                    entry.kind === 'past'
                      ? cycleDotClass(entry.cycle.status?.name ?? '')
                      : entry.fc.willSkip ? 'bg-amber-300'
                      : entry.futureIndex === 0 ? 'bg-primary'
                      : 'bg-gray-200'
                  ]" />
                  <!-- Connecting line — dashed for future -->
                  <div v-if="i < allEntries.length - 1" :class="[
                    'w-px flex-1 min-h-[2.5rem] my-1',
                    i >= futureStartIndex - 1 ? 'bg-gray-100' : 'bg-gray-150'
                  ]" :style="i >= futureStartIndex - 1 ? 'background: repeating-linear-gradient(to bottom, #e5e7eb 0, #e5e7eb 4px, transparent 4px, transparent 8px)' : ''" />
                </div>

                <!-- Content column -->
                <div class="flex-1 min-w-0 pb-5">

                  <!-- Vandaag label — shown above the first future entry's content -->
                  <div v-if="entry.kind === 'future' && entry.futureIndex === 0 && hasPast"
                    class="flex items-center gap-2 mb-3">
                    <span class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{{ t('sub.timeline.today') }}</span>
                    <div class="flex-1 h-px bg-gray-200" />
                  </div>

                  <!-- Past entry -->
                  <template v-if="entry.kind === 'past'">
                    <div
                      class="flex items-start justify-between gap-3"
                      :class="{ 'cursor-pointer': !!entry.cycle.order }"
                      @click="entry.cycle.order && toggleCycle(entry.cycle.id)"
                    >
                      <div class="min-w-0">
                        <p class="font-mono text-sm text-gray-600">
                          {{ fmtShort(entry.cycle.period_start) }} – {{ fmtShort(entry.cycle.period_end) }}
                        </p>
                        <p v-if="entry.cycle.attempted_at" class="font-mono text-xs text-gray-400 mt-0.5">
                          {{ fmt(entry.cycle.attempted_at) }}
                        </p>
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <span :class="['inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2.5 py-1 rounded-full border', cycleStatusClass(entry.cycle.status?.name ?? '')]">
                          <svg v-if="['active','paid'].includes(entry.cycle.status?.name ?? '')" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
                            <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z" clip-rule="evenodd"/>
                          </svg>
                          <svg v-else-if="entry.cycle.status?.name === 'skipped'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
                            <path d="M3.75 2a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V9.964l5.544 3.543A.75.75 0 0 0 11.25 12.9V9.964l5.294 3.382-.001.001A.75.75 0 0 0 12 13.286V2.714a.75.75 0 0 0-1.206-.629L5.25 5.629V2.75A.75.75 0 0 0 3.75 2Z"/>
                          </svg>
                          <svg v-else-if="entry.cycle.status?.name === 'failed'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
                            <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm2.78-4.22a.75.75 0 0 1-1.06 0L8 9.06l-1.72 1.72a.75.75 0 1 1-1.06-1.06L6.94 8 5.22 6.28a.75.75 0 0 1 1.06-1.06L8 6.94l1.72-1.72a.75.75 0 1 1 1.06 1.06L9.06 8l1.72 1.72a.75.75 0 0 1 0 1.06Z" clip-rule="evenodd"/>
                          </svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
                            <path fill-rule="evenodd" d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7.75-4.25a.75.75 0 0 0-1.5 0V8c0 .414.336.75.75.75h3.25a.75.75 0 0 0 0-1.5h-2.5v-3.5Z" clip-rule="evenodd"/>
                          </svg>
                          {{ cycleLabel(entry.cycle.status?.name ?? '') }}
                        </span>
                        <svg v-if="entry.cycle.order" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
                          :class="['w-3.5 h-3.5 text-gray-400 transition-transform duration-150 shrink-0', expandedCycles.includes(entry.cycle.id) ? 'rotate-180' : '']">
                          <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
                        </svg>
                      </div>
                    </div>

                    <!-- Expanded order detail -->
                    <div v-if="entry.cycle.order && expandedCycles.includes(entry.cycle.id)"
                      class="mt-2 bg-gray-50 rounded-lg border border-black/6 px-3 py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{{ t('sub.timeline.orderLabel') }}</p>
                        <p class="font-mono text-xs font-semibold text-charcoal">{{ entry.cycle.order.reference }}</p>
                      </div>
                      <span :class="['font-mono text-[10px] font-semibold px-2.5 py-1 rounded-full border', orderStatusClass(entry.cycle.order.status?.name ?? '')]">
                        {{ orderStatusLabel(entry.cycle.order.status?.name ?? '') }}
                      </span>
                    </div>
                  </template>

                  <!-- Future entry -->
                  <template v-else>
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <p :class="['font-mono text-sm', entry.futureIndex === 0 && !entry.fc.willSkip ? 'font-semibold text-charcoal' : 'text-gray-400']">
                          {{ fmtShort(entry.fc.start.toISOString()) }} – {{ fmtShort(entry.fc.end.toISOString()) }}
                        </p>
                      </div>
                      <span :class="[
                        'shrink-0 inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2.5 py-1 rounded-full border',
                        entry.fc.willSkip       ? 'text-amber-700 bg-amber-50 border-amber-200' :
                        entry.futureIndex === 0 ? 'text-primary bg-rose-50 border-rose-200' :
                                                  'text-gray-400 bg-gray-50 border-black/8'
                      ]">
                        <svg v-if="entry.fc.willSkip" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
                          <path d="M3.75 2a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V9.964l5.544 3.543A.75.75 0 0 0 11.25 12.9V9.964l5.294 3.382-.001.001A.75.75 0 0 0 12 13.286V2.714a.75.75 0 0 0-1.206-.629L5.25 5.629V2.75A.75.75 0 0 0 3.75 2Z"/>
                        </svg>
                        <svg v-else-if="entry.futureIndex === 0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
                          <path fill-rule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clip-rule="evenodd"/>
                        </svg>
                        <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3">
                          <path fill-rule="evenodd" d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7.75-4.25a.75.75 0 0 0-1.5 0V8c0 .414.336.75.75.75h3.25a.75.75 0 0 0 0-1.5h-2.5v-3.5Z" clip-rule="evenodd"/>
                        </svg>
                        {{ entry.fc.willSkip ? t('sub.cycleStatus.skipped') : entry.futureIndex === 0 ? t('sub.timeline.next') : t('sub.cycleStatus.pending') }}
                      </span>
                    </div>
                  </template>
                </div>
              </li>
            </ol>
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ── Pause / Cancel modal ────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0" enter-to-class="opacity-100"
                leave-active-class="transition duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="modal" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeModal" />
        <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0 translate-y-3 scale-[0.98]"
                    enter-to-class="opacity-100 translate-y-0 scale-100"
                    leave-active-class="transition duration-150" leave-from-class="opacity-100 translate-y-0 scale-100"
                    leave-to-class="opacity-0 translate-y-3 scale-[0.98]">
          <div
            v-if="modal"
            ref="modalRef"
            role="dialog"
            aria-modal="true"
            class="relative w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6 z-10"
          >
            <button type="button" @click="closeModal" aria-label="Close"
              class="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-charcoal hover:bg-black/6 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"/>
              </svg>
            </button>

            <!-- Swap product -->
            <template v-if="modal === 'swap'">
              <div class="w-10 h-10 rounded-full bg-charcoal/8 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-5 h-5 text-charcoal">
                  <path fill-rule="evenodd" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0ZM3.28 4.22a.75.75 0 0 0-1.06 0l-.5.5a.75.75 0 0 0 0 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l.5-.5a.75.75 0 0 0 0-1.06l-3.5-3.5Z" clip-rule="evenodd"/>
                </svg>
              </div>
              <h2 class="font-display text-xl font-semibold mb-1">
                {{ swapMode === 'variants' ? t('sub.modal.swap.titleVariants') : t('sub.modal.swap.titleProducts') }}
              </h2>
              <p class="text-sm text-gray-500 leading-relaxed mb-5">
                {{ swapMode === 'variants' ? t('sub.modal.swap.descVariants') : t('sub.modal.swap.descProducts') }}
              </p>

              <!-- Loading -->
              <div v-if="swapProductsLoading" class="flex items-center justify-center py-8">
                <svg class="w-5 h-5 animate-spin text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>

              <!-- Error loading -->
              <p v-else-if="swapProductsError" class="font-mono text-xs text-red-500 mb-4">{{ swapProductsError }}</p>

              <template v-else>
                <!-- Variants mode: pick a variant of the same product -->
                <div v-if="swapMode === 'variants'" class="flex flex-col gap-2 mb-5 max-h-72 overflow-y-auto -mx-1 px-1">
                  <button
                    v-for="variant in swapVariants"
                    :key="variant.id"
                    type="button"
                    @click="selectedSwapVariant = variant"
                    :class="[
                      'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left',
                      selectedSwapVariant?.id === variant.id
                        ? 'border-charcoal bg-black/4'
                        : 'border-black/10 hover:border-black/25',
                    ]"
                  >
                    <div :class="['w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all', selectedSwapVariant?.id === variant.id ? 'border-charcoal' : 'border-gray-300']">
                      <div v-if="selectedSwapVariant?.id === variant.id" class="w-2 h-2 rounded-full bg-charcoal" />
                    </div>
                    <p class="flex-1 font-mono text-sm font-semibold text-charcoal truncate">
                      {{ variant.default_info?.name ?? `Variant ${variant.id}` }}
                    </p>
                    <span v-if="variant.retail_price" class="shrink-0 font-mono text-sm font-semibold text-charcoal">
                      {{ variant.retail_price.currency.symbol_icon }} {{ Number(variant.retail_price.amount).toFixed(2) }}
                    </span>
                  </button>
                  <p v-if="!swapVariants.length" class="font-mono text-xs text-gray-400 text-center py-6">
                    {{ t('sub.modal.swap.noVariants') }}
                  </p>
                </div>

                <!-- Products mode: pick a product, then optionally a variant -->
                <template v-else-if="swapMode === 'products'">
                  <div class="flex flex-col gap-2 mb-4 max-h-60 overflow-y-auto -mx-1 px-1">
                    <button
                      v-for="product in swapProductsList"
                      :key="product.id"
                      type="button"
                      @click="selectSwapProduct(product)"
                      :class="[
                        'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left',
                        selectedSwapProduct?.id === product.id
                          ? 'border-charcoal bg-black/4'
                          : 'border-black/10 hover:border-black/25',
                      ]"
                    >
                      <div :class="['w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all', selectedSwapProduct?.id === product.id ? 'border-charcoal' : 'border-gray-300']">
                        <div v-if="selectedSwapProduct?.id === product.id" class="w-2 h-2 rounded-full bg-charcoal" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="font-mono text-sm font-semibold text-charcoal truncate">
                          {{ product.default_info?.name ?? `Product ${product.id}` }}
                        </p>
                        <p v-if="product.subscription_detail" class="font-mono text-xs text-gray-400 mt-0.5">
                          {{ billingLabel(product.subscription_detail) }}
                        </p>
                      </div>
                      <span v-if="product.retail_price" class="shrink-0 font-mono text-sm font-semibold text-charcoal">
                        {{ product.retail_price.currency.symbol_icon }} {{ Number(product.retail_price.amount).toFixed(2) }}
                      </span>
                    </button>
                    <p v-if="!swapProductsList.length" class="font-mono text-xs text-gray-400 text-center py-6">
                      {{ t('sub.modal.swap.noProducts') }}
                    </p>
                  </div>

                  <!-- Variant sub-picker — only when selected product has multiple active variants -->
                  <div v-if="selectedSwapProduct && activeVariantsForSelected.length > 1" class="mb-4">
                    <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{{ t('sub.modal.swap.variantLabel') }}</p>
                    <div class="flex flex-col gap-1.5">
                      <button
                        v-for="variant in activeVariantsForSelected"
                        :key="variant.id"
                        type="button"
                        @click="selectedSwapVariant = variant"
                        :class="[
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left',
                          selectedSwapVariant?.id === variant.id
                            ? 'border-charcoal bg-black/4'
                            : 'border-black/10 hover:border-black/20',
                        ]"
                      >
                        <div :class="['w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all', selectedSwapVariant?.id === variant.id ? 'border-charcoal' : 'border-gray-300']">
                          <div v-if="selectedSwapVariant?.id === variant.id" class="w-1.5 h-1.5 rounded-full bg-charcoal" />
                        </div>
                        <p class="flex-1 font-mono text-sm text-charcoal truncate">
                          {{ variant.default_info?.name ?? `Variant ${variant.id}` }}
                        </p>
                        <span v-if="variant.retail_price" class="shrink-0 font-mono text-sm font-semibold text-charcoal">
                          {{ variant.retail_price.currency.symbol_icon }} {{ Number(variant.retail_price.amount).toFixed(2) }}
                        </span>
                      </button>
                    </div>
                  </div>
                </template>
              </template>

              <p v-if="swapError" class="font-mono text-xs text-red-500 mb-3">{{ swapError }}</p>
              <div class="flex flex-col gap-2">
                <button type="button"
                  :disabled="swapBusy || !swapCanSubmit || swapProductsLoading"
                  @click="doSwap"
                  class="w-full bg-charcoal text-white font-mono font-medium text-sm py-3 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  <svg v-if="swapBusy" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {{ swapBusy ? t('sub.modal.swap.submitting') : t('sub.modal.swap.submit') }}
                </button>
                <button type="button" :disabled="swapBusy" @click="closeModal"
                  class="w-full font-mono text-sm text-gray-400 hover:text-charcoal transition-colors py-2.5 rounded-xl hover:bg-black/4">
                  {{ t('sub.modal.swap.back') }}
                </button>
              </div>
            </template>

            <!-- Pause -->
            <template v-else-if="modal === 'pause'">
              <div class="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-5 h-5 text-amber-500">
                  <path d="M4.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2ZM9.5 2a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h2a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-2Z"/>
                </svg>
              </div>
              <h2 class="font-display text-xl font-semibold mb-1">{{ t('sub.modal.pause.title') }}</h2>
              <p class="text-sm text-gray-500 leading-relaxed mb-6">{{ t('sub.modal.pause.desc') }}</p>
              <p v-if="actionError" class="font-mono text-xs text-red-500 mb-3">{{ actionError }}</p>
              <div class="flex flex-col gap-2">
                <button type="button" :disabled="actionBusy" @click="confirmPause"
                  class="w-full bg-amber-500 text-white font-mono font-medium text-sm py-3 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  <svg v-if="actionBusy" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {{ t('sub.modal.pause.confirm') }}
                </button>
                <button type="button" :disabled="actionBusy" @click="closeModal"
                  class="w-full font-mono text-sm text-gray-400 hover:text-charcoal transition-colors py-2.5 rounded-xl hover:bg-black/4">
                  {{ t('sub.modal.pause.back') }}
                </button>
              </div>
            </template>

            <!-- Update payment method -->
            <template v-else-if="modal === 'update_payment'">
              <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-5 h-5 text-blue-500">
                  <path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v1h14v-1A1.5 1.5 0 0 0 13.5 3h-11Z"/>
                  <path d="M1 8.5v3A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5v-3H1Zm3 3a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Zm2.25-.75a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0Z"/>
                </svg>
              </div>
              <h2 class="font-display text-xl font-semibold mb-1">{{ t('sub.modal.payment.title') }}</h2>
              <p class="text-sm text-gray-500 leading-relaxed mb-5">{{ t('sub.modal.payment.desc') }}</p>

              <!-- Loading -->
              <div v-if="mandateMethodsLoading" class="flex items-center justify-center py-6">
                <svg class="w-5 h-5 animate-spin text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>

              <!-- Error loading methods -->
              <p v-else-if="mandateMethodsError" class="font-mono text-xs text-red-500 mb-4">{{ mandateMethodsError }}</p>

              <!-- Method list -->
              <div v-else class="flex flex-col gap-2 mb-4">
                <button
                  v-for="method in mandatePaymentMethods"
                  :key="method.id"
                  type="button"
                  @click="selectedMandateMethod = method"
                  :class="[
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left',
                    selectedMandateMethod?.id === method.id
                      ? 'border-charcoal bg-black/4'
                      : 'border-black/10 hover:border-black/25',
                  ]"
                >
                  <div :class="['w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all', selectedMandateMethod?.id === method.id ? 'border-charcoal' : 'border-gray-300']">
                    <div v-if="selectedMandateMethod?.id === method.id" class="w-2 h-2 rounded-full bg-charcoal" />
                  </div>
                  <span class="font-mono text-sm font-medium text-charcoal">{{ method.name }}</span>
                  <span v-if="method.payment_service_provider" class="ml-auto font-mono text-xs text-gray-400">{{ method.payment_service_provider.name }}</span>
                </button>
                <p v-if="!mandatePaymentMethods.length" class="font-mono text-xs text-gray-400 text-center py-4">
                  {{ t('sub.modal.payment.noMethods') }}
                </p>
              </div>

              <!-- Mandate charge notice -->
              <div v-if="!mandateMethodsLoading && !mandateMethodsError" class="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5 shrink-0 text-blue-400 mt-0.5">
                  <path fill-rule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM9 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.75 8a.75.75 0 0 0 0 1.5h.75v1.75a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8.25 8h-1.5Z" clip-rule="evenodd"/>
                </svg>
                <p class="font-mono text-xs text-blue-700 leading-relaxed"
                  v-html="t('sub.modal.payment.mandateNotice', { amount: '<strong>€ 0,01</strong>' })">
                </p>
              </div>

              <p v-if="updatePaymentError" class="font-mono text-xs text-red-500 mb-3">{{ updatePaymentError }}</p>
              <div class="flex flex-col gap-2">
                <button type="button"
                  :disabled="updatePaymentBusy || !selectedMandateMethod || mandateMethodsLoading"
                  @click="doUpdatePaymentMethod"
                  class="w-full bg-charcoal text-white font-mono font-medium text-sm py-3 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  <svg v-if="updatePaymentBusy" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                    <path fill-rule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clip-rule="evenodd"/>
                  </svg>
                  <template v-if="updatePaymentBusy">{{ t('sub.modal.payment.proceeding') }}</template>
                  <template v-else-if="selectedMandateMethod?.payment_service_provider">
                    {{ t('sub.modal.payment.proceedTo', { provider: selectedMandateMethod.payment_service_provider.name }) }}
                  </template>
                  <template v-else>{{ t('sub.modal.payment.proceed') }}</template>
                </button>
                <button type="button" :disabled="updatePaymentBusy" @click="closeModal"
                  class="w-full font-mono text-sm text-gray-400 hover:text-charcoal transition-colors py-2.5 rounded-xl hover:bg-black/4">
                  {{ t('sub.modal.payment.back') }}
                </button>
              </div>
            </template>

            <!-- Cancel -->
            <template v-else-if="modal === 'cancel'">
              <div class="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-5 h-5 text-red-500">
                  <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm2.78-4.22a.75.75 0 0 1-1.06 0L8 9.06l-1.72 1.72a.75.75 0 1 1-1.06-1.06L6.94 8 5.22 6.28a.75.75 0 0 1 1.06-1.06L8 6.94l1.72-1.72a.75.75 0 1 1 1.06 1.06L9.06 8l1.72 1.72a.75.75 0 0 1 0 1.06Z" clip-rule="evenodd"/>
                </svg>
              </div>
              <h2 class="font-display text-xl font-semibold mb-1">{{ t('sub.modal.cancel.title') }}</h2>
              <p class="text-sm text-gray-500 leading-relaxed mb-4">{{ t('sub.modal.cancel.desc') }}</p>
              <div v-if="commitmentBlocked && commitmentProgress" class="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 shrink-0 text-amber-500 mt-0.5">
                  <path fill-rule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
                </svg>
                <p class="font-mono text-xs text-amber-700 leading-relaxed"
                  v-html="t('sub.modal.cancel.commitmentWarning', { n: commitmentProgress.remaining, cycles: `<strong>${commitmentProgress.remaining === 1 ? t('sub.modal.cancel.cycle') : t('sub.modal.cancel.cycles')}</strong>` })">
                </p>
              </div>
              <label class="block font-mono text-xs text-gray-400 mb-1.5">{{ t('sub.modal.cancel.reasonLabel') }}</label>
              <input v-model="cancelReason" type="text" :placeholder="t('sub.modal.cancel.reasonPlaceholder')"
                class="w-full font-mono text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-cream focus:outline-none focus:border-black/30 mb-4" />
              <p v-if="actionError" class="font-mono text-xs text-red-500 mb-3">{{ actionError }}</p>
              <div class="flex flex-col gap-2">
                <button type="button" :disabled="actionBusy" @click="confirmCancel"
                  class="w-full bg-red-500 text-white font-mono font-medium text-sm py-3 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  <svg v-if="actionBusy" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {{ t('sub.modal.cancel.confirm') }}
                </button>
                <button type="button" :disabled="actionBusy" @click="closeModal"
                  class="w-full font-mono text-sm text-gray-400 hover:text-charcoal transition-colors py-2.5 rounded-xl hover:bg-black/4">
                  {{ t('sub.modal.cancel.back') }}
                </button>
              </div>
            </template>

            <!-- Change renewal delivery -->
            <template v-else-if="modal === 'shipping'">
              <div class="w-10 h-10 rounded-full bg-charcoal/8 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-5 h-5 text-charcoal">
                  <path d="M1 3.75A.75.75 0 0 1 1.75 3h8.5a.75.75 0 0 1 .75.75V5h1.92c.62 0 1.2.33 1.52.87l1.07 1.83c.16.27.24.58.24.9v2.65A1.75 1.75 0 0 1 15 12.75h-.6a2 2 0 0 1-3.92 0H6.52a2 2 0 0 1-3.92 0H1.75A.75.75 0 0 1 1 12V3.75Z"/>
                </svg>
              </div>
              <h2 class="font-display text-xl font-semibold mb-1">{{ t('sub.modal.shipping.title') }}</h2>
              <p class="text-sm text-gray-500 leading-relaxed mb-5">{{ t('sub.modal.shipping.desc') }}</p>

              <div class="flex flex-col gap-2.5 mb-4">
                <select v-model.number="shipForm.country_id" @change="shipMethods = []; selectedShipMethod = null"
                  class="w-full font-mono text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-cream focus:outline-none focus:border-black/30">
                  <option :value="null" disabled>{{ t('sub.modal.shipping.country') }}</option>
                  <option v-for="c in countries.countries" :key="c.id" :value="c.id">{{ formatCountryName(c.name) }}</option>
                </select>
                <div class="grid grid-cols-[1fr_5rem] gap-2.5">
                  <input v-model="shipForm.street" type="text" :placeholder="t('sub.modal.shipping.street')"
                    class="w-full font-mono text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-cream focus:outline-none focus:border-black/30" />
                  <input v-model="shipForm.house_number" type="text" :placeholder="t('sub.modal.shipping.houseNumber')"
                    class="w-full font-mono text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-cream focus:outline-none focus:border-black/30" />
                </div>
                <input v-model="shipForm.apartment" type="text" :placeholder="t('sub.modal.shipping.apartment')"
                  class="w-full font-mono text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-cream focus:outline-none focus:border-black/30" />
                <div class="grid grid-cols-[7rem_1fr] gap-2.5">
                  <input v-model="shipForm.zipcode" type="text" :placeholder="t('sub.modal.shipping.zipcode')"
                    class="w-full font-mono text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-cream focus:outline-none focus:border-black/30" />
                  <input v-model="shipForm.city" type="text" :placeholder="t('sub.modal.shipping.city')"
                    class="w-full font-mono text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-cream focus:outline-none focus:border-black/30" />
                </div>
                <input v-model="shipForm.state" type="text" :placeholder="t('sub.modal.shipping.state')"
                  class="w-full font-mono text-sm px-3 py-2.5 rounded-xl border border-black/10 bg-cream focus:outline-none focus:border-black/30" />
              </div>

              <button type="button" :disabled="!shipForm.country_id || !shipForm.city || shipMethodsLoading" @click="findShippingMethods"
                class="w-full border border-black/12 font-mono text-sm py-2.5 rounded-xl hover:bg-black/4 transition-colors disabled:opacity-40 mb-3 flex items-center justify-center gap-2">
                <svg v-if="shipMethodsLoading" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {{ t('sub.modal.shipping.findOptions') }}
              </button>

              <p v-if="shipMethodsError" class="font-mono text-xs text-red-500 mb-3">{{ shipMethodsError }}</p>

              <div v-if="shipMethods.length" class="flex flex-col gap-2 mb-4 max-h-52 overflow-y-auto -mx-1 px-1">
                <button v-for="m in shipMethods" :key="m.id" type="button" @click="selectedShipMethod = m"
                  :class="[
                    'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left',
                    selectedShipMethod?.id === m.id ? 'border-charcoal bg-black/4' : 'border-black/10 hover:border-black/25',
                  ]">
                  <div :class="['w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center', selectedShipMethod?.id === m.id ? 'border-charcoal' : 'border-gray-300']">
                    <div v-if="selectedShipMethod?.id === m.id" class="w-2 h-2 rounded-full bg-charcoal" />
                  </div>
                  <p class="flex-1 font-mono text-sm font-semibold text-charcoal truncate">{{ m.resolved_info.name }}</p>
                  <span class="shrink-0 font-mono text-sm text-charcoal">{{ m.is_free ? t('sub.modal.shipping.free') : (m.rate?.display_price ?? '') }}</span>
                </button>
              </div>

              <p v-if="shipError" class="font-mono text-xs text-red-500 mb-3">{{ shipError }}</p>

              <div class="flex flex-col gap-2">
                <button type="button" :disabled="!selectedShipMethod || shipBusy" @click="doUpdateShipping"
                  class="w-full bg-charcoal text-white font-mono font-medium text-sm py-3 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  <svg v-if="shipBusy" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {{ t('sub.modal.shipping.save') }}
                </button>
                <button type="button" :disabled="shipBusy" @click="closeModal"
                  class="w-full font-mono text-sm text-gray-400 hover:text-charcoal transition-colors py-2.5 rounded-xl hover:bg-black/4">
                  {{ t('sub.modal.shipping.back') }}
                </button>
              </div>
            </template>

          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
