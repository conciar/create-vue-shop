import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mountWithPlugins } from '@/test-support/mount'
import ProductCard from './ProductCard.vue'
import { useCartStore } from '@/stores/cart'
import { useCompareStore } from '@/stores/compare'
import type { ConciarConnectProduct } from '@/api/conciar-types'

const product = (over: Partial<ConciarConnectProduct> = {}): ConciarConnectProduct => ({
  id: 1,
  sku: null,
  active: true,
  out_of_stock: false,
  is_subscription: false,
  is_one_time_purchase: true,
  subscription_detail: null,
  resolved_info: { name: 'Sample Wine', description: '' },
  converted_retail_price: { amount: 25, display_price: '€ 25,00', currency: { symbol: 'EUR', symbol_icon: '€' } },
  converted_compare_price: null,
  files: [],
  properties: {},
  ...over,
} as unknown as ConciarConnectProduct)

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('ProductCard — basic rendering', () => {
  it('renders the product name and price', () => {
    const wrapper = mountWithPlugins(ProductCard, { props: { product: product() } })
    expect(wrapper.text()).toContain('Sample Wine')
    expect(wrapper.text()).toContain('€ 25,00')
  })

  it('links to the product detail page with a slugified name', () => {
    const wrapper = mountWithPlugins(ProductCard, { props: { product: product({ id: 7, resolved_info: { name: 'Nice Red Wine!', description: '' } }) } })
    const link = wrapper.findAll('a').find(a => a.attributes('href')?.startsWith('/product/7/'))
    expect(link?.attributes('href')).toBe('/product/7/nice-red-wine')
  })

  it('shows a placeholder icon when there is no image', () => {
    const wrapper = mountWithPlugins(ProductCard, { props: { product: product() } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('shows the product image when a file is present', () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: { product: product({ files: [{ url: 'https://example.com/a.jpg', type: { name: 'image' } }] as never }) },
    })
    expect(wrapper.find('img').attributes('src')).toBe('https://example.com/a.jpg')
  })

  it('shows an out-of-stock badge and hides the add-to-cart button', () => {
    const wrapper = mountWithPlugins(ProductCard, { props: { product: product({ out_of_stock: true }) } })
    expect(wrapper.text()).toContain('Out of stock')
    expect(wrapper.findAll('button').some(b => b.text() === 'Add to cart')).toBe(false)
  })

  it('shows a discount badge and struck-through price when a compare price is above selling price', () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: { product: product({ converted_compare_price: { amount: 50, display_price: '€ 50,00', currency: { symbol: 'EUR', symbol_icon: '€' } } }) },
    })
    expect(wrapper.text()).toContain('−50%')
    expect(wrapper.text()).toContain('€ 50,00')
  })

  it('shows a tax note when tax is present', () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: {
        product: product({
          tax: { tax_total: 4.2, currency: { symbol: 'EUR', symbol_icon: '€' }, components: [{ name: 'BTW' }] },
        } as never),
      },
    })
    expect(wrapper.text()).toContain('BTW')
  })
})

describe('ProductCard — add to cart', () => {
  it('adds a one-time product to the cart', async () => {
    const wrapper = mountWithPlugins(ProductCard, { props: { product: product() } })
    const cart = useCartStore()
    await wrapper.get('button').trigger('click')
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].type).toBe('product')
  })

  it('defaults to subscription purchase type when both are available', async () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: {
        product: product({
          is_subscription: true,
          is_one_time_purchase: true,
          subscription_detail: { billing_cycle_unit: 'monthly' } as never,
        }),
      },
    })
    const cart = useCartStore()
    await wrapper.findAll('button').find(b => b.text() === 'Add to cart')!.trigger('click')
    expect(cart.items[0].type).toBe('subscription')
  })

  it('switches to one-time purchase type via the toggle before adding to cart', async () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: {
        product: product({
          is_subscription: true,
          is_one_time_purchase: true,
          subscription_detail: { billing_cycle_unit: 'monthly' } as never,
        }),
      },
    })
    await wrapper.findAll('button').find(b => b.text() === 'Once')!.trigger('click')

    const cart = useCartStore()
    await wrapper.findAll('button').find(b => b.text() === 'Add to cart')!.trigger('click')
    expect(cart.items[0].type).toBe('product')
  })

  it('shows a plain billing interval badge for subscription-only products', () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: {
        product: product({
          is_subscription: true,
          is_one_time_purchase: false,
          subscription_detail: { billing_cycle_unit: 'quarterly' } as never,
        }),
      },
    })
    expect(wrapper.text()).toContain('Quarterly')
  })
})

