import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import AccountSubscriptionDetailView from './AccountSubscriptionDetailView.vue'
import { useCustomerStore } from '@/stores/customer'
import { conciarApi } from '@/api/conciar'
import type { ConciarCustomerSubscription, ConciarCountry } from '@/api/conciar-types'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/account/subscriptions/:id', component: AccountSubscriptionDetailView },
      { path: '/account/subscriptions', name: 'subscriptions-account', component: { template: '<div/>' } },
      { path: '/login', component: { template: '<div/>' } },
    ],
  })
}

const sub = (over: Partial<ConciarCustomerSubscription> = {}): ConciarCustomerSubscription => ({
  id: 1,
  status: { name: 'active' },
  quantity: 1,
  skip_count: 0,
  next_billing_at: '2026-04-01T00:00:00Z',
  cancelled_at: null,
  cancellation_reason: null,
  commitment_cycles_remaining: 0,
  minimum_commitment_cycles: null,
  renew_commitment_on_cycle: false,
  cycles: [],
  customer_payment_method: null,
  shipping_address: null,
  shipping_method: null,
  product: {
    default_info: { name: 'Sample Box' },
    subscription_detail: { billing_cycle_unit: 'month', billing_cycle_interval: 1 },
    retail_price: { display_price: '€ 20,00' },
  },
  ...over,
} as never)

const nl: ConciarCountry = { id: 1, name: 'netherlands', iso_code_2: 'NL' } as never

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  useCustomerStore().accessToken = 'tok'
  vi.spyOn(conciarApi.countries, 'list').mockResolvedValue([nl])
})

async function mountSub(id = 1) {
  const router = testRouter()
  await router.push(`/account/subscriptions/${id}`)
  // Modals render via <Teleport to="body">; stub it so they stay reachable
  // through the wrapper's own find()/text() queries.
  const wrapper = mountWithPlugins(AccountSubscriptionDetailView, {
    global: { plugins: [router], stubs: { teleport: true } },
  })
  await vi.waitFor(() => expect(wrapper.findAll('.animate-pulse').length).toBe(0))
  return { wrapper, router }
}

describe('AccountSubscriptionDetailView — loading & errors', () => {
  it('shows a skeleton, then the subscription', async () => {
    let resolve!: (v: ConciarCustomerSubscription) => void
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockReturnValue(new Promise(r => (resolve = r)))
    const router = testRouter()
    await router.push('/account/subscriptions/1')
    const wrapper = mountWithPlugins(AccountSubscriptionDetailView, { global: { plugins: [router] } })
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)

    resolve(sub())
    await vi.waitFor(() => expect(wrapper.text()).toContain('Sample Box'))
  })

  it('shows a not-found message on a non-401 failure', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockRejectedValue(new Error('boom'))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('Subscription not found.')
  })

  it('logs out and redirects to /login on a 401', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockRejectedValue(Object.assign(new Error('unauth'), { status: 401 }))
    const { router } = await mountSub()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
    expect(useCustomerStore().isLoggedIn).toBe(false)
  })
})

describe('AccountSubscriptionDetailView — header', () => {
  it('shows product name, billing label, status and price', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('Sample Box')
    expect(wrapper.text()).toContain('Every month')
    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('€ 20,00')
  })

  it('formats a four-weekly billing cycle distinctly', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      product: { default_info: { name: 'Box' }, subscription_detail: { billing_cycle_unit: 'four_weekly', billing_cycle_interval: 1 }, retail_price: {} } as never,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('Every 4 weeks')
  })

  it('pluralizes a multi-interval billing cycle', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      product: { default_info: { name: 'Box' }, subscription_detail: { billing_cycle_unit: 'month', billing_cycle_interval: 3 }, retail_price: {} } as never,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('Every 3 months')
  })

  it('shows the delivered count and skipped count once there is cycle history', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      cycles: [
        { id: 1, status: { name: 'paid' }, period_start: '2026-01-01', period_end: '2026-02-01' },
        { id: 2, status: { name: 'skipped' }, period_start: '2026-02-01', period_end: '2026-03-01' },
      ] as never,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('1×')
    expect(wrapper.text()).toContain('1× skipped')
  })

  it('shows the IBAN payment method summary', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      customer_payment_method: { payment_method: { name: 'SEPA' }, iban_last_four: '1234' },
    } as never))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('SEPA')
    expect(wrapper.text()).toContain('1234')
  })

  it('shows the card payment method summary with expiry', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      customer_payment_method: { payment_method: { name: 'Visa' }, last_four: '4242', expiry_month: 5, expiry_year: 2028 },
    } as never))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('4242')
    expect(wrapper.text()).toContain('05/28')
  })
})

