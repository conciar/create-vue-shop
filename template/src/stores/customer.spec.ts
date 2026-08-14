import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCustomerStore } from './customer'
import { conciarApi } from '@/api/conciar'
import type { OtpVerifyResponse } from '@/api/conciar-types'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('customer store — OTP request', () => {
  it('requestOtp detects an email identifier, trims it and marks otpSent', async () => {
    vi.spyOn(conciarApi.auth, 'requestOtp').mockResolvedValue(undefined)
    const customer = useCustomerStore()
    await customer.requestOtp('  user@example.com  ')
    expect(customer.identifier).toBe('user@example.com')
    expect(customer.identifierType).toBe('email')
    expect(customer.otpSent).toBe(true)
    expect(conciarApi.auth.requestOtp).toHaveBeenCalledWith('user@example.com', 'email')
  })

  it('requestOtp detects a phone identifier (no @)', async () => {
    vi.spyOn(conciarApi.auth, 'requestOtp').mockResolvedValue(undefined)
    const customer = useCustomerStore()
    await customer.requestOtp('+31612345678')
    expect(customer.identifierType).toBe('phone')
  })

  it('resendOtp re-requests using the stored identifier/type', async () => {
    vi.spyOn(conciarApi.auth, 'requestOtp').mockResolvedValue(undefined)
    const resend = vi.spyOn(conciarApi.auth, 'resendOtp').mockResolvedValue(undefined)
    const customer = useCustomerStore()
    await customer.requestOtp('user@example.com')
    await customer.resendOtp()
    expect(resend).toHaveBeenCalledWith('user@example.com', 'email')
  })

  it('resetOtp clears the sent flag and identifier', async () => {
    vi.spyOn(conciarApi.auth, 'requestOtp').mockResolvedValue(undefined)
    const customer = useCustomerStore()
    await customer.requestOtp('user@example.com')
    customer.resetOtp()
    expect(customer.otpSent).toBe(false)
    expect(customer.identifier).toBe('')
  })
})

describe('customer store — OTP verify', () => {
  const okResponse: OtpVerifyResponse = {
    status: true,
    data: {
      access_token: 'tok-123',
      customer: { organization_customer_id: 42 } as never,
    },
  } as never

  it('verifyOtp on success stores the token/customer and links the cart', async () => {
    vi.spyOn(conciarApi.auth, 'verifyOtp').mockResolvedValue(okResponse)
    const customer = useCustomerStore()
    customer.identifier = 'user@example.com'
    await customer.verifyOtp('123456')

    expect(customer.accessToken).toBe('tok-123')
    expect(customer.isLoggedIn).toBe(true)
    expect(customer.organizationCustomerId).toBe(42)
    expect(localStorage.getItem('customer_token')).toBe('tok-123')
    expect(localStorage.getItem('customer_org_id')).toBe('42')
  })

  it('verifyOtp throws with attempts_remaining when the server rejects the code', async () => {
    vi.spyOn(conciarApi.auth, 'verifyOtp').mockResolvedValue({
      status: false,
      message: 'Invalid code',
      attempts_remaining: 2,
    } as never)
    const customer = useCustomerStore()
    await expect(customer.verifyOtp('000000')).rejects.toMatchObject({
      message: 'Invalid code',
      attempts_remaining: 2,
    })
    expect(customer.isLoggedIn).toBe(false)
  })
})

describe('customer store — logout', () => {
  it('clears all persisted and in-memory customer state', async () => {
    vi.spyOn(conciarApi.auth, 'verifyOtp').mockResolvedValue({
      status: true,
      data: { access_token: 'tok-123', customer: { organization_customer_id: 42 } },
    } as never)
    const customer = useCustomerStore()
    customer.identifier = 'user@example.com'
    await customer.verifyOtp('123456')

    customer.logout()

    expect(customer.accessToken).toBeNull()
    expect(customer.customer).toBeNull()
    expect(customer.organizationCustomerId).toBeNull()
    expect(customer.otpSent).toBe(false)
    expect(customer.identifier).toBe('')
    expect(localStorage.getItem('customer_token')).toBeNull()
    expect(localStorage.getItem('customer_profile')).toBeNull()
    expect(localStorage.getItem('customer_org_id')).toBeNull()
  })
})
