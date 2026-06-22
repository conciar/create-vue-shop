<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useCustomerStore } from '@/stores/customer'
import { useCountriesStore, formatCountryName } from '@/stores/countries'
import { useStoreConfigStore } from '@/stores/storeConfig'
import { useCoupon } from '@/composables/useCoupon'
import { useShippingPickers } from '@/composables/useShippingPickers'
import { conciarApi } from '@/api/conciar'
import OtpLoginForm from '@/components/checkout/OtpLoginForm.vue'
import PhoneInput from '@/components/checkout/PhoneInput.vue'
import PriceWarningModal from '@/components/checkout/PriceWarningModal.vue'
import CheckoutIssuesModal from '@/components/checkout/CheckoutIssuesModal.vue'
import type { ConciarCartShippingMethod, ConciarCartPaymentMethod, ConciarPriceWarning, ConciarCheckoutIssue, ConciarCouponWarning, ConciarPickupLocation } from '@/api/conciar-types'
import type { CheckoutForm, BillingAddress, SubscriptionBox } from '@/types'

const { t } = useI18n()
const cart = useCartStore()
const auth = useAuthStore()
const customerAuth = useCustomerStore()
const countriesStore = useCountriesStore()
const storeConfig = useStoreConfigStore()
const router = useRouter()

// ── Form state — declared first so watches with immediate:true can reference it ──
const savedCountryIso = localStorage.getItem('cellier_cart_country')
const savedCountryName = savedCountryIso
  ? formatCountryName(
      countriesStore.countries.find(c => c.iso_code_2.toUpperCase() === savedCountryIso)?.name ?? ''
    ) || 'Netherlands'
  : 'Netherlands'

const form = ref<CheckoutForm>({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  houseNumber: '',
  city: '',
  postcode: '',
  state: '',
  country: savedCountryName,
  notes: '',
})

const billingSameAsShipping = ref(true)
const billingForm = ref<BillingAddress>({
  address: '', houseNumber: '', city: '', postcode: '', state: '', country: 'Netherlands',
})

onMounted(async () => {
  // Gate: if guest checkout is disabled and no session, require login first
  if (storeConfig.checkout?.guestCheckout === false && !customerAuth.isLoggedIn && !auth.isAuthenticated) {
    router.replace({ path: '/login', query: { returnTo: '/checkout' } })
    return
  }

  countriesStore.fetch()
})

// Prefill contact fields from sign-in when still empty
watch(
  () => ({
    firstName: auth.user?.firstName ?? customerAuth.customer?.first_name ?? '',
    lastName:  auth.user?.lastName  ?? customerAuth.customer?.last_name  ?? '',
    email:     auth.user?.email     ?? customerAuth.customer?.email      ?? '',
  }),
  ({ firstName, lastName, email }) => {
    if (firstName && !form.value.firstName) form.value.firstName = firstName
    if (lastName  && !form.value.lastName)  form.value.lastName  = lastName
    if (email     && !form.value.email)     form.value.email     = email
  },
  { immediate: true },
)

// Show/hide contact fields for logged-in customers (pre-filled — hidden by default)
const showContactFields = ref(false)

// Saved addresses from OTP profile
const savedAddresses = computed(() => customerAuth.customer?.shipping_addresses ?? [])
const savedAddressIndex = ref<number | null>(null)

watch(savedAddresses, (addresses) => {
  if (addresses.length && savedAddressIndex.value === null) {
    savedAddressIndex.value = 0
    applyAddress(addresses[0])
  }
}, { immediate: true })

function applyAddress(addr: typeof savedAddresses.value[0]) {
  if (addr.street)        form.value.address     = addr.street
  if (addr.house_number)  form.value.houseNumber = addr.house_number
  if (addr.city)          form.value.city        = addr.city
  form.value.postcode     = addr.zipcode ?? ''
  if (addr.country?.name) form.value.country     = formatCountryName(addr.country.name)
}

// Phone pre-fill from saved profile
watch(() => customerAuth.customer?.phones, (phones) => {
  if (phones?.length && !form.value.phone) {
    const p = phones[0]
    form.value.phone = `+${p.country.call_prefix}${p.number}`
  }
}, { immediate: true })

const filteredCountries = computed(() => {
  const allowed = storeConfig.supportedCountries
  if (!allowed.length) return countriesStore.countries
  return countriesStore.countries.filter(c => allowed.includes(c.iso_code_2.toUpperCase()))
})

const selectedCountry = computed(() =>
  countriesStore.countries.find(c => formatCountryName(c.name) === form.value.country) ?? null
)

// Whether to show postcode field (default true until country loads)
const showPostcode = computed(() =>
  selectedCountry.value === null || selectedCountry.value.has_zipcode !== false
)

// Whether to show state/province field
const showState = computed(() => selectedCountry.value?.has_state === true)

// Whether postcode should appear before city based on address_format
const zipcodeBeforeCity = computed(() => {
  const fmt = selectedCountry.value?.address_format ?? ''
  const ziPos = fmt.indexOf('{zipcode}')
  const cityPos = fmt.indexOf('{city}')
  return ziPos !== -1 && cityPos !== -1 && ziPos < cityPos
})

// Whether house number appears before street in address_format
const houseNumberFirst = computed(() => {
  const fmt = selectedCountry.value?.address_format ?? ''
  const hnPos = fmt.indexOf('{house_number}')
  const stPos = fmt.indexOf('{street}')
  return hnPos !== -1 && stPos !== -1 && hnPos < stPos
})

// Either OAuth session or OTP customer token counts as "signed in"
const isSignedIn = computed(() => auth.isAuthenticated || customerAuth.isLoggedIn)
const displayName = computed(() =>
  auth.isAuthenticated
    ? `${auth.user?.firstName} ${auth.user?.lastName}`
    : customerAuth.customer
      ? `${customerAuth.customer.first_name} ${customerAuth.customer.last_name}`
      : ''
)
const displayEmail = computed(() =>
  auth.isAuthenticated ? auth.user?.email : customerAuth.customer?.email ?? ''
)
const displayInitials = computed(() => {
  const name = displayName.value
  return name.split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2)
})

const submitting = ref(false)
const error = ref<string | null>(null)

// Checkout-check modal state
const checkoutIssues   = ref<ConciarCheckoutIssue[]>([])
const showIssuesModal  = ref(false)
const priceWarnings    = ref<ConciarPriceWarning[]>([])
const showWarningModal = ref(false)
const couponNotices    = ref<ConciarCouponWarning[]>([])  // coupons auto-removed at checkout-check

// Full selected payment method object
const selectedPaymentMethodObj = computed(() =>
  paymentMethods.value.find(m => m.id === selectedPaymentMethod.value) ?? null
)

const commitmentItems = computed(() =>
  cart.items
    .filter(i => i.type === 'subscription')
    .map(i => ({ item: i, product: i.product as SubscriptionBox }))
    .filter(({ product }) => product.minimumCommitmentCycles)
)


const paymentMethods = ref<ConciarCartPaymentMethod[]>([])
const paymentMethodsLoading = ref(false)
const selectedPaymentMethod = ref<number | null>(null)

