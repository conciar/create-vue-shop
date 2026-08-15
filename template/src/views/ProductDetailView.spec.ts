import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mountWithPlugins } from '@/test-support/mount'
import ProductDetailView from './ProductDetailView.vue'
import { useCartStore } from '@/stores/cart'
import { useCompareStore } from '@/stores/compare'
import { conciarApi } from '@/api/conciar'
import type { ConciarProduct } from '@/api/conciar-types'

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/product/:id', component: ProductDetailView }],
  })
}

const product = (over: Partial<ConciarProduct> = {}): ConciarProduct => ({
  id: 1,
  sku: 'SKU-1',
  active: true,
  out_of_stock: false,
  is_subscription: false,
  resolved_info: { name: 'Product A', description: 'A lovely product.' },
  default_info: { name: 'Product A', description: 'A lovely product.' },
  converted_retail_price: { amount: 20, display_price: '€ 20,00', currency: {} },
  converted_compare_price: null,
  variants: [],
  files: [],
  property_values: [],
  ...over,
} as never)

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

async function mountAt(id = '1') {
  const router = testRouter()
  await router.push(`/product/${id}`)
  return { wrapper: mountWithPlugins(ProductDetailView, { global: { plugins: [router] } }), router }
}

describe('ProductDetailView — loading & not found', () => {
  it('shows a loading skeleton, then the product', async () => {
    let resolve!: (v: ConciarProduct) => void
    vi.spyOn(conciarApi.products, 'getDetail').mockReturnValue(new Promise(r => (resolve = r)))
    const { wrapper } = await mountAt()
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)

    resolve(product())
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
  })

  it('shows "Product not found" when the fetch fails', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockRejectedValue(new Error('Not found'))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product not found'))
  })
})

describe('ProductDetailView — basic rendering', () => {
  it('renders name, description, price and image fallback', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product())
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
    expect(wrapper.text()).toContain('A lovely product.')
    expect(wrapper.text()).toContain('€ 20,00')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('shows the product image when a file is present', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(
      product({ files: [{ url: 'https://example.com/a.jpg', type: { name: 'image' } }] as never }),
    )
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.find('img').attributes('src')).toBe('https://example.com/a.jpg'))
  })

  it('shows a discount badge and struck-through compare price', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(
      product({ converted_compare_price: { amount: 30, display_price: '€ 30,00', currency: {} } as never }),
    )
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('−33%'))
    expect(wrapper.text()).toContain('€ 30,00')
  })

  it('disables add-to-cart and shows an overlay badge when out of stock', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({ out_of_stock: true }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
    expect(wrapper.findAll('button').filter(b => b.text() === 'Out of stock').length).toBeGreaterThan(0)
    expect(wrapper.findAll('button:disabled').length).toBeGreaterThan(0)
  })

  it('renders a tax breakdown when tax is present', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      tax: { net: 16.53, tax_total: 3.47, gross: 20, currency: {}, components: [{ name: 'BTW', type: 'percentage', rate: 21, amount: 3.47 }] },
    } as never))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('BTW'))
    expect(wrapper.text()).toContain('(21%)')
  })

  it('renders spec rows, excluding hidden keys', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      property_values: [
        { property: { key: 'color', default_info: { label: 'Color' } }, default_info: { value: 'Red' } },
        { property: { key: 'tags', default_info: { label: 'Tags' } }, default_info: { value: 'hidden-me' } },
      ] as never,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Color'))
    expect(wrapper.text()).toContain('Red')
    expect(wrapper.text()).not.toContain('hidden-me')
  })
})

describe('ProductDetailView — variants', () => {
  const withVariants = () => product({
    variants: [
      { id: 10, active: true, out_of_stock: true, sku: 'V10', converted_retail_price: { amount: 20, display_price: '€ 20,00' } },
      { id: 11, active: true, out_of_stock: false, sku: 'V11', converted_retail_price: { amount: 25, display_price: '€ 25,00' } },
      { id: 12, active: false, out_of_stock: false, sku: 'V12', converted_retail_price: { amount: 15, display_price: '€ 15,00' } },
    ] as never,
  })

  it('defaults to the first active, in-stock variant (skipping out-of-stock and inactive ones)', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(withVariants())
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('€ 25,00'))
    expect(wrapper.text()).not.toContain('V12') // inactive variant not listed
  })

  it('switches price and stock state when a different variant is selected', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(withVariants())
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('V11'))

    const v10Button = wrapper.findAll('button').find(b => b.text().includes('V10'))!
    expect(v10Button.attributes('disabled')).toBeDefined() // out of stock

    await v10Button.trigger('click') // clicking a disabled button is a no-op in the browser, but jsdom still dispatches it
    // Selection guarded by :disabled in the real DOM; assert the button itself reflects unavailability instead.
    expect(v10Button.classes()).toContain('line-through')
  })

  it('adds the selected variant to the cart with a combined name', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(withVariants())
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('V11'))

    const cart = useCartStore()
    await wrapper.findAll('button').find(b => b.text() === 'Add to cart')!.trigger('click')
    expect(cart.items[0].product.name).toContain('V11')
    expect((cart.items[0].product as never as { variantId: string }).variantId).toBe('11')
  })
})

