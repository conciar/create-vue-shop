import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import type { CartItem, Product, SubscriptionBox } from '@/types'
import { conciarApi } from '@/api/conciar'
import { formatMoney as formatMoneyUtil } from '@/utils/money'
import type { ConciarCartCoupon, ConciarCartData, ConciarCartTotals } from '@/api/conciar-types'

type CartCurrency = { symbol_icon: string; decimal_places: number; decimal_separator: string; thousand_separator: string }

const TOKEN_KEY = 'cart_token'

export const useCartStore = defineStore('cart', () => {
  const cartToken = ref<string | null>(localStorage.getItem(TOKEN_KEY))

  const stored = localStorage.getItem('cellier_cart')
  const items = ref<CartItem[]>(stored ? JSON.parse(stored) : [])
  const isOpen = ref(false)
  const appliedCoupons = ref<ConciarCartCoupon[]>([])
  // Server-provided money summary (preview: excludes shipping/fees) and the
  // currency to format with, both captured from cart sync/get responses.
  const totals = ref<ConciarCartTotals | null>(null)
  const currency = ref<CartCurrency | null>(null)

  watch(items, val => localStorage.setItem('cellier_cart', JSON.stringify(val)), { deep: true })

  const count = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))
  // Local sum for instant feedback; the server confirms it via totals.subtotal.
  const subtotal = computed(() => totals.value?.subtotal ?? items.value.reduce((s, i) => s + i.price * i.quantity, 0))

  // Prefer the server total (authoritative, covers fixed-amount coupons). The
  // local percentage estimate is only a fallback before the first sync lands.
  const discountAmount = computed(() =>
    totals.value?.discount ?? appliedCoupons.value.reduce(
      (s, c) => c.discount_percentage != null ? s + subtotal.value * (c.discount_percentage / 100) : s,
      0,
    ),
  )

  // Preview total — subtotal − discount, excluding shipping/fees.
  const total = computed(() => totals.value?.total ?? Math.max(0, subtotal.value - discountAmount.value))

  // Server-computed free-shipping progress; null when there's no offer.
  const freeShipping = computed(() => totals.value?.free_shipping ?? null)

  // Format a numeric amount in the cart's currency (mirrors the API's
  // display_price style, e.g. "€ 1.234,56"); falls back to euro defaults.
  function formatMoney(amount: number): string {
    return formatMoneyUtil(amount, currency.value)
  }

  // ─── API sync ──────────────────────────────────────────────────────────────

  function toSyncItems() {
    return items.value.map(item => ({
      product_id: parseInt(item.id),
      product_variant_id: (item.product as SubscriptionBox).variantId
        ? parseInt((item.product as SubscriptionBox).variantId!)
        : null,
      quantity: item.quantity,
      purchase_type: item.type === 'subscription' ? 'subscription' as const : 'one_time' as const,
    }))
  }

  async function ensureToken(): Promise<string> {
    if (cartToken.value) return cartToken.value
    const { cart_token } = await conciarApi.cart.init()
    cartToken.value = cart_token
    localStorage.setItem(TOKEN_KEY, cart_token)
    return cart_token
  }

  // Reflect cart state from a sync/get response — coupons are server-confirmed,
  // never local-only. (Omitting coupon_codes in a sync leaves them unchanged.)
  function applyCartResult(result: ConciarCartData) {
    appliedCoupons.value = result.coupons ?? []
    totals.value = result.totals ?? null
    for (const apiItem of result.items) {
      // Capture currency formatting from the item prices (totals only has an id)
      const cur = apiItem.price_at_added?.currency
      if (cur) {
        currency.value = {
          symbol_icon: cur.symbol_icon,
          decimal_places: cur.decimal_places ?? 2,
          decimal_separator: cur.decimal_separator ?? ',',
          thousand_separator: cur.thousand_separator ?? '.',
        }
      }
      const local = items.value.find(i => parseInt(i.id) === apiItem.product_id)
      if (local && apiItem.price_at_added) {
        // `amount` is a major-unit decimal string (e.g. "59.99"), not cents.
        local.price = apiItem.price_at_added.converted_price?.amount
          ?? parseFloat(apiItem.price_at_added.amount)
      }
    }
  }

  async function syncToApi(extra?: {
    organization_customer_id?: number | null
    items?: ReturnType<typeof toSyncItems>
  }) {
    if (!import.meta.env.VITE_CONCIAR_API_URL) return
    try {
      const token = await ensureToken()
      const result = await conciarApi.cart.sync({
        cart_token: token,
        items: extra?.items !== undefined ? extra.items : toSyncItems(),
        ...extra,
      })
      applyCartResult(result)
    } catch {
      // fire-and-forget — don't block the UI
    }
  }

  async function init() {
    if (!import.meta.env.VITE_CONCIAR_API_URL) return

    const token = localStorage.getItem(TOKEN_KEY)

    if (!token) {
      // No token yet — init a new cart
      await syncToApi()
      return
    }

    try {
      const cart = await conciarApi.cart.get(token)
      cartToken.value = token
      appliedCoupons.value = cart.coupons ?? []
      totals.value = cart.totals ?? null
      // Restore succeeded — sync local items up (don't update prices from GET,
      // price_at_added has no currency conversion in this response)
      await syncToApi()
    } catch (e: any) {
      // Cart expired or converted to an order — start fresh
      if (String(e?.message).includes('404')) {
        cartToken.value = null
        localStorage.removeItem(TOKEN_KEY)
      }
      await syncToApi()
    }
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  function add(product: Product | SubscriptionBox, type: 'product' | 'subscription', interval?: string) {
    // Match on both id AND type so a subscription and a one-time purchase of the
    // same product are tracked as two distinct cart lines
    const existing = items.value.find(i => i.id === product.id && i.type === type)
    if (existing) {
      existing.quantity++
    } else {
      items.value = [...items.value, { id: product.id, type, product, quantity: 1, price: product.price, interval }]
    }
    isOpen.value = true
    syncToApi()
  }

  function remove(id: string, type?: 'product' | 'subscription') {
    const item = items.value.find(i => i.id === id && (!type || i.type === type))
    if (item) {
      syncToApi({
        items: [
          ...toSyncItems().filter(i => !(i.product_id === parseInt(id) && (!type || item.type === type))),
          {
            product_id: parseInt(id),
            product_variant_id: (item.product as SubscriptionBox).variantId
              ? parseInt((item.product as SubscriptionBox).variantId!)
              : null,
            quantity: 0,
            purchase_type: item.type === 'subscription' ? 'subscription' as const : 'one_time' as const,
          },
        ],
      })
    }
    items.value = items.value.filter(i => !(i.id === id && (!type || i.type === type)))
  }

  function updateQty(id: string, qty: number, type?: 'product' | 'subscription') {
    if (qty <= 0) return remove(id, type)
    const item = items.value.find(i => i.id === id && (!type || i.type === type))
    if (item) item.quantity = qty
    syncToApi()
  }

  function clear() {
    items.value = []
    appliedCoupons.value = []
    totals.value = null
    localStorage.removeItem('cellier_cart')
    syncToApi({ items: [] })
  }

  // Replace the cart's coupons with exactly `codes` (declarative — send the full
  // set; [] clears all). Unlike the fire-and-forget item syncs this rethrows so
  // the caller can surface the server's 422 (invalid code / stacking gate); the
  // whole sync is rejected as a unit on error, so already-applied coupons stay.
  async function applyCoupons(codes: string[]) {
    if (!import.meta.env.VITE_CONCIAR_API_URL) return
    try {
      const token = await ensureToken()
      applyCartResult(await conciarApi.cart.sync({
        cart_token: token,
        coupon_codes: codes,
        items: toSyncItems(),
      }))
    } catch (e: any) {
      // Cart token expired/converted — re-init the cart and retry once.
      if (e?.status === 404) {
        clearToken()
        const token = await ensureToken()
        applyCartResult(await conciarApi.cart.sync({
          cart_token: token,
          coupon_codes: codes,
          items: toSyncItems(),
        }))
        return
      }
      throw e
    }
  }

  async function linkCustomer(customerId: number) {
    await syncToApi({ organization_customer_id: customerId })
  }

  // Called after a successful order creation — the cart token is now permanently converted
  function clearToken() {
    cartToken.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return {
    items, isOpen, count, subtotal, discountAmount, total, totals, freeShipping, appliedCoupons, cartToken,
    formatMoney, add, remove, updateQty, clear, clearToken, applyCoupons, linkCustomer, init,
  }
})
