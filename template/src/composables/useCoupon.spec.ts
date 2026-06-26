import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCoupon } from './useCoupon'
import { useCartStore } from '@/stores/cart'
import { useStoreConfigStore } from '@/stores/storeConfig'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useCoupon — apply', () => {
  it('replaces the coupon set when stacking is off', async () => {
    const cart = useCartStore()
    const spy = vi.spyOn(cart, 'applyCoupons').mockResolvedValue(undefined)
    const coupon = useCoupon()
    coupon.code.value = 'SAVE10'
    await coupon.apply()
    expect(spy).toHaveBeenCalledWith(['SAVE10'])
    expect(coupon.code.value).toBe('')
  })

  it('appends to the existing set when stacking is on', async () => {
    const cart = useCartStore()
    const storeConfig = useStoreConfigStore()
    storeConfig.config = { couponsStackable: true } as never
    cart.appliedCoupons = [{ code: 'EXISTING' }] as never
    const spy = vi.spyOn(cart, 'applyCoupons').mockResolvedValue(undefined)
    const coupon = useCoupon()
    coupon.code.value = 'NEW'
    await coupon.apply()
    expect(spy).toHaveBeenCalledWith(['EXISTING', 'NEW'])
  })

  it('skips a code that is already applied (case-insensitive)', async () => {
    const cart = useCartStore()
    cart.appliedCoupons = [{ code: 'SAVE10' }] as never
    const spy = vi.spyOn(cart, 'applyCoupons').mockResolvedValue(undefined)
    const coupon = useCoupon()
    coupon.code.value = 'save10'
    await coupon.apply()
    expect(spy).not.toHaveBeenCalled()
    expect(coupon.code.value).toBe('')
  })

  it('surfaces the server 422 message', async () => {
    const cart = useCartStore()
    vi.spyOn(cart, 'applyCoupons').mockRejectedValue({ status: 422, body: { message: 'Coupon expired' } })
    const coupon = useCoupon('FB')
    coupon.code.value = 'NOPE'
    await coupon.apply()
    expect(coupon.error.value).toBe('Coupon expired')
  })

  it('falls back to the generic message on a non-422 error', async () => {
    const cart = useCartStore()
    vi.spyOn(cart, 'applyCoupons').mockRejectedValue(new Error('network'))
    const coupon = useCoupon('FB')
    coupon.code.value = 'NOPE'
    await coupon.apply()
    expect(coupon.error.value).toBe('FB')
  })
})

describe('useCoupon — remove', () => {
  it('re-syncs the set without the removed code', async () => {
    const cart = useCartStore()
    cart.appliedCoupons = [{ code: 'A' }, { code: 'B' }] as never
    const spy = vi.spyOn(cart, 'applyCoupons').mockResolvedValue(undefined)
    const coupon = useCoupon()
    await coupon.remove('A')
    expect(spy).toHaveBeenCalledWith(['B'])
  })

  it('surfaces an error instead of failing silently', async () => {
    const cart = useCartStore()
    cart.appliedCoupons = [{ code: 'A' }] as never
    vi.spyOn(cart, 'applyCoupons').mockRejectedValue(new Error('boom'))
    const coupon = useCoupon('FB')
    await coupon.remove('A')
    expect(coupon.error.value).toBe('FB')
  })
})