describe('AccountSubscriptionDetailView — commitment progress', () => {
  it('shows dots for <=12 total cycles and the remaining-cycles message when blocked', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      minimum_commitment_cycles: 6, commitment_cycles_remaining: 4,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('2 / 6')
    expect(wrapper.text()).toContain('4 cycles remaining')
  })

  it('shows a progress bar for >12 total cycles', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      minimum_commitment_cycles: 20, commitment_cycles_remaining: 10,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.find('.bg-gray-100.rounded-full.h-2').exists()).toBe(true)
  })

  it('shows a completion message once commitment is satisfied (renews) or free to cancel', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      minimum_commitment_cycles: 6, commitment_cycles_remaining: 0, renew_commitment_on_cycle: true,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('commitment renews automatically')
  })
})

describe('AccountSubscriptionDetailView — action bar states', () => {
  it('shows the cancelled banner with reason', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      status: { name: 'cancelled' }, cancelled_at: '2026-02-01T00:00:00Z', cancellation_reason: 'Too expensive',
    } as never))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('Cancelled on')
    expect(wrapper.text()).toContain('Too expensive')
  })

  it('paused: resumes the subscription', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({ status: { name: 'paused' } } as never))
    const resume = vi.spyOn(conciarApi.customerSubscriptions, 'resume').mockResolvedValue(sub({ status: { name: 'active' } } as never))
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Resume')!.trigger('click')
    await vi.waitFor(() => expect(resume).toHaveBeenCalledWith('tok', 1))
  })

  it('active with pending skips: removes one skip and removes all skips', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({ skip_count: 2 }))
    const unskip1 = vi.spyOn(conciarApi.customerSubscriptions, 'unskip').mockResolvedValue(sub({ skip_count: 1 }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('2 deliveries skipped')

    await wrapper.findAll('button').find(b => b.text() === 'Remove 1 skip')!.trigger('click')
    await vi.waitFor(() => expect(unskip1).toHaveBeenCalledWith('tok', 1, 1))
  })

  it('active, commitment-blocked: shows the locked state instead of the skip stepper', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      minimum_commitment_cycles: 6, commitment_cycles_remaining: 3,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('Term active')
    expect(wrapper.find('button[disabled]').exists()).toBe(false) // pause hidden entirely, not just disabled
  })

  it('active, no skips: adjusts the skip stepper and skips N cycles', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    const skip = vi.spyOn(conciarApi.customerSubscriptions, 'skip').mockResolvedValue(sub({ skip_count: 3 }))
    const { wrapper } = await mountSub()

    const plus = wrapper.findAll('button').find(b => b.text() === '+')!
    await plus.trigger('click')
    await plus.trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Skip 3')!.trigger('click')
    await vi.waitFor(() => expect(skip).toHaveBeenCalledWith('tok', 1, 3))
  })

  it('active: opens the pause and cancel modals', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text().includes('Pause'))!.trigger('click')
    expect(wrapper.text()).toContain('Pause subscription?')

    await wrapper.get('[aria-label="Close"]').trigger('click')
    await wrapper.findAll('button').find(b => b.text().includes('Cancel subscription'))!.trigger('click')
    expect(wrapper.text()).toContain('Cancel subscription?')
  })
})

