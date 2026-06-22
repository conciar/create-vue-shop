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
