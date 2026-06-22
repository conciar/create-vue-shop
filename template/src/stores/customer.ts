import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { conciarApi } from '@/api/conciar'
import type { OtpIdentifierType, OtpCustomer } from '@/api/conciar-types'

const CUSTOMER_ID_KEY  = 'customer_org_id'
const TOKEN_KEY        = 'customer_token'
const CUSTOMER_KEY     = 'customer_profile'

export const useCustomerStore = defineStore('customer', () => {
  const identifier = ref('')
  const identifierType = ref<OtpIdentifierType>('email')
  const otpSent = ref(false)

  const accessToken = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const customer = ref<OtpCustomer | null>(
    JSON.parse(localStorage.getItem(CUSTOMER_KEY) ?? 'null')
  )

  const isLoggedIn = computed(() => !!accessToken.value)

  // organization_customer_id persisted for cart linking
  const organizationCustomerId = ref<number | null>(
    parseInt(localStorage.getItem(CUSTOMER_ID_KEY) ?? '') || null,
  )

  function detectType(input: string): OtpIdentifierType {
    return input.includes('@') ? 'email' : 'phone'
  }

  async function requestOtp(input: string) {
    identifier.value = input.trim()
    identifierType.value = detectType(identifier.value)
    await conciarApi.auth.requestOtp(identifier.value, identifierType.value)
    otpSent.value = true
  }

  async function verifyOtp(code: string) {
    const res = await conciarApi.auth.verifyOtp(identifier.value, identifierType.value, code)
    if (!res.status) {
      const err = new Error(res.message) as Error & { attempts_remaining?: number }
      err.attempts_remaining = (res as any).attempts_remaining
      throw err
    }

    accessToken.value = res.data.access_token
    customer.value = res.data.customer
    organizationCustomerId.value = res.data.customer.organization_customer_id
    localStorage.setItem(TOKEN_KEY, res.data.access_token)
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(res.data.customer))
    localStorage.setItem(CUSTOMER_ID_KEY, String(organizationCustomerId.value))

    // Link the cart to this customer
    const { useCartStore } = await import('./cart')
    const cart = useCartStore()
    await cart.linkCustomer(organizationCustomerId.value!)
  }

  async function resendOtp() {
    await conciarApi.auth.resendOtp(identifier.value, identifierType.value)
  }

  function resetOtp() {
    otpSent.value = false
    identifier.value = ''
  }

  function logout() {
    accessToken.value = null
    customer.value = null
    organizationCustomerId.value = null
    otpSent.value = false
    identifier.value = ''
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(CUSTOMER_KEY)
    localStorage.removeItem(CUSTOMER_ID_KEY)
  }

  return {
    identifier, identifierType, otpSent,
    accessToken, customer, isLoggedIn, organizationCustomerId,
    requestOtp, verifyOtp, resendOtp, resetOtp, logout,
  }
})