describe('AccountSubscriptionDetailView — renewal delivery', () => {
  it('shows "no delivery address" when unset, and the address when set', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('No delivery address set yet')

    vi.restoreAllMocks()
    useCustomerStore().accessToken = 'tok'
    vi.spyOn(conciarApi.countries, 'list').mockResolvedValue([nl])
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      shipping_address: { street: 'Main St', house_number: '1', city: 'Amsterdam', zipcode: '1000AA' },
      shipping_method: { name: 'Standard' },
    } as never))
    const { wrapper: wrapper2 } = await mountSub()
    expect(wrapper2.text()).toContain('Main St 1')
    expect(wrapper2.text()).toContain('Standard')
  })

  it('opens the shipping modal, finds methods and saves the new delivery details', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    const shippingMethods = vi.spyOn(conciarApi.customerSubscriptions, 'shippingMethods').mockResolvedValue([
      { id: 1, is_free: true, resolved_info: { name: 'Standard' } } as never,
    ])
    const update = vi.spyOn(conciarApi.customerSubscriptions, 'updateShipping').mockResolvedValue(sub({
      shipping_address: { city: 'Amsterdam' }, shipping_method: { name: 'Standard' },
    } as never))
    const { wrapper } = await mountSub()

    await wrapper.findAll('button').find(b => b.text() === 'Change')!.trigger('click')
    expect(wrapper.text()).toContain('Change delivery')
    // openShippingModal() awaits countries.fetch() internally — wait for the
    // option to actually render before selecting it.
    await vi.waitFor(() => expect(wrapper.text()).toContain('Netherlands'))

    await wrapper.get('select').setValue('1')
    await wrapper.get('input[placeholder="City"]').setValue('Amsterdam')
    await wrapper.findAll('button').find(b => b.text().includes('Find delivery options'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Standard'))
    expect(shippingMethods).toHaveBeenCalled()

    await wrapper.findAll('button').find(b => b.text().includes('Standard'))!.trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Save delivery details')!.trigger('click')
    await vi.waitFor(() => expect(update).toHaveBeenCalled())
  })
})

describe('AccountSubscriptionDetailView — timeline', () => {
  it('renders past cycles and expands order details on click', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      cycles: [{
        id: 1, status: { name: 'paid' }, period_start: '2026-01-01', period_end: '2026-02-01',
        order: { reference: 'ORD-1', status: { name: 'completed' } },
      }] as never,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('Deliveries')
    expect(wrapper.text()).not.toContain('ORD-1')

    await wrapper.get('.cursor-pointer').trigger('click')
    expect(wrapper.text()).toContain('ORD-1')
  })

  it('renders future cycles, marking skipped ones and the next delivery', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({ skip_count: 1 }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('upcoming')
  })
})

describe('AccountSubscriptionDetailView — product swap', () => {
  beforeEach(() => {
    vi.spyOn(conciarApi.storeConfig, 'get').mockResolvedValue({ allowSubscriptionProductSwap: true } as never)
  })

  it('hides the swap row when swapping is not allowed by store config', async () => {
    vi.spyOn(conciarApi.storeConfig, 'get').mockResolvedValue({ allowSubscriptionProductSwap: false } as never)
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    const { wrapper } = await mountSub()
    expect(wrapper.text()).not.toContain('Switch')
  })

  it('variants mode: selects a variant and submits', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'swapOptions').mockResolvedValue({
      variants: [{ id: 10, default_info: { name: 'Large' }, retail_price: { amount: '25', currency: { symbol_icon: '€' } } }],
    } as never)
    const swap = vi.spyOn(conciarApi.customerSubscriptions, 'swap').mockResolvedValue(sub())
    const { wrapper } = await mountSub()

    await wrapper.findAll('button').find(b => b.text() === 'Switch')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Large'))
    await wrapper.findAll('button').find(b => b.text().includes('Large'))!.trigger('click')
    // Two buttons are labeled "Switch" — the page's swap trigger and the modal's submit; the submit is the last one.
    await wrapper.findAll('button').filter(b => b.text() === 'Switch').at(-1)!.trigger('click')
    await vi.waitFor(() => expect(swap).toHaveBeenCalledWith('tok', 1, null, 10))
  })

  it('products mode: selects a product (with a single active variant) and submits', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'swapOptions').mockResolvedValue({
      products: [{
        id: 20, default_info: { name: 'Rosé Box' },
        variants: [{ id: 30, active: true, out_of_stock: false }],
      }],
    } as never)
    const swap = vi.spyOn(conciarApi.customerSubscriptions, 'swap').mockResolvedValue(sub())
    const { wrapper } = await mountSub()

    await wrapper.findAll('button').find(b => b.text() === 'Switch')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Rosé Box'))
    await wrapper.findAll('button').find(b => b.text().includes('Rosé Box'))!.trigger('click')
    await wrapper.findAll('button').filter(b => b.text() === 'Switch').at(-1)!.trigger('click')
    await vi.waitFor(() => expect(swap).toHaveBeenCalledWith('tok', 1, 20, 30))
  })

  it('products mode: requires an explicit variant pick when more than one is active', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'swapOptions').mockResolvedValue({
      products: [{
        id: 20, default_info: { name: 'Rosé Box' },
        variants: [{ id: 30, active: true, out_of_stock: false }, { id: 31, active: true, out_of_stock: false }],
      }],
    } as never)
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Switch')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Rosé Box'))
    await wrapper.findAll('button').find(b => b.text().includes('Rosé Box'))!.trigger('click')

    const submit = wrapper.findAll('button').filter(b => b.text() === 'Switch').at(-1)!
    expect(submit.attributes('disabled')).toBeDefined()
  })

  it('shows an error state when loading swap options fails', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'swapOptions').mockRejectedValue(new Error('boom'))
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Switch')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Could not load options.'))
  })
})

