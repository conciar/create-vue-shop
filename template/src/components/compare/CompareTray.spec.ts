import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountWithPlugins } from '@/test-support/mount'
import CompareTray from './CompareTray.vue'
import { useCompareStore } from '@/stores/compare'
import { conciarApi } from '@/api/conciar'
import type { ConciarConnectProduct } from '@/api/conciar-types'

const product = (id: number, over: Partial<ConciarConnectProduct> = {}): ConciarConnectProduct =>
  ({ id, resolved_info: { name: `Product ${id}` }, files: [], ...over } as never)

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
  vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue({ property_values: [] } as never)
})

describe('CompareTray', () => {
  it('renders nothing when nothing is selected', () => {
    const wrapper = mountWithPlugins(CompareTray, { attachTo: document.body, global: { stubs: { teleport: true } } })
    expect(wrapper.find('.fixed.bottom-0').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows a thumbnail per selected item and empty slots up to 3', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    const wrapper = mountWithPlugins(CompareTray, { attachTo: document.body, global: { stubs: { teleport: true } } })
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('1 product selected')
    expect(wrapper.text()).toContain('2 slots remaining')
    wrapper.unmount()
  })

  it('removes an item via its remove button', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    const wrapper = mountWithPlugins(CompareTray, { attachTo: document.body, global: { stubs: { teleport: true } } })
    await wrapper.vm.$nextTick()

    await wrapper.get('[aria-label="Remove from comparison"]').trigger('click')
    expect(compare.items).toHaveLength(0)
    wrapper.unmount()
  })

  it('clears the selection via "Clear"', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    compare.toggle(product(2))
    const wrapper = mountWithPlugins(CompareTray, { attachTo: document.body, global: { stubs: { teleport: true } } })
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button').find(b => b.text() === 'Clear')!.trigger('click')
    expect(compare.items).toHaveLength(0)
    wrapper.unmount()
  })

  it('disables the Compare button with fewer than 2 items, enables it with 2+, and opens the modal', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    const wrapper = mountWithPlugins(CompareTray, { attachTo: document.body, global: { stubs: { teleport: true } } })
    await wrapper.vm.$nextTick()

    const compareButton = wrapper.findAll('button').find(b => b.text().includes('Compare'))!
    expect(compareButton.attributes('disabled')).toBeDefined()

    compare.toggle(product(2))
    await wrapper.vm.$nextTick()
    expect(compareButton.attributes('disabled')).toBeUndefined()

    await compareButton.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Compare products') // modal title
    wrapper.unmount()
  })
})