const shippingMethods = ref<ConciarCartShippingMethod[]>([])
const shippingMethodsLoading = ref(false)
const selectedShippingMethod = ref<ConciarCartShippingMethod | null>(null)

// PostNL pickup-point / delivery-timeframe pickers (carrier-aware)
const {
  locations: pickupLocations,
  locationsLoading: pickupLoading,
  selectedLocationCode,
  deliveryOptions,
  deliveryLoading,
  selectedTimeframe,
  fetchLocations,
  fetchDeliveryOptions,
  reset: resetPickers,
} = useShippingPickers()

// A pickup method needs a chosen location before the order can be placed
const pickupComplete = computed(() =>
  selectedShippingMethod.value?.delivery_type !== 'pickup' || !!selectedLocationCode.value,
)
const selectedPickupLocation = computed(() =>
  selectedShippingMethod.value?.delivery_type === 'pickup'
    ? pickupLocations.value.find(l => l.code === selectedLocationCode.value) ?? null
    : null,
)

function formatDistance(metres: number) {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`
}
function formatLocationAddress(loc: ConciarPickupLocation) {
  const a = loc.address
  return `${a.Street} ${a.HouseNr}, ${a.Zipcode} ${a.City}`
}
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
function todaysHours(loc: ConciarPickupLocation) {
  const today = WEEKDAYS[new Date().getDay()]
  return loc.opening_hours?.[today]?.join(', ') ?? null
}

const {
  code: couponCode,
  loading: couponLoading,
  error: couponError,
  stackable: couponsStackable,
  apply: applyCoupon,
  remove: removeCoupon,
} = useCoupon(t('checkout.summary.couponError'))

const requirePhone    = computed(() => storeConfig.checkout?.requirePhone === true)
const requireShipping = computed(() => storeConfig.checkout?.requireShipping !== false)
const guestAllowed    = computed(() => storeConfig.checkout?.guestCheckout !== false)

const isFormReady = computed(() =>
  (!guestAllowed.value ? isSignedIn.value : true) &&
  !!form.value.firstName &&
  !!form.value.lastName &&
  !!form.value.email &&
  !!form.value.address &&
  !!form.value.houseNumber &&
  !!form.value.city &&
  (!showPostcode.value || !!form.value.postcode) &&
  (!requirePhone.value || !!form.value.phone) &&
  (!requireShipping.value || !!selectedShippingMethod.value) &&
  pickupComplete.value &&
  !!selectedPaymentMethod.value &&
  cart.items.length > 0
)

const shipping = computed(() => {
  if (!selectedShippingMethod.value) return 0
  if (selectedShippingMethod.value.is_free) return 0
  return selectedShippingMethod.value.rate?.amount ?? 0
})
const total = computed(() => Math.max(0, cart.subtotal - cart.discountAmount + shipping.value))

const selectedBillingCountry = computed(() =>
  countriesStore.countries.find(c => formatCountryName(c.name) === billingForm.value.country) ?? null
)
const showBillingPostcode = computed(() =>
  selectedBillingCountry.value === null || selectedBillingCountry.value.has_zipcode !== false
)
const showBillingState = computed(() => selectedBillingCountry.value?.has_state === true)
const billingHouseNumberFirst = computed(() => {
  const fmt = selectedBillingCountry.value?.address_format ?? ''
  return fmt.indexOf('{house_number}') !== -1 && fmt.indexOf('{house_number}') < fmt.indexOf('{street}')
})

// Address is complete when all required fields are filled
const isAddressComplete = computed(() =>
  !!form.value.firstName &&
  !!form.value.lastName &&
  !!form.value.email &&
  !!form.value.address &&
  !!form.value.houseNumber &&
  !!form.value.city &&
  (!showPostcode.value || !!form.value.postcode) &&
  (!requirePhone.value || !!form.value.phone)
)

// Minimum fields needed for an accurate shipping methods query
const isShippingAddressReady = computed(() =>
  !!selectedCountry.value &&
  !!form.value.city &&
  (!showPostcode.value || !!form.value.postcode)
)

let shippingAbortController: AbortController | null = null

onUnmounted(() => shippingAbortController?.abort())

async function fetchShippingMethods(preferMethodId?: number) {
  const countryIso = selectedCountry.value?.iso_code_2?.toUpperCase()
  if (!countryIso) return
  const token = cart.cartToken
  if (!token) return

  // Cancel any in-flight request before starting a new one
  shippingAbortController?.abort()
  const controller = new AbortController()
  shippingAbortController = controller

  shippingMethodsLoading.value = true
  selectedShippingMethod.value = null
  shippingMethods.value = []
  try {
    const methods = await conciarApi.cart.shippingMethods(token, {
      country_code: countryIso,
      postal_code: form.value.postcode || undefined,
      city: form.value.city || undefined,
    }, controller.signal)
    shippingMethods.value = methods
    if (methods.length) {
      const preferred = preferMethodId ? methods.find(m => m.id === preferMethodId) : null
      selectedShippingMethod.value = preferred ?? methods[0]
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return // previous request cancelled — ignore
  } finally {
    // Only clear loading state if this request was not aborted
    if (!controller.signal.aborted) shippingMethodsLoading.value = false
  }
}

// Initial fetch: fires once all three shipping address fields (country + city + postcode)
// are ready AND the cart token is available.
// - Logged-in users: saved address pre-fills these; fires on navigation or after countries load on refresh.
// - Guests: fires when they finish entering their city/postcode.
let stopOnce: ReturnType<typeof watch>
stopOnce = watch(
  () => !!(isShippingAddressReady.value && cart.cartToken),
  (ready) => { if (ready) { fetchShippingMethods(); stopOnce?.() } },
  { immediate: true },
)

// Re-fetch on country change (select — no debounce needed)
watch(() => form.value.country, () => { if (form.value.city) fetchShippingMethods() })

// Re-fetch on city change (debounced — user is typing)
let cityTimer: ReturnType<typeof setTimeout>
watch(() => form.value.city, () => {
  clearTimeout(cityTimer)
  cityTimer = setTimeout(() => fetchShippingMethods(), 600)
})

// Re-fetch on postcode change (debounced — user is typing)
let postcodeTimer: ReturnType<typeof setTimeout>
watch(() => form.value.postcode, () => {
  clearTimeout(postcodeTimer)
  postcodeTimer = setTimeout(() => fetchShippingMethods(), 600)
})

// Re-fetch payment methods every time the shipping method changes
watch(selectedShippingMethod, async (method) => {
  paymentMethods.value = []
  selectedPaymentMethod.value = null
  if (!method) return

  const countryId = selectedCountry.value?.id
  const token = cart.cartToken
  if (!countryId || !token) return

  paymentMethodsLoading.value = true
  try {
    const methods = await conciarApi.cart.paymentMethods(token, {
      shipping_method_id: method.id,
      country_id: countryId,
    })
    paymentMethods.value = methods
    // Pre-select first; if a previous selection is still valid keep it
    const prev = selectedPaymentMethod.value
    if (prev && methods.find(m => m.id === prev)) return
    if (methods.length) selectedPaymentMethod.value = methods[0].id
  } finally {
    paymentMethodsLoading.value = false
  }
})

// Carrier-aware pickers: when the selected method changes, show/fetch the
// matching picker — pickup points for "pickup", delivery timeframes for "home".
watch(selectedShippingMethod, (method) => {
  resetPickers()
  if (!method) return
  const countryIso = selectedCountry.value?.iso_code_2?.toUpperCase()
  if (method.delivery_type === 'pickup') {
    fetchLocations(countryIso, form.value.postcode || undefined)
  } else if (method.delivery_type === 'home' && form.value.houseNumber) {
    fetchDeliveryOptions(countryIso, form.value.postcode || undefined, form.value.houseNumber || undefined)
  }
})

// House number isn't part of the shipping-methods query, so refetch home
// timeframes on its own (debounced) when a home method is selected.
let houseNumberTimer: ReturnType<typeof setTimeout>
watch(() => form.value.houseNumber, () => {
  if (selectedShippingMethod.value?.delivery_type !== 'home') return
  clearTimeout(houseNumberTimer)
  houseNumberTimer = setTimeout(() => {
    const countryIso = selectedCountry.value?.iso_code_2?.toUpperCase()
    fetchDeliveryOptions(countryIso, form.value.postcode || undefined, form.value.houseNumber || undefined)
  }, 600)
})

function handleError(e: unknown) {
  const err = e as { status?: number; body?: { message?: string; errors?: Record<string, unknown> } }
  const status  = err?.status
  const message = err?.body?.message?.toLowerCase() ?? ''

  if (status === 404) {
    error.value = 'Your cart has expired. Please start a new order.'
    cart.clearToken()
    cart.clear()
  } else if (status === 422) {
    if (message.includes('no items') || err?.body?.errors?.items) {
      router.push('/cart')
    } else if (message.includes('out of stock') || message.includes('stock')) {
      error.value = 'One or more items are out of stock. Please update your cart.'
    } else if (message.includes('shipping')) {
      error.value = 'The selected shipping method is no longer available.'
      selectedShippingMethod.value = null
      fetchShippingMethods()
    } else if (message.includes('payment')) {
      error.value = 'The selected payment method is no longer available.'
      selectedPaymentMethod.value = null
    } else if (message.includes('coupon') || message.includes('voucher') || message.includes('discount')) {
      error.value = 'Your discount code is no longer valid and has been removed.'
      cart.applyCoupons([])
    } else {
      error.value = 'Please check your details and try again.'
    }
  } else {
    // Show the API's own message when available — helpful for diagnosing 500s
    const apiMessage = err?.body?.message
    error.value = apiMessage
      ? `${t('checkout.error')} (${apiMessage})`
      : t('checkout.error')
    console.error('[checkout] unexpected error', { status, body: err?.body })
  }
}

// Parse "+31612345678" → { number: "612345678", country_id: 146 }
function parsePhoneForOrder(phoneStr: string) {
  if (!phoneStr) return undefined
  const country = countriesStore.countries.find(c => phoneStr.startsWith(`+${c.call_prefix}`))
  if (!country) return undefined
  return { number: phoneStr.slice(`+${country.call_prefix}`.length), country_id: country.id }
}

async function placeOrder() {
  const result = await conciarApi.orders.create({
    cartToken: cart.cartToken!,
    accessToken: customerAuth.accessToken ?? undefined,
    shippingMethodId: selectedShippingMethod.value!.id,
    paymentMethodKey: selectedPaymentMethodObj.value!.key,
    paymentServiceProviderKey: selectedPaymentMethodObj.value!.payment_service_provider_key!,
    returnUrl: `${window.location.origin}/payments/${selectedPaymentMethodObj.value!.payment_service_provider_key}/return`,
    // Logged-in: omit customer entirely — server identifies via Bearer token.
    // Guest: customer.email is required; name and phone are optional.
    customer: customerAuth.isLoggedIn ? undefined : {
      email:      form.value.email     || undefined,
      first_name: form.value.firstName || undefined,
      last_name:  form.value.lastName  || undefined,
      phone:      parsePhoneForOrder(form.value.phone),
    },
    customerNotes: form.value.notes || undefined,
    // Pickup methods carry the chosen drop-off point; home delivery omits it.
    pickupLocationCode: selectedShippingMethod.value?.delivery_type === 'pickup'
      ? (selectedLocationCode.value ?? undefined)
      : undefined,
    shippingAddress: {
      street: form.value.address || undefined,
      house_number: form.value.houseNumber || undefined,
      city: form.value.city,
      zipcode: form.value.postcode || undefined,
      state: form.value.state || undefined,
      country_id: selectedCountry.value!.id,
    },
    billingAddress: billingSameAsShipping.value ? undefined : {
      street: billingForm.value.address || undefined,
      house_number: billingForm.value.houseNumber || undefined,
      city: billingForm.value.city,
      zipcode: billingForm.value.postcode || undefined,
      state: billingForm.value.state || undefined,
      country_id: selectedBillingCountry.value?.id ?? selectedCountry.value!.id,
    },
  })

  // Cart is now permanently converted — clear it immediately
  cart.clearToken()
  cart.clear()

  if (result.payment_url) {
    if (result.transaction_key) {
      sessionStorage.setItem('pending_transaction_key', result.transaction_key)
    }
    window.location.href = result.payment_url
  } else {
    router.push({
      name: 'order-confirmation',
      params: { reference: result.order.reference },
      // order is read back from history.state on the confirmation page; the
      // router's HistoryStateValue type doesn't model arbitrary objects.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state: { order: result.order as any },
    })
  }
}

async function submit() {
  if (!cart.items.length || !selectedShippingMethod.value || !selectedPaymentMethod.value) return
  submitting.value = true
  error.value = null
  couponNotices.value = []
  try {
    // Step 1: checkout-check — validates availability + prices + coupons
    const check = await conciarApi.cart.checkoutCheck(cart.cartToken!)

    if (!check.can_proceed) {
      // Blocking issues (out of stock / unavailable) — must go fix cart first
      checkoutIssues.value = check.issues
      showIssuesModal.value = true
      return
    }

    // Coupons that went invalid in the cart (non-blocking): drop them now so the
    // order doesn't hard-fail with a 422, refresh totals, and tell the shopper.
    if (check.coupon_warnings?.length) {
      const flagged = new Set(check.coupon_warnings.map(w => w.code.toUpperCase()))
      const remaining = cart.appliedCoupons
        .map(c => c.code)
        .filter(code => !flagged.has(code.toUpperCase()))
      await cart.applyCoupons(remaining)   // re-sync without the flagged codes; refreshes totals
      couponNotices.value = check.coupon_warnings
      // Stop here so the shopper sees the removal + updated total, then re-submits.
      return
    }

    if (check.has_changes && check.warnings.length) {
      // Non-blocking price changes — customer must confirm before ordering
      priceWarnings.value = check.warnings
      showWarningModal.value = true
      return
    }

    // Step 2: all clear — create order
    await placeOrder()
  } catch (e) {
    handleError(e)
  } finally {
    submitting.value = false
  }
}

async function onWarningConfirmed() {
  showWarningModal.value = false
  submitting.value = true
  error.value = null
  try {
    await placeOrder()
  } catch (e) {
    handleError(e)
  } finally {
    submitting.value = false
  }
}

async function handleRemoveIssue(issue: ConciarCheckoutIssue) {
  const item = cart.items.find(i => i.product.name === issue.name)
  if (item) cart.remove(item.id, item.type)

  if (!cart.items.length) {
    router.push('/cart')
    return
  }

  checkoutIssues.value = checkoutIssues.value.filter(i => i.sku !== issue.sku)
  if (!checkoutIssues.value.length) showIssuesModal.value = false

  const previousShippingId = selectedShippingMethod.value?.id
  selectedPaymentMethod.value = null
  await fetchShippingMethods(previousShippingId)
}
</script>

<template>
  <div class="bg-cream min-h-screen">

    <!-- Minimal header -->
    <header class="bg-white border-b border-black/8">
      <div class="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <RouterLink to="/" class="font-display text-lg font-semibold tracking-tight">Cellier</RouterLink>
        <h1 class="font-mono text-base font-semibold text-charcoal">{{ t('checkout.title') }}</h1>
        <RouterLink to="/cart" class="text-sm font-mono text-gray-500 hover:text-black transition-colors flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
            <path fill-rule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H3.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L3.56 7.25h9.69A.75.75 0 0 1 14 8Z" clip-rule="evenodd" />
          </svg>
          {{ t('checkout.backToCart') }}
        </RouterLink>
      </div>
    </header>

    <div class="max-w-5xl mx-auto px-6 py-10 pb-28 lg:pb-10">

      <div class="grid lg:grid-cols-[1fr_360px] gap-10 items-start">

        <!-- Left: Form -->
        <!-- Skeleton while countries load -->
        <div v-if="!countriesStore.loaded" class="flex flex-col gap-6">
          <div class="bg-white rounded-2xl border border-black/8 p-6 animate-pulse">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-gray-100" />
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-gray-100 rounded w-32" />
                <div class="h-3 bg-gray-100 rounded w-48" />
              </div>
            </div>
          </div>
          <div class="bg-white rounded-2xl border border-black/8 p-6 animate-pulse space-y-4">
            <div class="h-4 bg-gray-100 rounded w-24" />
            <div class="h-10 bg-gray-100 rounded-xl" />
            <div class="h-10 bg-gray-100 rounded-xl" />
            <div class="grid grid-cols-2 gap-3">
              <div class="h-10 bg-gray-100 rounded-xl" />
              <div class="h-10 bg-gray-100 rounded-xl" />
            </div>
            <div class="h-10 bg-gray-100 rounded-xl" />
          </div>
        </div>

        <form v-else @submit.prevent="submit" class="flex flex-col gap-6">

          <!-- Account -->
          <div v-if="isSignedIn" class="bg-white rounded-2xl border border-black/8 px-6 py-4 flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold font-mono shrink-0">
              {{ displayInitials }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">{{ displayName }}</p>
              <p class="text-xs text-gray-400 truncate">{{ displayEmail }}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-green-500 shrink-0">
              <path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" />
            </svg>
          </div>
          <div v-else class="bg-white rounded-2xl border border-black/8 p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-7 h-7 rounded-full bg-charcoal text-white flex items-center justify-center text-xs font-mono font-semibold shrink-0">1</div>
              <h2 class="font-mono font-semibold">{{ t('checkout.signIn') }}</h2>
              <span class="font-mono text-xs text-gray-400 ml-auto">{{ t('checkout.optionalLabel') }}</span>
            </div>
            <OtpLoginForm />
          </div>

          <!-- Shipping address -->
          <div class="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <div class="px-6 pt-6 pb-5 flex items-center gap-3 border-b border-black/6">
              <div class="w-7 h-7 rounded-full bg-charcoal text-white flex items-center justify-center text-xs font-mono font-semibold shrink-0">
                {{ isSignedIn ? '1' : '2' }}
              </div>
              <h2 class="font-mono font-semibold">{{ t('checkout.shipping.title') }}</h2>
            </div>
            <div class="p-6">

            <!-- Saved address selector (shown when logged-in customer has addresses) -->
            <div v-if="savedAddresses.length" class="mb-6">
              <p class="font-mono text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{{ t('checkout.savedAddresses') }}</p>
              <div class="flex flex-col gap-2">
                <button
                  v-for="(addr, i) in savedAddresses"
                  :key="addr.id"
                  type="button"
                  @click="savedAddressIndex = i; applyAddress(addr); fetchShippingMethods()"
                  :class="[
                    'flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-colors',
                    savedAddressIndex === i ? 'border-charcoal bg-cream' : 'border-black/10 hover:border-black/25',
                  ]"
                >
                  <div :class="['w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center', savedAddressIndex === i ? 'border-charcoal' : 'border-black/20']">
                    <div v-if="savedAddressIndex === i" class="w-2 h-2 rounded-full bg-charcoal" />
                  </div>
                  <div class="text-sm">
                    <p class="font-medium">{{ addr.street }} {{ addr.house_number }}</p>
                    <p class="text-gray-500 font-mono text-xs">{{ addr.zipcode }} {{ addr.city }} · {{ addr.country?.iso2 }}</p>
                  </div>
                </button>
                <button
                  type="button"
                  @click="savedAddressIndex = null; form.address = ''; form.houseNumber = ''; form.city = ''; form.postcode = ''"
                  :class="[
                    'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors text-sm text-gray-500',
                    savedAddressIndex === null ? 'border-charcoal bg-cream text-charcoal' : 'border-black/10 hover:border-black/25',
                  ]"
                >
                  <div :class="['w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center', savedAddressIndex === null ? 'border-charcoal' : 'border-black/20']">
                    <div v-if="savedAddressIndex === null" class="w-2 h-2 rounded-full bg-charcoal" />
                  </div>
                  {{ t('checkout.enterNewAddress') }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Country (first — drives address layout below) -->
              <div class="col-span-2">
                <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                  {{ t('checkout.shipping.country') }}
                </label>
                <select
                  v-model="form.country"
                  :disabled="countriesStore.loading"
                  class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white disabled:opacity-60"
                >
                  <option v-if="countriesStore.loading" value="" disabled>{{ t('checkout.loading') }}</option>
                  <option
                    v-for="country in filteredCountries"
                    :key="country.id"
                    :value="formatCountryName(country.name)"
                  >{{ formatCountryName(country.name) }}</option>
                </select>
              </div>

              <!-- Contact info — collapsed summary for logged-in, full fields for guests -->
              <div class="col-span-2">
                <template v-if="isSignedIn && !showContactFields">
                  <!-- Read-only summary -->
                  <div class="flex items-center justify-between bg-cream rounded-xl px-4 py-3 border border-black/8">
                    <div class="text-sm">
                      <p class="font-medium">{{ form.firstName }} {{ form.lastName }}</p>
                      <p class="text-gray-500 font-mono text-xs mt-0.5">{{ form.email }}
                        <template v-if="form.phone"> · {{ form.phone }}</template>
                      </p>
                    </div>
                    <button
                      type="button"
                      @click="showContactFields = true"
                      class="font-mono text-xs text-gray-400 hover:text-charcoal transition-colors shrink-0 ml-4"
                    >
                      {{ t('checkout.contact.edit') }}
                    </button>
                  </div>
                </template>

                <template v-else>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                        {{ t('checkout.shipping.firstName') }}
                      </label>
                      <input v-model="form.firstName" required type="text"
                        class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white" />
                    </div>
                    <div>
                      <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                        {{ t('checkout.shipping.lastName') }}
                      </label>
                      <input v-model="form.lastName" required type="text"
                        class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white" />
                    </div>
                    <div class="col-span-2">
                      <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                        {{ t('checkout.shipping.email') }}
                      </label>
                      <input v-model="form.email" required type="email"
                        class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white" />
                    </div>
                    <div class="col-span-2">
                      <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                        {{ t('checkout.shipping.phone') }}<span v-if="requirePhone" class="text-primary ml-0.5">*</span>
                      </label>
                      <PhoneInput v-model="form.phone" :country-id="selectedCountry?.id" />
                    </div>
                    <div v-if="isSignedIn" class="col-span-2 flex justify-end">
                      <button type="button" @click="showContactFields = false"
                        class="font-mono text-xs text-gray-400 hover:text-charcoal transition-colors">
                        {{ t('checkout.contact.collapse') }}
                      </button>
                    </div>
                  </div>
                </template>
              </div>

              <!-- City + Postcode — order driven by address_format -->
              <div :class="[!showPostcode ? 'col-span-2' : '', zipcodeBeforeCity && showPostcode ? 'order-2' : '']">
                <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                  {{ t('checkout.shipping.city') }}
                </label>
                <input
                  v-model="form.city" required type="text"
                  class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white"
                />
              </div>
              <div v-if="showPostcode" :class="zipcodeBeforeCity ? 'order-1' : ''">
                <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                  {{ t('checkout.shipping.postcode') }}
                </label>
                <input
                  v-model="form.postcode" :required="showPostcode" type="text"
                  :pattern="selectedCountry?.zipcode_format ?? undefined"
                  :title="selectedCountry?.zipcode_format ? t('checkout.shipping.postcode') : undefined"
                  class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white"
                />
              </div>

              <!-- Street + House number (order driven by address_format) -->
              <div class="col-span-2 flex gap-3">
                <div :class="houseNumberFirst ? 'order-2 flex-1' : 'flex-1'">
                  <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                    {{ t('checkout.shipping.address') }}
                  </label>
                  <input
                    v-model="form.address" required type="text"
                    class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white"
                  />
                </div>
                <div :class="houseNumberFirst ? 'order-1 w-24' : 'w-24'">
                  <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                    {{ t('checkout.shipping.houseNumber') }}
                  </label>
                  <input
                    v-model="form.houseNumber" required type="text"
                    class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white"
                  />
                </div>
              </div>

              <!-- State / Province (only for countries with has_state) -->
              <div v-if="showState" class="col-span-2">
                <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                  {{ t('checkout.shipping.state') }}
                </label>
                <input
                  v-model="form.state" type="text"
                  class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white"
                />
              </div>
            </div>
          </div>
          </div>

          <!-- Billing address -->
          <div class="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <div class="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-black/6">
              <div class="w-7 h-7 rounded-full bg-charcoal text-white flex items-center justify-center text-xs font-mono font-semibold shrink-0">
                {{ isSignedIn ? '2' : '3' }}
              </div>
              <h2 class="font-mono font-semibold">{{ t('checkout.billing.title') }}</h2>
              <!-- Same-as-shipping toggle -->
              <button
                type="button"
                @click="billingSameAsShipping = !billingSameAsShipping"
                :class="[
                  'ml-auto flex items-center gap-2 font-mono text-xs px-3 py-1.5 rounded-full border transition-colors',
                  billingSameAsShipping
                    ? 'bg-charcoal text-white border-charcoal'
                    : 'bg-white text-gray-500 border-black/15 hover:border-black/40',
                ]"
              >
                <svg v-if="billingSameAsShipping" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" class="w-3 h-3">
                  <path fill-rule="evenodd" d="M10.22 2.97a.75.75 0 0 1 0 1.06l-5.5 5.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 0 1 1.06-1.06L4.25 7.94l4.97-4.97a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd"/>
                </svg>
                {{ t('checkout.billing.sameAsShipping') }}
              </button>
            </div>

            <div v-if="billingSameAsShipping" class="px-6 py-4">
              <p class="font-mono text-sm text-gray-400">{{ t('checkout.billing.usingShipping') }}</p>
            </div>

            <Transition name="reveal">
            <div v-if="!billingSameAsShipping" class="p-6 grid grid-cols-2 gap-4">

              <!-- Country -->
              <div class="col-span-2">
                <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                  {{ t('checkout.shipping.country') }}
                </label>
                <select
                  v-model="billingForm.country"
                  :disabled="countriesStore.loading"
                  class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white disabled:opacity-60"
                >
                  <option v-for="country in filteredCountries" :key="country.id" :value="formatCountryName(country.name)">
                    {{ formatCountryName(country.name) }}
                  </option>
                </select>
              </div>

              <!-- City + Postcode -->
              <div :class="[!showBillingPostcode ? 'col-span-2' : '']">
                <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                  {{ t('checkout.shipping.city') }}
                </label>
                <input v-model="billingForm.city" required type="text"
                  class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white" />
              </div>
              <div v-if="showBillingPostcode">
                <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                  {{ t('checkout.shipping.postcode') }}
                </label>
                <input v-model="billingForm.postcode" :required="showBillingPostcode" type="text"
                  :pattern="selectedBillingCountry?.zipcode_format ?? undefined"
                  class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white" />
              </div>

              <!-- Street + House number -->
              <div class="col-span-2 flex gap-3">
                <div :class="billingHouseNumberFirst ? 'order-2 flex-1' : 'flex-1'">
                  <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                    {{ t('checkout.shipping.address') }}
                  </label>
                  <input v-model="billingForm.address" required type="text"
                    class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white" />
                </div>
                <div :class="billingHouseNumberFirst ? 'order-1 w-24' : 'w-24'">
                  <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                    {{ t('checkout.shipping.houseNumber') }}
                  </label>
                  <input v-model="billingForm.houseNumber" required type="text"
                    class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white" />
                </div>
              </div>

              <!-- State -->
              <div v-if="showBillingState" class="col-span-2">
                <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                  {{ t('checkout.shipping.state') }}
                </label>
                <input v-model="billingForm.state" type="text"
                  class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white" />
              </div>

            </div>
            </Transition>
          </div>

          <!-- Shipping method -->
          <Transition name="reveal">
          <div v-if="requireShipping && selectedCountry" class="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <div class="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-black/6">
              <div class="w-7 h-7 rounded-full bg-charcoal text-white flex items-center justify-center text-xs font-mono font-semibold shrink-0">
                {{ isSignedIn ? '3' : '4' }}
              </div>
              <h2 class="font-mono font-semibold">{{ t('checkout.shipping.methodTitle') }}</h2>
            </div>
            <div class="p-6">

            <!-- Loading -->
            <div v-if="shippingMethodsLoading" class="flex flex-col gap-3">
              <div v-for="i in 2" :key="i" class="h-14 bg-gray-100 rounded-xl animate-pulse" />
            </div>

            <!-- Methods -->
            <div v-else-if="shippingMethods.length" class="flex flex-col gap-2.5">
              <label
                v-for="method in shippingMethods"
                :key="method.id"
                :class="[
                  'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  selectedShippingMethod?.id === method.id
                    ? 'border-charcoal bg-cream'
                    : 'border-black/10 hover:border-black/30',
                ]"
              >
                <input
                  type="radio"
                  :value="method.id"
                  :checked="selectedShippingMethod?.id === method.id"
                  @change="selectedShippingMethod = method"
                  class="sr-only"
                />
                <div :class="[
                  'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                  selectedShippingMethod?.id === method.id ? 'border-charcoal' : 'border-black/30',
                ]">
                  <div v-if="selectedShippingMethod?.id === method.id" class="w-2 h-2 rounded-full bg-charcoal" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium">{{ method.resolved_info.name }}</p>
                  <p v-if="method.resolved_info.description" class="text-xs text-gray-400 mt-0.5">
                    {{ method.resolved_info.description }}
                  </p>
                </div>
                <span :class="['text-sm font-mono font-semibold shrink-0', method.is_free ? 'text-green-600' : '']">
                  {{ method.is_free ? t('checkout.shipping.methodFree') : method.rate?.display_price }}
                </span>
              </label>
            </div>

            <!-- No methods for this address -->
            <p v-else class="text-sm font-mono text-gray-500">{{ t('checkout.pickup.noDelivery') }}</p>

            <!-- Pickup-point picker (PostNL "pickup" methods) -->
            <div v-if="selectedShippingMethod?.delivery_type === 'pickup'" class="mt-5 pt-5 border-t border-black/6">
              <p class="font-mono text-sm font-semibold mb-3">{{ t('checkout.pickup.choosePoint') }}</p>

              <div v-if="pickupLoading" class="flex flex-col gap-2.5">
                <div v-for="i in 3" :key="i" class="h-16 bg-gray-100 rounded-xl animate-pulse" />
              </div>

              <div v-else-if="pickupLocations.length" class="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
                <label
                  v-for="loc in pickupLocations"
                  :key="loc.code"
                  :class="[
                    'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                    selectedLocationCode === loc.code ? 'border-charcoal bg-cream' : 'border-black/10 hover:border-black/30',
                  ]"
                >
                  <input type="radio" :value="loc.code" v-model="selectedLocationCode" class="sr-only" />
                  <div :class="[
                    'w-4 h-4 mt-0.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                    selectedLocationCode === loc.code ? 'border-charcoal' : 'border-black/30',
                  ]">
                    <div v-if="selectedLocationCode === loc.code" class="w-2 h-2 rounded-full bg-charcoal" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline justify-between gap-2">
                      <p class="text-sm font-medium truncate">{{ loc.name }}</p>
                      <span class="font-mono text-xs text-gray-400 shrink-0">{{ formatDistance(loc.distance) }}</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-0.5 truncate">{{ formatLocationAddress(loc) }}</p>
                    <p v-if="todaysHours(loc)" class="font-mono text-xs text-gray-400 mt-0.5">
                      {{ t('checkout.pickup.openToday') }} {{ todaysHours(loc) }}
                    </p>
                  </div>
                </label>
              </div>

              <p v-else class="text-sm font-mono text-gray-500">{{ t('checkout.pickup.noPoints') }}</p>
            </div>

            <!-- Delivery-timeframe picker (PostNL "home" methods — display only) -->
            <div
              v-else-if="selectedShippingMethod?.delivery_type === 'home' && (deliveryLoading || deliveryOptions.length)"
              class="mt-5 pt-5 border-t border-black/6"
            >
              <p class="font-mono text-sm font-semibold mb-3">{{ t('checkout.pickup.chooseTimeframe') }} <span class="text-gray-400 font-normal">{{ t('checkout.pickup.optional') }}</span></p>

              <div v-if="deliveryLoading" class="flex flex-col gap-2.5">
                <div v-for="i in 2" :key="i" class="h-10 bg-gray-100 rounded-xl animate-pulse" />
              </div>

              <div v-else class="flex flex-col gap-3">
                <div v-for="day in deliveryOptions" :key="day.date">
                  <p class="font-mono text-xs text-gray-400 mb-1.5">{{ day.date }}</p>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-for="(tf, i) in day.timeframes"
                      :key="`${day.date}-${i}`"
                      type="button"
                      @click="selectedTimeframe = { date: day.date, ...tf }"
                      :class="[
                        'font-mono text-xs px-3 py-1.5 rounded-lg border transition-colors',
                        selectedTimeframe?.date === day.date && selectedTimeframe?.from === tf.from
                          ? 'border-charcoal bg-cream text-charcoal'
                          : 'border-black/10 text-gray-500 hover:border-black/30',
                      ]"
                    >
                      {{ tf.from.slice(0, 5) }}–{{ tf.to.slice(0, 5) }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
          </Transition>

          <!-- Payment -->
          <Transition name="reveal">
          <div v-if="selectedShippingMethod" class="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <div class="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-black/6">
              <div class="w-7 h-7 rounded-full bg-charcoal text-white flex items-center justify-center text-xs font-mono font-semibold shrink-0">
                {{ isSignedIn ? '4' : '5' }}
              </div>
              <h2 class="font-mono font-semibold">{{ t('checkout.payment.title') }}</h2>
            </div>
            <div class="p-6">

            <!-- Loading -->
            <div v-if="paymentMethodsLoading" class="flex flex-col gap-3">
              <div v-for="i in 3" :key="i" class="h-14 bg-gray-100 rounded-xl animate-pulse" />
            </div>

            <!-- Methods -->
            <div v-else-if="paymentMethods.length" class="flex flex-col gap-2.5">
              <label
                v-for="method in paymentMethods"
                :key="method.id"
                :class="[
                  'flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                  selectedPaymentMethod === method.id
                    ? 'border-charcoal bg-cream'
                    : 'border-black/10 hover:border-black/30',
                ]"
              >
                <input
                  type="radio"
                  :value="method.id"
                  v-model="selectedPaymentMethod"
                  class="sr-only"
                />
                <!-- Radio indicator -->
                <div :class="[
                  'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                  selectedPaymentMethod === method.id ? 'border-charcoal' : 'border-black/30',
                ]">
                  <div v-if="selectedPaymentMethod === method.id" class="w-2 h-2 rounded-full bg-charcoal" />
                </div>
                <!-- Logo -->
                <img
                  v-if="method.logo"
                  :src="method.logo"
                  :alt="method.name"
                  class="h-6 w-auto object-contain shrink-0"
                />
                <span class="text-sm font-medium">{{ method.name }}</span>
              </label>
            </div>

            <!-- No compatible payment methods -->
            <div v-else class="flex items-start gap-3 bg-cream rounded-xl p-4 border border-black/8">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 text-primary shrink-0 mt-0.5">
                <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd" />
              </svg>
              <p class="text-sm text-gray-600 leading-relaxed">{{ t('checkout.noPaymentMethods') }}</p>
            </div>
            </div>
          </div>
          </Transition>

          <!-- Coupon auto-removed notice (from checkout-check) -->
          <div v-if="couponNotices.length" class="text-sm bg-amber-50 rounded-xl px-4 py-3 border border-amber-200 flex flex-col gap-1">
            <p v-for="w in couponNotices" :key="w.code" class="text-amber-800">
              {{ t('checkout.couponRemoved', { code: w.code, reason: w.reason }) }}
            </p>
          </div>

          <!-- Error -->
          <div v-if="error" class="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-200">
            {{ error }}
          </div>

          <!-- Review summary -->
          <Transition name="reveal">
          <div v-if="selectedShippingMethod && selectedPaymentMethod" class="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <div class="px-6 pt-5 pb-4 flex items-center gap-3 border-b border-black/6">
              <div class="w-7 h-7 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                  <path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd"/>
                </svg>
              </div>
              <h2 class="font-mono font-semibold">{{ t('checkout.review.title') }}</h2>
            </div>

            <div class="divide-y divide-black/6">
              <!-- Delivery address -->
              <div class="px-6 py-4">
                <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{{ t('checkout.review.deliveryAddress') }}</p>
                <p class="text-sm font-medium">{{ form.firstName }} {{ form.lastName }}</p>
                <p class="text-sm text-gray-500 mt-0.5">
                  {{ form.address }} {{ form.houseNumber }}<template v-if="form.postcode">, {{ form.postcode }}</template> {{ form.city }}
                </p>
                <p class="text-sm text-gray-400">{{ form.country }}</p>
              </div>

              <!-- Billing address (if different) -->
              <div v-if="!billingSameAsShipping && billingForm.city" class="px-6 py-4">
                <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{{ t('checkout.review.billingAddress') }}</p>
                <p class="text-sm text-gray-500">
                  {{ billingForm.address }} {{ billingForm.houseNumber }}<template v-if="billingForm.postcode">, {{ billingForm.postcode }}</template> {{ billingForm.city }}
                </p>
                <p class="text-sm text-gray-400">{{ billingForm.country }}</p>
              </div>

              <!-- Shipping + payment -->
              <div class="px-6 py-4 flex flex-col gap-3">
                <div class="flex items-center justify-between text-sm">
                  <div>
                    <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{{ t('checkout.review.shipping') }}</p>
                    <p class="font-medium">{{ selectedShippingMethod.resolved_info.name }}</p>
                    <p v-if="selectedShippingMethod.resolved_info.description" class="text-xs text-gray-400">{{ selectedShippingMethod.resolved_info.description }}</p>
                    <p v-if="selectedPickupLocation" class="text-xs text-primary mt-0.5">
                      ↓ {{ selectedPickupLocation.name }} · {{ formatLocationAddress(selectedPickupLocation) }}
                    </p>
                  </div>
                  <span :class="['font-mono font-semibold shrink-0', selectedShippingMethod.is_free ? 'text-green-600' : '']">
                    {{ selectedShippingMethod.is_free ? t('checkout.free') : selectedShippingMethod.rate?.display_price }}
                  </span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <div>
                    <p class="font-mono text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{{ t('checkout.review.payment') }}</p>
                    <p class="font-medium">{{ paymentMethods.find(m => m.id === selectedPaymentMethod)?.name }}</p>
                  </div>
                  <img
                    v-if="paymentMethods.find(m => m.id === selectedPaymentMethod)?.logo"
                    :src="paymentMethods.find(m => m.id === selectedPaymentMethod)!.logo!"
                    class="h-5 w-auto object-contain shrink-0"
                  />
                </div>
              </div>
            </div>
          </div>
          </Transition>

          <!-- Order notes -->
          <div class="bg-white rounded-2xl border border-black/8 p-6">
            <label class="font-mono text-xs font-medium text-gray-500 uppercase tracking-wider block mb-2">
              {{ t('checkout.shipping.notes') }}
            </label>
            <textarea
              v-model="form.notes" rows="3"
              :placeholder="t('checkout.shipping.notesPlaceholder')"
              class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-charcoal transition-colors bg-white resize-none font-mono"
            />
          </div>

          <!-- Terms / Privacy -->
          <p v-if="storeConfig.checkout?.termsUrl || storeConfig.checkout?.privacyUrl" class="text-xs text-gray-400 text-center">
            <template v-if="storeConfig.checkout?.termsUrl">
              <a :href="storeConfig.checkout.termsUrl" target="_blank" class="underline hover:text-charcoal transition-colors">{{ t('checkout.terms') }}</a>
            </template>
            <template v-if="storeConfig.checkout?.termsUrl && storeConfig.checkout?.privacyUrl"> · </template>
            <template v-if="storeConfig.checkout?.privacyUrl">
              <a :href="storeConfig.checkout.privacyUrl" target="_blank" class="underline hover:text-charcoal transition-colors">{{ t('checkout.privacy') }}</a>
            </template>
          </p>

          <!-- Submit -->
          <div class="flex flex-col gap-3">
            <button
              type="submit"
              :disabled="submitting || !isFormReady"
              class="w-full bg-charcoal text-white font-mono font-medium py-4 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              <svg v-if="submitting" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
                <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
              </svg>
              {{ submitting ? t('checkout.submitting') : `${t('checkout.submit')} · ${cart.formatMoney(total)}` }}
            </button>
            <!-- Trust signals -->
            <div class="flex items-center justify-center gap-5 text-xs font-mono text-gray-400">
              <span class="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
                  <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
                </svg>
                {{ t('checkout.securePayment') }}
              </span>
              <span class="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5">
                  <path fill-rule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm11.78-1.22a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L5.97 9.59a.75.75 0 1 1 1.06-1.06l1 1 2.69-2.75a.75.75 0 0 1 1.06 0Z" clip-rule="evenodd" />
                </svg>
                {{ t('checkout.freeReturns') }}
              </span>
            </div>
          </div>

        </form>

        <!-- Right: Order summary -->
        <div class="lg:sticky lg:top-24 font-mono">
          <div class="bg-white rounded-2xl border border-black/8 p-6">
            <h2 class="font-mono font-semibold text-base mb-5">{{ t('checkout.summary.title') }}</h2>

            <!-- Items -->
            <div class="flex flex-col gap-4 mb-5">
              <div v-for="item in cart.items" :key="item.id" class="flex items-center gap-3">
                <div class="w-12 h-14 rounded-lg bg-cream overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    v-if="item.product.image"
                    :src="item.product.image"
                    :alt="item.product.name"
                    class="w-full h-full object-cover"
                  />
                  <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 text-primary/40">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 3h6M9 3v3.5c0 .5-.2 1-.5 1.4L6 11v9a1 1 0 001 1h10a1 1 0 001-1v-9l-2.5-3.1c-.3-.4-.5-.9-.5-1.4V3M9 3h6" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ item.product.name }}</p>
                  <template v-if="item.type === 'subscription'">
                    <p class="font-mono text-xs text-primary mt-0.5">↻ {{ item.interval ?? t('cart.subscriptionBadge') }}</p>
                    <p v-if="(item.product as SubscriptionBox).minimumCommitmentCycles" class="font-mono text-xs text-gray-400 mt-0.5">
                      {{ t('checkout.minCycles', { n: (item.product as SubscriptionBox).minimumCommitmentCycles }) }}
                      <template v-if="(item.product as SubscriptionBox).renewCommitmentOnCycle">
                        {{ t('checkout.minCyclesRenew', { n: (item.product as SubscriptionBox).minimumCommitmentCycles }) }}
                      </template>
                    </p>
                  </template>
                  <p v-else class="text-xs text-gray-400 mt-0.5">× {{ item.quantity }}</p>
                </div>
                <p class="text-sm font-medium shrink-0">{{ cart.formatMoney(item.price * item.quantity) }}</p>
              </div>
            </div>

            <!-- Discount codes -->
            <div class="border-t border-black/8 pt-4">
              <!-- Applied coupons -->
              <div v-if="cart.appliedCoupons.length" class="flex flex-col gap-2 mb-3">
                <div
                  v-for="c in cart.appliedCoupons"
                  :key="c.code"
                  class="flex items-center justify-between text-sm text-green-600 bg-green-50 rounded-xl px-3 py-2.5 border border-green-200"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 shrink-0">
                      <path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" />
                    </svg>
                    <span class="font-medium shrink-0">{{ c.code }}</span>
                    <span v-if="c.default_info?.name" class="text-green-500/90 truncate">{{ c.default_info.name }}</span>
                    <span v-if="c.discount_percentage != null" class="text-green-500 shrink-0">
                      (-{{ c.discount_percentage }}%)
                    </span>
                  </div>
                  <button type="button" @click="removeCoupon(c.code)" class="text-green-400 hover:text-green-600 transition-colors text-xs font-mono shrink-0 ml-2">
                    {{ t('checkout.summary.removeDiscount') }}
                  </button>
                </div>
              </div>

              <!-- Code input — hidden once a coupon is applied unless stacking is on -->
              <div v-if="couponsStackable || !cart.appliedCoupons.length">
                <div class="flex gap-2">
                  <input
                    v-model="couponCode"
                    type="text"
                    :placeholder="t('checkout.summary.discountPlaceholder')"
                    @keyup.enter="applyCoupon"
                    class="flex-1 border border-black/15 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-charcoal transition-colors bg-white min-w-0"
                  />
                  <button
                    type="button"
                    @click="applyCoupon"
                    :disabled="!couponCode.trim() || couponLoading"
                    class="shrink-0 bg-charcoal text-white text-sm font-mono font-medium px-4 py-2.5 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span v-if="couponLoading">
                      <svg class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                    <span v-else>{{ t('checkout.summary.apply') }}</span>
                  </button>
                </div>
                <p v-if="couponError" class="text-xs text-red-500 mt-2">{{ couponError }}</p>
              </div>
            </div>

            <!-- Totals -->
            <div class="pt-4 flex flex-col gap-2.5 text-sm">
              <div class="flex justify-between text-gray-500">
                <span>{{ t('checkout.summary.subtotal') }}</span>
                <span>{{ cart.formatMoney(cart.subtotal) }}</span>
              </div>
              <div v-if="cart.discountAmount > 0" class="flex justify-between text-green-600 font-medium">
                <span>{{ t('cart.discount') }}</span>
                <span>-{{ cart.formatMoney(cart.discountAmount) }}</span>
              </div>
              <div class="flex justify-between text-gray-500">
                <span>{{ selectedShippingMethod?.resolved_info.name ?? t('checkout.summary.shipping') }}</span>
                <span :class="shipping === 0 ? 'text-green-600 font-medium' : ''">
                  {{ shipping === 0 ? t('checkout.summary.shippingFree') : (selectedShippingMethod?.rate?.display_price ?? cart.formatMoney(shipping)) }}
                </span>
              </div>
              <div class="flex justify-between items-baseline font-mono font-semibold text-base pt-3 border-t border-black/8 mt-1">
                <span>
                  {{ t('checkout.summary.total') }}
                  <span class="block text-[10px] font-normal text-gray-400 mt-0.5">{{ t('checkout.summary.taxIncluded') }}</span>
                </span>
                <span>{{ cart.formatMoney(total) }}</span>
              </div>
            </div>

            <!-- Subscription renewal notice -->
            <p v-if="cart.items.some(i => i.type === 'subscription')" class="font-mono text-xs text-primary/70 mt-4 pt-4 border-t border-black/6 flex items-start gap-1.5">
              <span class="shrink-0 mt-0.5">↻</span>
              {{ t('checkout.subscriptionRenewal') }}
            </p>

            <!-- Commitment notice -->
            <div v-if="commitmentItems.length" class="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3.5 h-3.5 shrink-0 text-amber-500">
                  <path fill-rule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
                </svg>
                <p class="font-mono text-xs font-semibold text-amber-700">{{ t('checkout.minCommitment') }}</p>
              </div>
              <div v-for="{ item, product } in commitmentItems" :key="item.id" class="font-mono text-xs text-amber-700 leading-relaxed">
                <span class="font-semibold">{{ item.product.name }}</span>:
                {{ t('checkout.minCommitmentItem', { n: product.minimumCommitmentCycles }) }}
                <template v-if="product.renewCommitmentOnCycle">
                  {{ t('checkout.minCommitmentRenew', { n: product.minimumCommitmentCycles }) }}
                </template>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  <!-- Issues modal — shown when can_proceed is false (out of stock / unavailable) -->
  <CheckoutIssuesModal
    v-if="showIssuesModal"
    :issues="checkoutIssues"
    @close="showIssuesModal = false"
    @remove="handleRemoveIssue"
  />

  <!-- Price warning modal — shown before order creation when prices changed -->
  <PriceWarningModal
    v-if="showWarningModal"
    :warnings="priceWarnings"
    @confirm="onWarningConfirmed"
    @cancel="showWarningModal = false"
  />

  <!-- Mobile sticky submit CTA (the inline submit is buried at the bottom on mobile) -->
  <div
    v-if="countriesStore.loaded && cart.items.length"
    class="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-black/8 px-5 py-3.5"
  >
    <button
      type="button"
      @click="submit"
      :disabled="submitting || !isFormReady"
      class="w-full bg-charcoal text-white font-mono font-medium py-3.5 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
    >
      <svg v-if="submitting" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {{ submitting ? t('checkout.submitting') : `${t('checkout.submit')} · ${cart.formatMoney(total)}` }}
    </button>
  </div>

  </div>
</template>

<style scoped>
.reveal-enter-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.reveal-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
</style>