describe('ProductCard — compare', () => {
  it('hides the compare toggle when the product has no comparable properties', () => {
    const wrapper = mountWithPlugins(ProductCard, { props: { product: product() } })
    expect(wrapper.text()).not.toContain('Compare')
  })

  it('shows the compare toggle when the product has properties, and toggles selection', async () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: { product: product({ properties: { color: 'red' } }) },
    })
    const compareButton = wrapper.findAll('button').find(b => b.text().includes('Compare'))!
    const compare = useCompareStore()

    await compareButton.trigger('click')
    expect(compare.isSelected(1)).toBe(true)
    expect(wrapper.text()).toContain('Added to compare')

    await wrapper.findAll('button').find(b => b.text().includes('Added to compare'))!.trigger('click')
    expect(compare.isSelected(1)).toBe(false)
  })

  it('disables the compare toggle once the comparison list is full', async () => {
    const compare = useCompareStore()
    compare.toggle({ id: 101 } as never)
    compare.toggle({ id: 102 } as never)
    compare.toggle({ id: 103 } as never)

    const wrapper = mountWithPlugins(ProductCard, {
      props: { product: product({ id: 999, properties: { color: 'red' } }) },
    })
    expect(wrapper.get('button[disabled]').text()).toContain('Compare')
  })

  it('treats property_values with a default_info.value as comparable too', () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: { product: product({ property_values: [{ default_info: { value: 'Large' } }] } as never) },
    })
    expect(wrapper.text()).toContain('Compare')
  })
})

describe('ProductCard — fallbacks', () => {
  it('falls back to "Product {id}" when there is no resolved name', () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: { product: product({ id: 77, resolved_info: null } as never) },
    })
    expect(wrapper.text()).toContain('Product 77')
  })

  it('hides the price and SKU rows when neither is present', () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: { product: product({ sku: null, converted_retail_price: null }) },
    })
    expect(wrapper.text()).not.toContain('€')
  })

  it('renders a tax note without component labels when the tax has no components', () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: { product: product({ tax: { tax_total: 3, currency: { symbol: 'EUR', symbol_icon: '€' }, components: [] } } as never) },
    })
    expect(wrapper.text()).toContain('Incl.')
  })

  it('humanizes an unrecognized billing cycle unit', () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: {
        product: product({
          is_subscription: true, is_one_time_purchase: false,
          subscription_detail: { billing_cycle_unit: 'every_other_week' } as never,
        }),
      },
    })
    expect(wrapper.text()).toContain('every other week')
  })

  it('adds a subscription-only product with a zero price fallback and no image', async () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: {
        product: product({
          is_subscription: true, is_one_time_purchase: false,
          converted_retail_price: null, files: [],
          resolved_info: { name: 'Sub Box', description: null },
          subscription_detail: { billing_cycle_unit: 'quarterly' } as never,
        }),
      },
    })
    const cart = useCartStore()
    await wrapper.findAll('button').find(b => b.text() === 'Add to cart')!.trigger('click')
    expect(cart.items[0].price).toBe(0)
    expect(cart.items[0].product.image).toBe('')
    expect((cart.items[0].product as never as { frequency: string }).frequency).toBe('quarterly')
  })

  it('shows the SKU when present', () => {
    const wrapper = mountWithPlugins(ProductCard, {
      props: { product: product({ sku: 'SKU-9' }) },
    })
    expect(wrapper.text()).toContain('SKU-9')
  })
})
