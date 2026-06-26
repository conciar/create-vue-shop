// Currency-aware money formatting that mirrors the API's display_price style
// (e.g. "€ 1.234,56"). Pass any currency-like object (converted_retail_price /
// tax / cart currency all carry these fields); falls back to euro defaults.
export interface MoneyCurrency {
  symbol_icon?: string
  decimal_places?: number
  decimal_separator?: string
  thousand_separator?: string
}

export function formatMoney(amount: number, currency?: MoneyCurrency | null): string {
  const places = currency?.decimal_places ?? 2
  const symbol = currency?.symbol_icon ?? '€'
  const dec = currency?.decimal_separator ?? ','
  const thou = currency?.thousand_separator ?? '.'
  const [intPart, frac] = Math.abs(amount).toFixed(places).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thou)
  const body = frac != null ? `${grouped}${dec}${frac}` : grouped
  return `${symbol} ${body}`
}

// A compare_price ("was"/RRP) price-like object, as returned alongside the
// selling price (use the currency-converted variant so it matches the displayed
// price). amount is a major-unit number.
export interface ComparePriceLike {
  amount: number
  currency?: MoneyCurrency | null
}

export interface DiscountDisplay {
  was: string         // formatted strike-through reference price, e.g. "€ 24,99"
  percentOff: number  // rounded whole-percent saving, e.g. 30
}

// Derives the strike-through + "% off" display from a compare_price, or null
// when no discount should be shown. A discount is shown ONLY when a compare
// price exists AND it is strictly greater than the selling price — guarding
// against a stale compare price that's ≤ what the customer actually pays.
// compare_price is a display reference only; it is never charged or totalled.
export function discountDisplay(
  sellingPrice: number,
  compare?: ComparePriceLike | null,
): DiscountDisplay | null {
  if (!compare || compare.amount <= sellingPrice) return null
  return {
    was: formatMoney(compare.amount, compare.currency),
    percentOff: Math.round(((compare.amount - sellingPrice) / compare.amount) * 100),
  }
}
