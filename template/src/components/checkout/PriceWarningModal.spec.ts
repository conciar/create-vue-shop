import { describe, it, expect } from 'vitest'
import { mountWithPlugins } from '@/test-support/mount'
import PriceWarningModal from './PriceWarningModal.vue'
import type { ConciarPriceWarning } from '@/api/conciar-types'

const warning = (over: Partial<ConciarPriceWarning> = {}): ConciarPriceWarning =>
  ({ sku: 'SKU-1', name: 'Item', original_price: 10, new_price: 12, ...over } as never)

function mountModal(warnings: ConciarPriceWarning[]) {
  return mountWithPlugins(PriceWarningModal, { props: { warnings } })
}

describe('PriceWarningModal', () => {
  it('renders each warning with formatted old and new prices', () => {
    const wrapper = mountModal([warning({ original_price: 10, new_price: 12.5 })])
    expect(wrapper.text()).toContain('€ 10,00')
    expect(wrapper.text()).toContain('€ 12,50')
  })

  it('shows the new price in red when it increased, green when it decreased', () => {
    const higher = mountModal([warning({ original_price: 10, new_price: 15 })])
    expect(higher.find('.text-red-600').exists()).toBe(true)

    const lower = mountModal([warning({ original_price: 10, new_price: 5 })])
    expect(lower.find('.text-green-600').exists()).toBe(true)
  })

  it('emits confirm and cancel from their respective buttons', async () => {
    const wrapper = mountModal([warning()])
    await wrapper.findAll('button').find(b => b.text() === 'Go back')!.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)

    await wrapper.findAll('button').find(b => b.text() === 'Confirm & continue')!.trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })
})