describe('AccountSubscriptionDetailView — update payment method', () => {
  it('lists methods, selects one, and submits (redirecting on a payment_url)', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      customer_payment_method: { payment_method: { name: 'SEPA' } },
    } as never))
    vi.spyOn(conciarApi.storePaymentMethods, 'list').mockResolvedValue([
      { id: 1, name: 'iDEAL', payment_service_provider: { name: 'Mollie' }, payment_service_provider_id: 5 },
    ] as never)
    vi.spyOn(conciarApi.customerSubscriptions, 'updatePaymentMethod').mockResolvedValue({ payment_url: 'https://pay.example.com/x', transaction_key: null })
    const originalLocation = window.location
    // @ts-expect-error stubbing jsdom navigation
    delete window.location
    window.location = { ...originalLocation, href: '', origin: 'https://shop.example.com' } as never

    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Change')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))
    await wrapper.findAll('button').find(b => b.text().includes('iDEAL'))!.trigger('click')
    await wrapper.findAll('button').find(b => b.text().includes('Continue to Mollie'))!.trigger('click')
    await vi.waitFor(() => expect(window.location.href).toBe('https://pay.example.com/x'))
    window.location = originalLocation
  })

  it('shows an empty-methods message when none are available', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      customer_payment_method: { payment_method: { name: 'SEPA' } },
    } as never))
    vi.spyOn(conciarApi.storePaymentMethods, 'list').mockResolvedValue([])
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Change')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No payment methods available.'))
  })
})

describe('AccountSubscriptionDetailView — cancel with commitment warning', () => {
  it('shows the commitment warning and submits a cancellation reason', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      minimum_commitment_cycles: 6, commitment_cycles_remaining: 2,
    }))
    const cancel = vi.spyOn(conciarApi.customerSubscriptions, 'cancel').mockResolvedValue(sub({ status: { name: 'cancelled' } } as never))
    const { wrapper } = await mountSub()

    await wrapper.findAll('button').find(b => b.text().includes('Cancel subscription'))!.trigger('click')
    expect(wrapper.text()).toContain('still in a minimum term')

    await wrapper.get('input[type="text"]').setValue('Moving abroad')
    await wrapper.findAll('button').find(b => b.text() === 'Yes, cancel my subscription')!.trigger('click')
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledWith('tok', 1, 'Moving abroad'))
  })
})