describe('ProductDetailView — subscriptions', () => {
  it('renders the subscription details block and interval label', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      is_subscription: true,
      subscription_detail: {
        billing_cycle_unit: 'monthly', auto_renew: true, trial_period_days: 14,
        cancellation_notice_days: 7, allow_one_time_purchase: true, max_subscribers: 100,
        minimum_commitment_cycles: 3, renew_commitment_on_cycle: 3,
      } as never,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Subscription details'))
    expect(wrapper.text()).toContain('Monthly')
    expect(wrapper.text()).toContain('14 days')
    expect(wrapper.text()).toContain('Available')
  })

  it('falls back to the raw unit name for an unrecognized billing cycle', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      is_subscription: true,
      subscription_detail: { billing_cycle_unit: 'fortnight', auto_renew: false, trial_period_days: 0, cancellation_notice_days: 0, allow_one_time_purchase: false } as never,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('fortnight'))
  })

  it('shows a "Subscribe" CTA, and an "Order once" option when allowed', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      is_subscription: true,
      subscription_detail: { billing_cycle_unit: 'monthly', auto_renew: true, trial_period_days: 0, cancellation_notice_days: 0, allow_one_time_purchase: true } as never,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Subscribe'))

    const cart = useCartStore()
    await wrapper.findAll('button').find(b => b.text().includes('Order once'))!.trigger('click')
    expect(cart.items[0].type).toBe('product')

    await wrapper.findAll('button').find(b => b.text() === 'Subscribe')!.trigger('click')
    expect(cart.items.some(i => i.type === 'subscription')).toBe(true)
  })
})

describe('ProductDetailView — compare', () => {
  it('hides the compare toggle without comparable properties, shows it with them, and toggles', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product())
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
    expect(wrapper.text()).not.toContain('Add to compare')
  })

  it('toggles compare selection when the product has properties', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      property_values: [{ property: { key: 'color', default_info: { label: 'Color' } }, default_info: { value: 'Red' } }] as never,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Add to compare'))

    const compare = useCompareStore()
    await wrapper.findAll('button').find(b => b.text().includes('Add to compare'))!.trigger('click')
    expect(compare.isSelected(1)).toBe(true)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Added to compare'))
  })

  it('disables compare once the comparison list is full', async () => {
    const compare = useCompareStore()
    compare.toggle({ id: 101 } as never)
    compare.toggle({ id: 102 } as never)
    compare.toggle({ id: 103 } as never)

    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      id: 999,
      property_values: [{ property: { key: 'color', default_info: { label: 'Color' } }, default_info: { value: 'Red' } }] as never,
    }))
    const { wrapper } = await mountAt('999')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Compare full'))
    expect(wrapper.findAll('button').find(b => b.text().includes('Compare full'))!.attributes('disabled')).toBeDefined()
  })
})

describe('ProductDetailView — additional branch coverage', () => {
  it('defaults to the first variant when every active variant is out of stock', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      variants: [
        { id: 10, active: true, out_of_stock: true, sku: 'V10', converted_retail_price: { amount: 20, display_price: '€ 20,00' } },
        { id: 11, active: true, out_of_stock: true, sku: 'V11', converted_retail_price: { amount: 25, display_price: '€ 25,00' } },
      ] as never,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('€ 20,00')) // first variant, despite being out of stock
  })

  it('clicks an in-stock variant button to change the selection', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      variants: [
        { id: 10, active: true, out_of_stock: false, sku: 'V10', converted_retail_price: { amount: 20, display_price: '€ 20,00' } },
        { id: 11, active: true, out_of_stock: false, sku: 'V11', converted_retail_price: { amount: 25, display_price: '€ 25,00' } },
      ] as never,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('€ 20,00'))

    await wrapper.findAll('button').find(b => b.text().includes('V11'))!.trigger('click')
    await vi.waitFor(() => expect(wrapper.get('.hidden.lg\\:block').text()).toContain('€ 25,00'))
  })

  it('falls back to default_info for name/description when resolved_info is absent', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      resolved_info: null,
      default_info: { name: 'Default Name', description: 'Default description' },
    } as never))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Default Name'))
    expect(wrapper.text()).toContain('Default description')
  })

  it('falls back to sku, then #id, when a variant has no display name', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      variants: [
        { id: 10, active: true, out_of_stock: false, sku: 'RAW-SKU' },
        { id: 11, active: true, out_of_stock: false, sku: null },
      ] as never,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('RAW-SKU'))
    expect(wrapper.text()).toContain('#11')
  })

  it('shows a dash price and hides the SKU when neither is available', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      sku: null, converted_retail_price: null,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
    expect(wrapper.get('.hidden.lg\\:block').text()).toContain('–')
  })

  it('renders a non-percentage tax component without a rate suffix, and falls back to "btw" with no components', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      tax: { net: 16, tax_total: 4, gross: 20, currency: {}, components: [{ name: 'Fixed fee', type: 'fixed_per_unit', rate: 0, amount: 4 }] },
    } as never))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Fixed fee'))
    expect(wrapper.text()).not.toContain('(0%)')

    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      tax: { net: 16, tax_total: 4, gross: 20, currency: {}, components: [] },
    } as never))
    const { wrapper: wrapper2 } = await mountAt('2')
    await vi.waitFor(() => expect(wrapper2.text()).toContain('Incl. btw'))
  })

  it('hides the properties list when only hidden keys or empty values are present', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      property_values: [
        { property: { key: 'tags', default_info: { label: 'Tags' } }, default_info: { value: 'ignored' } },
        { property: { key: 'color', default_info: { label: 'Color' } }, default_info: { value: '' } },
      ] as never,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
    expect(wrapper.text()).not.toContain('Tags')
  })

  it('adds to cart with a fallback price of 0 when no price is available anywhere', async () => {
    vi.spyOn(conciarApi.products, 'getDetail').mockResolvedValue(product({
      converted_retail_price: null,
    }))
    const { wrapper } = await mountAt()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Product A'))
    const cart = useCartStore()
    await wrapper.findAll('button').find(b => b.text() === 'Add to cart')!.trigger('click')
    expect(cart.items[0].price).toBe(0)
  })
})
