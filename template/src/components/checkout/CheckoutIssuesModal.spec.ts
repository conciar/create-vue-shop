import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import CheckoutIssuesModal from './CheckoutIssuesModal.vue'
import type { ConciarCheckoutIssue } from '@/api/conciar-types'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div/>' } },
      { path: '/cart', component: { template: '<div/>' }, name: 'cart' },
    ],
  })
}

function mountModal(issues: ConciarCheckoutIssue[]) {
  return mountWithPlugins(CheckoutIssuesModal, { props: { issues }, global: { plugins: [testRouter()] } })
}

beforeEach(() => vi.restoreAllMocks())

const issue = (over: Partial<ConciarCheckoutIssue> = {}): ConciarCheckoutIssue =>
  ({ sku: 'SKU-1', name: 'Item', type: 'out_of_stock', ...over } as never)

describe('CheckoutIssuesModal', () => {
  it('renders each issue with its translated label', () => {
    const wrapper = mountModal([issue({ type: 'out_of_stock' })])
    expect(wrapper.text()).toContain('Item')
    expect(wrapper.text()).toContain('Out of stock')
  })

  it('falls back to the generic label for an unrecognized issue type', () => {
    const wrapper = mountModal([issue({ type: 'some_unknown_type' })])
    expect(wrapper.text()).toContain('Unavailable')
  })

  it('emits remove with the issue when its remove button is clicked', async () => {
    const target = issue({ sku: 'SKU-2' })
    const wrapper = mountModal([target])
    await wrapper.get('button[title="Remove from cart"]').trigger('click')
    expect(wrapper.emitted('remove')?.[0]).toEqual([target])
  })

  it('emits close on the backdrop click', async () => {
    const wrapper = mountModal([issue()])
    await wrapper.get('.absolute.inset-0').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close and navigates to /cart via "Go to cart"', async () => {
    const wrapper = mountModal([issue()])
    const router = wrapper.vm.$router
    const pushSpy = vi.spyOn(router, 'push')
    await wrapper.findAll('button').find(b => b.text() === 'Go to cart')!.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(pushSpy).toHaveBeenCalledWith('/cart')
  })
})