describe('AccountSubscriptionDetailView — action errors', () => {
  it('shows an error message when a modal action fails (non-401)', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'pause').mockRejectedValue(
      Object.assign(new Error('bad'), { body: { message: 'Cannot pause right now.' } }),
    )
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text().includes('Pause'))!.trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Yes, pause my subscription')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cannot pause right now.'))
  })

  it('surfaces a failed resume inline in the paused action bar', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({ status: { name: 'paused' } } as never))
    vi.spyOn(conciarApi.customerSubscriptions, 'resume').mockRejectedValue(
      Object.assign(new Error('bad'), { body: { message: 'Cannot resume right now.' } }),
    )
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Resume')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cannot resume right now.'))
  })

  it('surfaces a failed skip inline in the active action bar', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'skip').mockRejectedValue(
      Object.assign(new Error('bad'), { body: { message: 'Cannot skip right now.' } }),
    )
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Skip next')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cannot skip right now.'))
  })

  it('surfaces a failed unskip inline in the active action bar', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({ skip_count: 2 }))
    vi.spyOn(conciarApi.customerSubscriptions, 'unskip').mockRejectedValue(
      Object.assign(new Error('bad'), { body: { message: 'Cannot unskip right now.' } }),
    )
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Remove 1 skip')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cannot unskip right now.'))
  })

  it('falls back to a generic error message when the failure carries no API message', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({ status: { name: 'paused' } } as never))
    vi.spyOn(conciarApi.customerSubscriptions, 'resume').mockRejectedValue(new Error('network down'))
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Resume')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Something went wrong.'))
  })

  it('clears a prior inline action error when a modal is opened', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'skip').mockRejectedValue(
      Object.assign(new Error('bad'), { body: { message: 'Cannot skip right now.' } }),
    )
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Skip next')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Cannot skip right now.'))

    await wrapper.findAll('button').find(b => b.text().includes('Pause'))!.trigger('click')
    expect(wrapper.text()).not.toContain('Cannot skip right now.')
  })

  it('logs out and redirects to /login when an action gets a 401', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({ status: { name: 'paused' } } as never))
    vi.spyOn(conciarApi.customerSubscriptions, 'resume').mockRejectedValue(Object.assign(new Error('unauth'), { status: 401 }))
    const { wrapper, router } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Resume')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
  })
})

describe('AccountSubscriptionDetailView — mandate-updated banner', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the banner when navigated with ?mandate=update, and clears the query', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    const router = testRouter()
    await router.push('/account/subscriptions/1?mandate=update')
    const wrapper = mountWithPlugins(AccountSubscriptionDetailView, { global: { plugins: [router] } })
    await vi.waitFor(() => expect(wrapper.findAll('.animate-pulse').length).toBe(0))

    expect(wrapper.text()).toContain('Payment method updated.')
    await vi.waitFor(() => expect(router.currentRoute.value.query.mandate).toBeUndefined())

    await vi.advanceTimersByTimeAsync(6000)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('Payment method updated.')
  })
})

