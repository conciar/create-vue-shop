import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import LoginView from './LoginView.vue'
import OtpLoginForm from '@/components/checkout/OtpLoginForm.vue'
import { useCustomerStore } from '@/stores/customer'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/login', component: LoginView },
      { path: '/checkout', component: { template: '<div/>' } },
      { path: '/products', component: { template: '<div/>' } },
    ],
  })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('LoginView', () => {
  it('renders the OTP form and shop links', async () => {
    const router = testRouter()
    await router.push('/login')
    const wrapper = mountWithPlugins(LoginView, { global: { plugins: [router] } })
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/products"]').exists()).toBe(true)
  })

  it('redirects immediately on mount if already logged in', async () => {
    const router = testRouter()
    await router.push('/login?returnTo=/checkout')
    const customer = useCustomerStore()
    customer.accessToken = 'tok'

    mountWithPlugins(LoginView, { global: { plugins: [router] } })
    await router.isReady()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/checkout'))
  })

  it('replaces to the default "/" when no returnTo query is present', async () => {
    const router = testRouter()
    await router.push('/login')
    const customer = useCustomerStore()
    customer.accessToken = 'tok'

    mountWithPlugins(LoginView, { global: { plugins: [router] } })
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/'))
  })

  it('navigates to returnTo when the OTP form emits success', async () => {
    const router = testRouter()
    await router.push('/login?returnTo=/checkout')
    const wrapper = mountWithPlugins(LoginView, { global: { plugins: [router] } })

    await wrapper.findComponent(OtpLoginForm).vm.$emit('success')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/checkout'))
  })
})
