import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from './cart'
import { conciarApi } from '@/api/conciar'
import type { Product } from '@/types'
import type { ConciarCartData } from '@/api/conciar-types'

const productA: Product = { id: '1', name: 'Product A', price: 10, image: '' }
const productB: Product = { id: '2', name: 'Product B', price: 25, image: '' }

const cartData = (over: Partial<ConciarCartData> = {}): ConciarCartData =>
  ({ items: [], coupons: [], totals: null, ...over }) as ConciarCartData

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.restoreAllMocks()
})

describe('cart line management', () => {
  it('adds an item as a new line and counts quantity', () => {
    const cart = useCartStore()
    cart.add(productA, 'product')
    expect(cart.items).toHaveLength(1)
    expect(cart.count).toBe(1)
  })

  it('increments quantity when the same id + type is added again', () => {
    const cart = useCartStore()
    cart.add(productA, 'product')
    cart.add(productA, 'product')
    expect(cart.items).toHaveLength(1)
    expect(cart.count).toBe(2)
  })

  it('keeps a subscription and a one-time purchase of the same product as separate lines', () => {
    const cart = useCartStore()
    cart.add(productA, 'product')
    cart.add(productA, 'subscription')
    expect(cart.items).toHaveLength(2)
    expect(cart.count).toBe(2)
  })

  it('updateQty sets the quantity, and a quantity of 0 removes the line', () => {
    const cart = useCartStore()
    cart.add(productA, 'product')
    cart.updateQty('1', 5, 'product')
    expect(cart.count).toBe(5)
    cart.updateQty('1', 0, 'product')
    expect(cart.items).toHaveLength(0)
  })

  it('remove drops the matching line', () => {
    const cart = useCartStore()
    cart.add(productA, 'product')
    cart.add(productB, 'product')
    cart.remove('1', 'product')
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].id).toBe('2')
  })

  it('clear empties items, coupons and totals', () => {
    const cart = useCartStore()
    cart.add(productA, 'product')
    cart.appliedCoupons = [{ code: 'X', discount_percentage: 10 }] as never
    cart.clear()
    expect(cart.items).toHaveLength(0)
    expect(cart.appliedCoupons).toHaveLength(0)
    expect(cart.totals).toBeNull()
  })
})

describe('cart money computeds', () => {
  it('falls back to a local subtotal sum when the server has not synced totals', () => {
    const cart = useCartStore()
    cart.add(productA, 'product') // 10
    cart.add(productB, 'product') // 25
    cart.updateQty('2', 2, 'product') // 25 * 2
    expect(cart.subtotal).toBe(60)
  })

  it('estimates a percentage discount locally until the server total lands', () => {
    const cart = useCartStore()
    cart.add(productB, 'product') // 25
    cart.updateQty('2', 4, 'product') // subtotal 100
    cart.appliedCoupons = [{ code: 'SAVE10', discount_percentage: 10 }] as never
    expect(cart.subtotal).toBe(100)
    expect(cart.discountAmount).toBe(10)
    expect(cart.total).toBe(90)
  })

  it('prefers the authoritative server totals when present', () => {
    const cart = useCartStore()
    cart.add(productA, 'product') // local sum would be 10
    cart.totals = { subtotal: 50, discount: 5, total: 45 } as never
    expect(cart.subtotal).toBe(50)
    expect(cart.discountAmount).toBe(5)
    expect(cart.total).toBe(45)
  })

  it('never lets the preview total go negative', () => {
    const cart = useCartStore()
    cart.add(productA, 'product') // 10
    cart.appliedCoupons = [{ code: 'BIG', discount_percentage: 200 }] as never
    expect(cart.total).toBe(0)
  })

  it('formatMoney delegates to the money util, defaulting to euro formatting', () => {
    const cart = useCartStore()
    expect(cart.formatMoney(12.5)).toBe('€ 12,50')
  })
})

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('cart — no-op sync when API is not configured', () => {
  it('add/remove/clear/updateQty do not call the API when VITE_CONCIAR_API_URL is unset', async () => {
    const sync = vi.spyOn(conciarApi.cart, 'sync')
    const cart = useCartStore()
    cart.add(productA, 'product')
    cart.updateQty('1', 2)
    cart.remove('1')
    cart.clear()
    await flush()
    expect(sync).not.toHaveBeenCalled()
  })
})