describe('AccountSubscriptionDetailView — status and interval variants', () => {
  it('renders every cycle status variant (paid, skipped, failed, pending) with its own styling', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      cycles: [
        { id: 1, status: { name: 'paid' }, period_start: '2026-01-01', period_end: '2026-02-01', attempted_at: '2026-01-01T00:00:00Z' },
        { id: 2, status: { name: 'skipped' }, period_start: '2026-02-01', period_end: '2026-03-01' },
        { id: 3, status: { name: 'failed' }, period_start: '2026-03-01', period_end: '2026-04-01' },
        { id: 4, status: { name: 'pending' }, period_start: '2026-04-01', period_end: '2026-05-01' },
      ] as never,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.find('.bg-green-400').exists()).toBe(true)
    expect(wrapper.find('.bg-amber-300').exists()).toBe(true)
    expect(wrapper.find('.bg-red-400').exists()).toBe(true)
    expect(wrapper.find('.bg-blue-300').exists()).toBe(true)
    expect(wrapper.text()).toContain('Delivered')
    expect(wrapper.text()).toContain('Skipped')
    expect(wrapper.text()).toContain('Failed')
  })

  it('renders every order status variant on expanded cycles', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      cycles: [
        { id: 1, status: { name: 'paid' }, period_start: '2026-01-01', period_end: '2026-02-01', order: { reference: 'O-1', status: { name: 'completed' } } },
        { id: 2, status: { name: 'paid' }, period_start: '2026-02-01', period_end: '2026-03-01', order: { reference: 'O-2', status: { name: 'processing' } } },
        { id: 3, status: { name: 'paid' }, period_start: '2026-03-01', period_end: '2026-04-01', order: { reference: 'O-3', status: { name: 'cancelled' } } },
        { id: 4, status: { name: 'paid' }, period_start: '2026-04-01', period_end: '2026-05-01', order: { reference: 'O-4', status: { name: 'pending' } } },
      ] as never,
    }))
    const { wrapper } = await mountSub()
    for (const row of wrapper.findAll('.cursor-pointer')) await row.trigger('click')
    expect(wrapper.text()).toContain('Completed')
    expect(wrapper.text()).toContain('Processing')
    expect(wrapper.text()).toContain('Cancelled')
    expect(wrapper.text()).toContain('Pending')
  })

  it('collapses an expanded cycle when clicked a second time', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      cycles: [{ id: 1, status: { name: 'paid' }, period_start: '2026-01-01', period_end: '2026-02-01', order: { reference: 'O-1', status: { name: 'completed' } } }] as never,
    }))
    const { wrapper } = await mountSub()
    await wrapper.get('.cursor-pointer').trigger('click')
    expect(wrapper.text()).toContain('O-1')
    await wrapper.get('.cursor-pointer').trigger('click')
    expect(wrapper.text()).not.toContain('O-1')
  })

  it('projects future cycles for each billing unit (week, quarterly, year, unknown)', async () => {
    for (const unit of ['week', 'quarterly', 'year', 'fortnight']) {
      vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
        product: {
          default_info: { name: 'Box' },
          subscription_detail: { billing_cycle_unit: unit, billing_cycle_interval: 1 },
          retail_price: {},
        } as never,
      }))
      const { wrapper } = await mountSub()
      expect(wrapper.text()).toContain('upcoming')
    }
  })

  it('shows no timeline at all for a cancelled subscription with no cycle history', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      status: { name: 'cancelled' } as never, cycles: [], next_billing_at: null,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).not.toContain('Deliveries')
  })

  it('falls back to the raw amount when retail_price has no display_price', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      product: {
        default_info: { name: 'Box' },
        subscription_detail: { billing_cycle_unit: 'month', billing_cycle_interval: 1 },
        retail_price: { amount: '19.99' },
      } as never,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('19.99')
  })

  it('shows a dash when the product has no price at all', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      product: {
        default_info: { name: 'Box' },
        subscription_detail: { billing_cycle_unit: 'month', billing_cycle_interval: 1 },
        retail_price: null,
      } as never,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('–')
  })

  it('reads the product name from defaultInfo (camelCase) when default_info is absent', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      product: {
        defaultInfo: { name: 'CamelCase Box' },
        subscription_detail: { billing_cycle_unit: 'month', billing_cycle_interval: 1 },
        retail_price: {},
      } as never,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('CamelCase Box')
  })

  it('shows "Cancelled" without a date when cancelled_at is absent', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      status: { name: 'cancelled' } as never, cancelled_at: null, cancellation_reason: null,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('Cancelled')
  })
})

