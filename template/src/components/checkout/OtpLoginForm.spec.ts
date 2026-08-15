import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountWithPlugins } from '@/test-support/mount'
import OtpLoginForm from './OtpLoginForm.vue'
import { useCustomerStore } from '@/stores/customer'
import { conciarApi } from '@/api/conciar'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('OtpLoginForm — step 1: request code', () => {
  it('disables send until the email looks valid', async () => {
    const wrapper = mountWithPlugins(OtpLoginForm)
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    await wrapper.get('input[type="email"]').setValue('user@example.com')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })

  it('sends the code and advances to step 2 on success', async () => {
    vi.spyOn(conciarApi.auth, 'requestOtp').mockResolvedValue(undefined)
    const wrapper = mountWithPlugins(OtpLoginForm)
    await wrapper.get('input[type="email"]').setValue('user@example.com')
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('user@example.com'))
    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
  })

  it('shows a "no account" message on a 404, and a generic error otherwise', async () => {
    vi.spyOn(conciarApi.auth, 'requestOtp').mockRejectedValue(Object.assign(new Error('nope'), { status: 404 }))
    const wrapper = mountWithPlugins(OtpLoginForm)
    await wrapper.get('input[type="email"]').setValue('user@example.com')
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain("couldn't find an account"))

    vi.spyOn(conciarApi.auth, 'requestOtp').mockRejectedValue(new Error('network'))
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Something went wrong'))
  })
})

describe('OtpLoginForm — step 2: verify code', () => {
  async function goToStep2() {
    vi.spyOn(conciarApi.auth, 'requestOtp').mockResolvedValue(undefined)
    const wrapper = mountWithPlugins(OtpLoginForm)
    await wrapper.get('input[type="email"]').setValue('user@example.com')
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('input[type="text"]').exists()).toBe(true))
    return wrapper
  }

  it('auto-submits once 6 digits are entered, and emits success', async () => {
    vi.spyOn(conciarApi.auth, 'verifyOtp').mockResolvedValue({
      status: true, data: { access_token: 'tok', customer: { organization_customer_id: 1 } },
    } as never)
    const wrapper = await goToStep2()

    await wrapper.get('input[type="text"]').setValue('123456')
    await vi.waitFor(() => expect(wrapper.emitted('success')).toHaveLength(1))
  })

  it('strips non-digits and caps input at 6 characters', async () => {
    const wrapper = await goToStep2()
    const input = wrapper.get('input[type="text"]')
    await input.setValue('12ab34cd5678')
    expect((input.element as HTMLInputElement).value).toBe('123456')
  })

  it('shows attempts-remaining on an incorrect code, and locks out at 0', async () => {
    vi.spyOn(conciarApi.auth, 'verifyOtp').mockRejectedValue(Object.assign(new Error('bad'), { attempts_remaining: 2 }))
    const wrapper = await goToStep2()
    await wrapper.get('input[type="text"]').setValue('000000')
    await vi.waitFor(() => expect(wrapper.text()).toContain('attempt'))

    vi.spyOn(conciarApi.auth, 'verifyOtp').mockRejectedValue(Object.assign(new Error('bad'), { attempts_remaining: 0 }))
    await wrapper.get('input[type="text"]').setValue('000000')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Too many incorrect attempts'))
    expect(wrapper.get('input[type="text"]').attributes('disabled')).toBeDefined()
  })

  it('shows a generic invalid-code error when the server gives no attempts_remaining', async () => {
    vi.spyOn(conciarApi.auth, 'verifyOtp').mockRejectedValue(new Error('bad'))
    const wrapper = await goToStep2()
    await wrapper.get('input[type="text"]').setValue('000000')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Invalid or expired code'))
  })

  it('changeEmail resets back to step 1', async () => {
    const wrapper = await goToStep2()
    await wrapper.findAll('button').find(b => b.text() === 'Change')!.trigger('click')
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)

    const customer = useCustomerStore()
    expect(customer.otpSent).toBe(false)
  })
})

describe('OtpLoginForm — resend', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  async function goToStep2() {
    vi.spyOn(conciarApi.auth, 'requestOtp').mockResolvedValue(undefined)
    const wrapper = mountWithPlugins(OtpLoginForm)
    await wrapper.get('input[type="email"]').setValue('user@example.com')
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('input[type="text"]').exists()).toBe(true))
    return wrapper
  }

  it('shows a countdown after sending, then allows resend once it elapses', async () => {
    const wrapper = await goToStep2()
    expect(wrapper.text()).toContain('Resend code in')

    await vi.advanceTimersByTimeAsync(30000)
    expect(wrapper.findAll('button').some(b => b.text() === 'Resend code')).toBe(true)
  })

  it('resends the code and shows a success message', async () => {
    const wrapper = await goToStep2()
    await vi.advanceTimersByTimeAsync(30000)

    vi.spyOn(conciarApi.auth, 'resendOtp').mockResolvedValue(undefined)
    await wrapper.findAll('button').find(b => b.text() === 'Resend code')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Code resent.'))
  })

  it('shows an error when resend fails', async () => {
    const wrapper = await goToStep2()
    await vi.advanceTimersByTimeAsync(30000)

    vi.spyOn(conciarApi.auth, 'resendOtp').mockRejectedValue(new Error('boom'))
    await wrapper.findAll('button').find(b => b.text() === 'Resend code')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Resend failed'))
  })
})