describe('cart — API-backed sync', () => {
  beforeEach(() => vi.stubEnv('VITE_CONCIAR_API_URL', 'https://api.test'))
  afterEach(() => vi.unstubAllEnvs())

  it('ensureToken reuses an existing token without calling the API', async () => {
    localStorage.setItem('cart_token', 'existing-token')
    const init = vi.spyOn(conciarApi.cart, 'init')
    vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData())
    const cart = useCartStore()
    cart.add(productA, 'product')
    await flush()
    expect(init).not.toHaveBeenCalled()
    expect(cart.cartToken).toBe('existing-token')
  })

  it('ensureToken initializes and persists a new token when none exists', async () => {
    vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'new-token' } as never)
    vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData())
    const cart = useCartStore()
    cart.add(productA, 'product')
    await flush()
    await flush()
    expect(cart.cartToken).toBe('new-token')
    expect(localStorage.getItem('cart_token')).toBe('new-token')
  })

  it('syncToApi swallows errors (fire-and-forget)', async () => {
    vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'tok' } as never)
    vi.spyOn(conciarApi.cart, 'sync').mockRejectedValue(new Error('network down'))
    const cart = useCartStore()
    expect(() => cart.add(productA, 'product')).not.toThrow()
    await flush()
    await flush()
  })

  it('applyCartResult maps currency and server-confirmed prices onto local items', async () => {
    vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'tok' } as never)
    vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData({
      items: [{
        product_id: 1,
        price_at_added: {
          amount: '9.99',
          converted_price: { amount: 8.5 },
          currency: { symbol_icon: '$', decimal_places: 2, decimal_separator: '.', thousand_separator: ',' },
        },
      }] as never,
      totals: { subtotal: 8.5, discount: 0, total: 8.5 } as never,
    }))
    const cart = useCartStore()
    cart.add(productA, 'product')
    await flush()
    await flush()
    expect(cart.items[0].price).toBe(8.5)
    expect(cart.formatMoney(8.5)).toContain('8.50')
  })

  it('linkCustomer syncs the cart with the given organization_customer_id', async () => {
    vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'tok' } as never)
    const sync = vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData())
    const cart = useCartStore()
    await cart.linkCustomer(42)
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ organization_customer_id: 42 }))
  })

  it('clearToken resets the token and removes it from storage', () => {
    localStorage.setItem('cart_token', 'tok')
    const cart = useCartStore()
    cart.clearToken()
    expect(cart.cartToken).toBeNull()
    expect(localStorage.getItem('cart_token')).toBeNull()
  })

  describe('applyCoupons', () => {
    it('replaces coupons on success', async () => {
      localStorage.setItem('cart_token', 'tok')
      vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData({ coupons: [{ code: 'SAVE10' }] as never }))
      const cart = useCartStore()
      await cart.applyCoupons(['SAVE10'])
      expect(cart.appliedCoupons).toEqual([{ code: 'SAVE10' }])
    })

    it('re-inits the cart and retries once on a 404 (expired/converted token)', async () => {
      localStorage.setItem('cart_token', 'expired-tok')
      const err = Object.assign(new Error('gone'), { status: 404 })
      vi.spyOn(conciarApi.cart, 'sync')
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce(cartData({ coupons: [{ code: 'SAVE10' }] as never }))
      vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'fresh-tok' } as never)
      const cart = useCartStore()
      await cart.applyCoupons(['SAVE10'])
      expect(cart.cartToken).toBe('fresh-tok')
      expect(cart.appliedCoupons).toEqual([{ code: 'SAVE10' }])
    })

    it('rethrows non-404 errors (e.g. invalid coupon code) without touching the token', async () => {
      localStorage.setItem('cart_token', 'tok')
      const err = Object.assign(new Error('Invalid code'), { status: 422 })
      vi.spyOn(conciarApi.cart, 'sync').mockRejectedValue(err)
      const cart = useCartStore()
      await expect(cart.applyCoupons(['BAD'])).rejects.toBe(err)
      expect(cart.cartToken).toBe('tok')
    })
  })

  describe('init', () => {
    it('with no stored token, initializes a fresh cart via syncToApi', async () => {
      vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'new-tok' } as never)
      vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData())
      const cart = useCartStore()
      await cart.init()
      expect(cart.cartToken).toBe('new-tok')
    })

    it('with a stored token, restores the cart via GET then re-syncs local items', async () => {
      localStorage.setItem('cart_token', 'existing-tok')
      const restored = cartData({
        coupons: [{ code: 'X' }] as never,
        totals: { subtotal: 1, discount: 0, total: 1 } as never,
      })
      vi.spyOn(conciarApi.cart, 'get').mockResolvedValue(restored)
      // The follow-up sync echoes back the same server-confirmed coupons/totals.
      vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(restored)
      const cart = useCartStore()
      await cart.init()
      expect(cart.cartToken).toBe('existing-tok')
      expect(cart.appliedCoupons).toEqual([{ code: 'X' }])
    })

    it('clears an expired (404) token and starts a fresh cart', async () => {
      localStorage.setItem('cart_token', 'expired-tok')
      vi.spyOn(conciarApi.cart, 'get').mockRejectedValue(new Error('Conciar API 404: /store/cart/expired-tok'))
      vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'new-tok' } as never)
      vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData())
      const cart = useCartStore()
      await cart.init()
      expect(cart.cartToken).toBe('new-tok')
    })

    it('on a non-404 GET failure, keeps the token and still re-syncs', async () => {
      localStorage.setItem('cart_token', 'existing-tok')
      vi.spyOn(conciarApi.cart, 'get').mockRejectedValue(new Error('network error'))
      vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'existing-tok' } as never)
      vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData())
      const cart = useCartStore()
      await cart.init()
      expect(localStorage.getItem('cart_token')).toBe('existing-tok')
    })

    it('defaults coupons/totals to empty when the GET response omits them', async () => {
      localStorage.setItem('cart_token', 'existing-tok')
      vi.spyOn(conciarApi.cart, 'get').mockResolvedValue({ items: [] } as never)
      vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData())
      const cart = useCartStore()
      await cart.init()
      expect(cart.appliedCoupons).toEqual([])
      expect(cart.totals).toBeNull()
    })
  })
})

