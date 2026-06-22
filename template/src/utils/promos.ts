import type { ConciarPriceRule } from '@/api/conciar-types'

// Minimal translator signature so this util stays decoupled from vue-i18n's types.
type T = (key: string, named?: Record<string, unknown>) => string

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function localDate(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

function toMinutes(t?: string | null): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return Number.isNaN(h) ? null : h * 60 + (m || 0)
}

// Tokens that can represent "today" across the formats a merchant might use
// (0–6 index, 1–7 ISO, full name, 3-letter abbrev).
function todayTokens(now: Date): Set<string | number> {
  const d = now.getDay() // 0 = Sunday
  const name = DAY_NAMES[d]
  return new Set<string | number>([d, d === 0 ? 7 : d, name, name.slice(0, 3)])
}

function isLive(rule: ConciarPriceRule, now: Date): boolean {
  const today = localDate(now)
  if (rule.start_date && today < rule.start_date.slice(0, 10)) return false
  if (rule.end_date && today > rule.end_date.slice(0, 10)) return false

  const cur = now.getHours() * 60 + now.getMinutes()
  const start = toMinutes(rule.start_time)
  const end = toMinutes(rule.end_time)
  if (start != null && cur < start) return false
  if (end != null && cur > end) return false

  if (rule.weekdays && rule.weekdays.length) {
    const tokens = todayTokens(now)
    const hit = rule.weekdays.some(w => tokens.has(typeof w === 'string' ? w.toLowerCase() : w))
    if (!hit) return false
  }
  return true
}

/** Rules that are live right now (empty schedule fields = always on). */
export function activePriceRules(rules?: ConciarPriceRule[] | null, now: Date = new Date()): ConciarPriceRule[] {
  return (rules ?? []).filter(r => isLive(r, now))
}

/**
 * Label for a promo badge, or null for rule types that don't badge (e.g. fixed).
 * Prefers the merchant's server-localized name (defaultInfo.name); falls back to
 * a generated label from the rule's type when no localized name is present.
 */
export function promoLabel(rule: ConciarPriceRule, t: T): string | null {
  if (rule.type.name === 'buy_x_get_y') {
    if (rule.defaultInfo?.name) return rule.defaultInfo.name
    const buy = rule.buy_quantity ?? 1
    const get = rule.get_quantity ?? 1
    return rule.get_discount_percentage === 100
      ? t('promo.buyGetFree', { buy, get })
      : t('promo.buyGetOff', { buy, get, pct: rule.get_discount_percentage ?? 0 })
  }
  if (rule.type.name === 'percentage') {
    if (rule.defaultInfo?.name) return rule.defaultInfo.name
    return t('promo.percentOff', { pct: rule.percentage ?? 0 })
  }
  return null
}

/** Localized reach phrase ("storewide", "on this item", …) or null. */
export function promoScope(rule: ConciarPriceRule, t: T): string | null {
  const keys: Record<string, string> = {
    self: 'promo.scope.self',
    variants: 'promo.scope.variants',
    category: 'promo.scope.category',
    products: 'promo.scope.products',
    store: 'promo.scope.store',
  }
  const key = keys[rule.scope_type]
  return key ? t(key) : null
}