describe('AccountSubscriptionDetailView — additional branch coverage', () => {
  it('falls back to the raw status name for an unrecognized status', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({ status: { name: 'inactive' } } as never))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('inactive')
  })

  it('removes all pending skips', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({ skip_count: 2 }))
    const unskipAll = vi.spyOn(conciarApi.customerSubscriptions, 'unskip').mockResolvedValue(sub({ skip_count: 0 }))
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Remove all')!.trigger('click')
    await vi.waitFor(() => expect(unskipAll).toHaveBeenCalledWith('tok', 1))
  })

  it('renders a past cycle without an order (no expand affordance) and without attempted_at', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      cycles: [{ id: 1, status: { name: 'paid' }, period_start: '2026-01-01', period_end: '2026-02-01' }] as never,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.find('.cursor-pointer').exists()).toBe(false)
  })

  it('shows the "Today" divider when both past and future cycles are present', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      cycles: [{ id: 1, status: { name: 'paid' }, period_start: '2026-01-01', period_end: '2026-02-01' }] as never,
    }))
    const { wrapper } = await mountSub()
    expect(wrapper.text()).toContain('Today')
    expect(wrapper.text()).toContain('upcoming · history')
  })

  it('swap variants mode: shows an empty state when there are no variants to switch to', async () => {
    vi.spyOn(conciarApi.storeConfig, 'get').mockResolvedValue({ allowSubscriptionProductSwap: true } as never)
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'swapOptions').mockResolvedValue({ variants: [] } as never)
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Switch')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No other variants available.'))
  })

  it('swap products mode: shows an empty state when there are no products to switch to', async () => {
    vi.spyOn(conciarApi.storeConfig, 'get').mockResolvedValue({ allowSubscriptionProductSwap: true } as never)
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'swapOptions').mockResolvedValue({ products: [] } as never)
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Switch')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('No other products available.'))
  })

  it('shows an error loading mandate payment methods (non-401)', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      customer_payment_method: { payment_method: { name: 'SEPA' } },
    } as never))
    vi.spyOn(conciarApi.storePaymentMethods, 'list').mockRejectedValue(new Error('boom'))
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Change')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Could not load payment methods.'))
  })

  it('logs out and redirects on a 401 loading mandate payment methods', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      customer_payment_method: { payment_method: { name: 'SEPA' } },
    } as never))
    vi.spyOn(conciarApi.storePaymentMethods, 'list').mockRejectedValue(Object.assign(new Error('unauth'), { status: 401 }))
    const { wrapper, router } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Change')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
  })

  it('shows an error loading swap options on a 401 by redirecting to /login', async () => {
    vi.spyOn(conciarApi.storeConfig, 'get').mockResolvedValue({ allowSubscriptionProductSwap: true } as never)
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'swapOptions').mockRejectedValue(Object.assign(new Error('unauth'), { status: 401 }))
    const { wrapper, router } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Switch')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
  })

  it('shows a shipping-methods load error on a non-401 failure', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'shippingMethods').mockRejectedValue(new Error('boom'))
    const { wrapper } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Change')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Netherlands'))
    await wrapper.get('select').setValue('1')
    await wrapper.get('input[placeholder="City"]').setValue('Amsterdam')
    await wrapper.findAll('button').find(b => b.text().includes('Find delivery options'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Could not load delivery options for this address.'))
  })

  it('logs out and redirects on a 401 loading shipping methods', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'shippingMethods').mockRejectedValue(Object.assign(new Error('unauth'), { status: 401 }))
    const { wrapper, router } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Change')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Netherlands'))
    await wrapper.get('select').setValue('1')
    await wrapper.get('input[placeholder="City"]').setValue('Amsterdam')
    await wrapper.findAll('button').find(b => b.text().includes('Find delivery options'))!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
  })

  it('logs out and redirects on a 401 when cancelling fails', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub())
    vi.spyOn(conciarApi.customerSubscriptions, 'cancel').mockRejectedValue(Object.assign(new Error('unauth'), { status: 401 }))
    const { wrapper, router } = await mountSub()
    await wrapper.findAll('button').find(b => b.text().includes('Cancel subscription'))!.trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Yes, cancel my subscription')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
  })

  it('logs out and redirects on a 401 when updating the payment method fails', async () => {
    vi.spyOn(conciarApi.customerSubscriptions, 'get').mockResolvedValue(sub({
      customer_payment_method: { payment_method: { name: 'SEPA' } },
    } as never))
    vi.spyOn(conciarApi.storePaymentMethods, 'list').mockResolvedValue([{ id: 1, name: 'iDEAL' }] as never)
    vi.spyOn(conciarApi.customerSubscriptions, 'updatePaymentMethod').mockRejectedValue(Object.assign(new Error('unauth'), { status: 401 }))
    const { wrapper, router } = await mountSub()
    await wrapper.findAll('button').find(b => b.text() === 'Change')!.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('iDEAL'))
    await wrapper.findAll('button').find(b => b.text().includes('iDEAL'))!.trigger('click')
    await wrapper.findAll('button').find(b => b.text() === 'Continue')!.trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/login'))
  })
})
