import { ref, computed } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useStoreConfigStore } from '@/stores/storeConfig'

/**
 * Coupon field state shared by the cart and checkout. Applying/removing goes
 * through the existing cart-sync flow (cart.applyCoupons) with the full
 * declarative set of codes; applied state is always read back from
 * cart.appliedCoupons, never kept local-only.
 *
 * Stacking is gated up front by config.couponsStackable (the 422 is the
 * server-side backstop). A bad code only fails that sync — already-applied
 * coupons stay intact because the whole sync is rejected as a unit.
 */
export function useCoupon(fallbackError = 'Invalid or expired coupon code.') {
  const cart = useCartStore()
  const storeConfig = useStoreConfigStore()

  const code = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  const stackable = computed(() => storeConfig.couponsStackable)
  const appliedCodes = computed(() => cart.appliedCoupons.map(c => c.code))

  async function apply() {
    const value = code.value.trim()
    if (!value || loading.value) return

    // Skip if already applied (codes are case-insensitive server-side).
    const upper = value.toUpperCase()
    if (appliedCodes.value.some(c => c.toUpperCase() === upper)) {
      code.value = ''
      return
    }

    // Stacking gate up front: when on, add to the set; when off, replace.
    const next = stackable.value ? [...appliedCodes.value, value] : [value]

    loading.value = true
    error.value = null
    try {
      await cart.applyCoupons(next)
      // Success: the rejected-as-a-unit contract means the code is now applied.
      code.value = ''
    } catch (e: any) {
      // Surface the server's 422 message (names the offending code) inline.
      error.value = (e?.status === 422 && e?.body?.message) ? e.body.message : fallbackError
    } finally {
      loading.value = false
    }
  }

  // Re-sync the set without `target` — declarative removal of a single coupon.
  async function remove(target: string) {
    error.value = null
    const next = appliedCodes.value.filter(c => c.toUpperCase() !== target.toUpperCase())
    try {
      await cart.applyCoupons(next)
    } catch {
      // Removal is best-effort — don't block the user.
    }
  }

  return { code, loading, error, stackable, apply, remove }
}
