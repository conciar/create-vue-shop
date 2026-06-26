import { describe, it, expect } from 'vitest'
import { mapProduct } from './conciar'
import type { ConciarProduct } from './conciar-types'

// Minimal ConciarProduct factory — only the fields mapProduct reads are set;
// cast through `unknown` so we don't have to populate the full (large) type.
function product(over: Record<string, unknown> = {}): ConciarProduct {
  return {
    id: 1,
    is_subscription: false,
    default_info: { name: 'Item', description: null },
    resolved_info: null,
    variants: [],
    retail_price: null,
    converted_retail_price: null,
    compare_price: null,
    converted_compare_price: null,
    subscription_detail: null,
    ...over,
  } as unknown as ConciarProduct
}

const conv = (amount: number) => ({ amount, display_price: '', currency: {} })
const retail = (amount: string) => ({ id: 1, amount, display_price: '', currency: {} })

describe('mapProduct — price resolution precedence', () => {
  it('uses the product converted_retail_price when there is no variant', () => {
    expect(mapProduct(product({ converted_retail_price: conv(25) })).price).toBe(25)
  })

  it('prefers the active variant converted price over the product price', () => {
    const p = product({
      variants: [{ id: 9, active: true, converted_retail_price: conv(30) }],
      converted_retail_price: conv(25),
    })
    const box = mapProduct(p)
    expect(box.price).toBe(30)
    expect(box.variantId).toBe('9')
  })

  it('falls back to the variant raw retail_price (parsed) when no converted price', () => {
    const p = product({
      variants: [{ id: 9, active: true, converted_retail_price: null, retail_price: retail('19.50') }],
    })
    expect(mapProduct(p).price).toBe(19.5)
  })

  it('falls back to the product raw retail_price when nothing else is present', () => {
    expect(mapProduct(product({ retail_price: retail('12.00') })).price).toBe(12)
  })

  it('defaults to 0 when no price is available', () => {
    expect(mapProduct(product()).price).toBe(0)
  })

  it('ignores an inactive variant when resolving price', () => {
    const p = product({
      variants: [{ id: 9, active: false, converted_retail_price: conv(30) }],
      converted_retail_price: conv(25),
    })
    const box = mapProduct(p)
    expect(box.price).toBe(25)
    expect(box.variantId).toBeUndefined()
  })
})

describe('mapProduct — compare price → originalPrice', () => {
  it('shows originalPrice only when the compare price is strictly greater', () => {
    expect(mapProduct(product({ converted_retail_price: conv(20), converted_compare_price: conv(30) })).originalPrice).toBe(30)
  })

  it('omits originalPrice when the compare price is not above the selling price', () => {
    expect(mapProduct(product({ converted_retail_price: conv(20), converted_compare_price: conv(15) })).originalPrice).toBeUndefined()
    expect(mapProduct(product({ converted_retail_price: conv(20), converted_compare_price: conv(20) })).originalPrice).toBeUndefined()
  })
})

describe('mapProduct — subscription frequency + misc', () => {
  it('maps a quarterly billing cycle, and everything else to monthly', () => {
    expect(mapProduct(product({ subscription_detail: { billing_cycle_unit: 'quarterly' } })).frequency).toBe('quarterly')
    expect(mapProduct(product({ subscription_detail: { billing_cycle_unit: 'four_weekly' } })).frequency).toBe('monthly')
  })

  it('defaults frequency to monthly when not a subscription', () => {
    expect(mapProduct(product()).frequency).toBe('monthly')
  })

  it('passes through id and isSubscription', () => {
    const box = mapProduct(product({ id: 42, is_subscription: true }))
    expect(box.id).toBe('42')
    expect(box.isSubscription).toBe(true)
  })
})
