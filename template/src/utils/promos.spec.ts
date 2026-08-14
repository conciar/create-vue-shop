import { describe, it, expect } from 'vitest'
import { activePriceRules, promoLabel, promoScope } from './promos'
import type { ConciarPriceRule } from '@/api/conciar-types'

// Minimal i18n stub: echoes the key plus interpolation so assertions can see
// which branch was taken without depending on the real locale strings.
const t = (key: string, named?: Record<string, unknown>) =>
  named ? `${key}:${JSON.stringify(named)}` : key

const rule = (over: Partial<ConciarPriceRule> = {}): ConciarPriceRule => ({
  type: { name: 'percentage' },
  scope_type: 'store',
  percentage: 10,
  ...over,
})

describe('activePriceRules', () => {
  const now = new Date('2026-06-15T12:00:00') // a Monday, midday

  it('treats empty schedule fields as always-on', () => {
    expect(activePriceRules([rule()], now)).toHaveLength(1)
  })

  it('excludes rules that have not started yet', () => {
    expect(activePriceRules([rule({ start_date: '2026-07-01' })], now)).toHaveLength(0)
  })

  it('excludes rules that have ended', () => {
    expect(activePriceRules([rule({ end_date: '2026-06-01' })], now)).toHaveLength(0)
  })

  it('includes rules inside their date window', () => {
    expect(activePriceRules([rule({ start_date: '2026-06-01', end_date: '2026-06-30' })], now)).toHaveLength(1)
  })

  it('respects time-of-day windows', () => {
    expect(activePriceRules([rule({ start_time: '13:00', end_time: '18:00' })], now)).toHaveLength(0)
    expect(activePriceRules([rule({ start_time: '09:00', end_time: '18:00' })], now)).toHaveLength(1)
  })

  it('matches weekdays by name, abbrev, and index', () => {
    expect(activePriceRules([rule({ weekdays: ['monday'] })], now)).toHaveLength(1)
    expect(activePriceRules([rule({ weekdays: ['mon'] })], now)).toHaveLength(1)
    expect(activePriceRules([rule({ weekdays: [1] })], now)).toHaveLength(1)
    expect(activePriceRules([rule({ weekdays: ['tuesday'] })], now)).toHaveLength(0)
  })

  it('handles null/undefined input', () => {
    expect(activePriceRules(null, now)).toEqual([])
    expect(activePriceRules(undefined, now)).toEqual([])
  })

  it('excludes a rule once the current time is after end_time', () => {
    expect(activePriceRules([rule({ start_time: '08:00', end_time: '10:00' })], now)).toHaveLength(0)
  })

  it('does not block on a malformed time string (fails closed to "always on" for that bound)', () => {
    expect(activePriceRules([rule({ start_time: 'invalid' })], now)).toHaveLength(1)
  })

  it('matches Sunday via the d===0 -> 7 token mapping', () => {
    const sunday = new Date('2026-06-14T12:00:00') // a Sunday
    expect(activePriceRules([rule({ weekdays: ['sunday'] })], sunday)).toHaveLength(1)
    expect(activePriceRules([rule({ weekdays: [7] })], sunday)).toHaveLength(1)
  })
})

describe('promoLabel', () => {
  it('prefers the merchant-localized name when present', () => {
    const r = rule({ type: { name: 'percentage' }, defaultInfo: { name: 'Summer Sale', description: null, language_id: 1 } })
    expect(promoLabel(r, t)).toBe('Summer Sale')
  })

  it('labels a "buy X get Y free" rule', () => {
    const r = rule({ type: { name: 'buy_x_get_y' }, buy_quantity: 2, get_quantity: 1, get_discount_percentage: 100 })
    expect(promoLabel(r, t)).toBe('promo.buyGetFree:{"buy":2,"get":1}')
  })

  it('labels a discounted "buy X get Y" rule', () => {
    const r = rule({ type: { name: 'buy_x_get_y' }, buy_quantity: 3, get_quantity: 1, get_discount_percentage: 50 })
    expect(promoLabel(r, t)).toBe('promo.buyGetOff:{"buy":3,"get":1,"pct":50}')
  })

  it('labels a percentage rule', () => {
    expect(promoLabel(rule({ percentage: 25 }), t)).toBe('promo.percentOff:{"pct":25}')
  })

  it('returns null for non-badging rule types (e.g. fixed)', () => {
    expect(promoLabel(rule({ type: { name: 'fixed' } }), t)).toBeNull()
  })

  it('defaults buy/get quantities to 1 and discount to 0 when absent', () => {
    const r = rule({ type: { name: 'buy_x_get_y' } })
    expect(promoLabel(r, t)).toBe('promo.buyGetOff:{"buy":1,"get":1,"pct":0}')
  })

  it('defaults the percentage to 0 when absent (and no merchant name)', () => {
    const r = rule({ type: { name: 'percentage' }, percentage: undefined })
    expect(promoLabel(r, t)).toBe('promo.percentOff:{"pct":0}')
  })
})

describe('promoScope', () => {
  it('maps each known scope to its localized key', () => {
    expect(promoScope(rule({ scope_type: 'store' }), t)).toBe('promo.scope.store')
    expect(promoScope(rule({ scope_type: 'self' }), t)).toBe('promo.scope.self')
  })

  it('returns null for an unknown scope', () => {
    expect(promoScope(rule({ scope_type: 'galaxy' }), t)).toBeNull()
  })
})