describe('cart — localStorage hydration', () => {
  it('hydrates items from a pre-existing shop_cart entry', () => {
    localStorage.setItem('shop_cart', JSON.stringify([{ id: '1', type: 'product', product: productA, quantity: 2, price: 10 }]))
    const cart = useCartStore()
    expect(cart.items).toHaveLength(1)
    expect(cart.count).toBe(2)
  })
})

describe('cart — applyCartResult details', () => {
  beforeEach(() => vi.stubEnv('VITE_CONCIAR_API_URL', 'https://api.test'))
  afterEach(() => vi.unstubAllEnvs())

  it('a coupon with no discount_percentage contributes nothing to the local estimate', () => {
    const cart = useCartStore()
    cart.add(productA, 'product') // 10
    cart.appliedCoupons = [{ code: 'FIXED', discount_percentage: null }] as never
    expect(cart.discountAmount).toBe(0)
    expect(cart.total).toBe(10)
  })

  it('defaults currency decimal fields when the API omits them', async () => {
    vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'tok' } as never)
    vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData({
      items: [{ product_id: 1, price_at_added: { amount: '9.99', currency: { symbol_icon: '$' } } }] as never,
    }))
    const cart = useCartStore()
    cart.add(productA, 'product')
    await flush()
    expect(cart.formatMoney(9.99)).toBe('$ 9,99') // decimal_separator defaults to ','
  })

  it('falls back to parseFloat(amount) when there is no converted_price', async () => {
    vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'tok' } as never)
    vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData({
      items: [{ product_id: 1, price_at_added: { amount: '12.34', currency: { symbol_icon: '€' } } }] as never,
    }))
    const cart = useCartStore()
    cart.add(productA, 'product')
    await flush()
    expect(cart.items[0].price).toBe(12.34)
  })

  it('syncs a subscription item with a variantId through toSyncItems (remove path)', async () => {
    vi.spyOn(conciarApi.cart, 'init').mockResolvedValue({ cart_token: 'tok' } as never)
    const sync = vi.spyOn(conciarApi.cart, 'sync').mockResolvedValue(cartData())
    const cart = useCartStore()
    cart.add({ ...productA, variantId: '99' } as never, 'subscription')
    await flush()
    cart.remove(productA.id, 'subscription')
    await flush()
    expect(sync).toHaveBeenLastCalledWith(expect.objectContaining({
      items: expect.arrayContaining([expect.objectContaining({ product_variant_id: 99, purchase_type: 'subscription' })]),
    }))
  })
})
