import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountWithPlugins } from '@/test-support/mount'
import CompareModal from './CompareModal.vue'
import { useCompareStore } from '@/stores/compare'
import { conciarApi } from '@/api/conciar'
import type { ConciarConnectProduct, ConciarProduct } from '@/api/conciar-types'

const product = (id: number, over: Partial<ConciarConnectProduct> = {}): ConciarConnectProduct =>
  ({ id, resolved_info: { name: `Product ${id}` }, converted_retail_price: { display_price: `€ ${id}.00` }, files: [], ...over } as never)

function detail(over: Partial<ConciarProduct> = {}): ConciarProduct {
  return { property_values: [], ...over } as never
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('CompareModal', () => {
  it('shows a loading state while product details are being fetched', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    let resolveDetail!: (v: ConciarProduct) => void
    vi.spyOn(conciarApi.products, 'getDetail').mockReturnValue(new Promise(r => (resolveDetail = r)))

    const wrapper = mountWithPlugins(CompareModal)
    expect(wrapper.text()).toContain('Loading details…')

    resolveDetail(detail())
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Loading details…'))
  })

  it('falls back to null (dash) when a detail fetch fails', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    vi.spyOn(conciarApi.products, 'getDetail').mockRejectedValue(new Error('boom'))

    const wrapper = mountWithPlugins(CompareModal)
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Loading details…'))
    expect(wrapper.text()).toContain('Product 1')
  })

  it('renders a property row per non-hidden key, merged across products', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    compare.toggle(product(2))
    vi.spyOn(conciarApi.products, 'getDetail').mockImplementation(async (id: string) => detail({
      property_values: [
        { property: { key: 'color', default_info: { label: 'Color' } }, default_info: { value: id === '1' ? 'Red' : null } },
        { property: { key: 'tags', default_info: { label: 'Tags' } }, default_info: { value: 'hidden-me' } },
      ] as never,
    }))

    const wrapper = mountWithPlugins(CompareModal)
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Loading details…'))

    expect(wrapper.text()).toContain('Color')
    expect(wrapper.text()).toContain('Red')
    expect(wrapper.text()).not.toContain('hidden-me') // "tags" is in the HIDDEN set
  })

  it('shows an empty add-slot column when fewer than 3 products are compared', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(detail())

    const wrapper = mountWithPlugins(CompareModal)
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Loading details…'))
    expect(wrapper.text()).toContain('Add a product to compare')
  })

  it('emits close on the backdrop click, the header close button, and a per-item remove', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(detail())

    const wrapper = mountWithPlugins(CompareModal)
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Loading details…'))

    await wrapper.get('[aria-label="Close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.findAll('button').find(b => b.text() === 'Remove')!.trigger('click')
    expect(compare.items).toHaveLength(0)
  })
})

describe('CompareModal — fallbacks', () => {
  it('falls back to the raw property key when no label is provided', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(detail({
      property_values: [{ property: { key: 'material', default_info: null }, default_info: { value: 'Oak' } }] as never,
    }))
    const wrapper = mountWithPlugins(CompareModal)
    await vi.waitFor(() => expect(wrapper.text()).toContain('material'))
    expect(wrapper.text()).toContain('Oak')
  })

  it('skips products whose detail fetch returned null when collecting property keys', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    compare.toggle(product(2))
    vi.spyOn(conciarApi.products, 'getDetail').mockImplementation(async (id: string) =>
      id === '1' ? detail({ property_values: [{ property: { key: 'color', default_info: { label: 'Color' } }, default_info: { value: 'Red' } }] as never }) : Promise.reject(new Error('gone')),
    )
    const wrapper = mountWithPlugins(CompareModal)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Color'))
    expect(wrapper.text()).toContain('Red')
  })

  it('shows an image, a fallback name, and a dash price for items lacking data', async () => {
    const compare = useCompareStore()
    compare.toggle({ id: 5, files: [{ url: 'https://example.com/a.jpg', type: { name: 'image' } }] } as never)
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(detail())
    const wrapper = mountWithPlugins(CompareModal)
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Loading details…'))
    expect(wrapper.find('img').attributes('src')).toBe('https://example.com/a.jpg')
    expect(wrapper.text()).toContain('Product 5')
    expect(wrapper.text()).toContain('–')
  })

  it('hides the empty add-slot column once three products are compared', async () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    compare.toggle(product(2))
    compare.toggle(product(3))
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(detail())
    const wrapper = mountWithPlugins(CompareModal)
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Loading details…'))
    expect(wrapper.text()).not.toContain('Add a product to compare')
  })
})
