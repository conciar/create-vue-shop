import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from './cart'
import type { Product } from '@/types'

const productA: Product = { id: '1', name: 'Product A', price: 10, image: '' }
const productB: Product = { id: '2', name: 'Product B', price: 25, image: '' }

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
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
})
