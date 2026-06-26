import { describe, it, expect } from 'vitest'
import { formatMoney, discountDisplay } from './money'

describe('formatMoney', () => {
  it('formats with euro defaults (€ 1.234,56)', () => {
    expect(formatMoney(1234.56)).toBe('€ 1.234,56')
  })

  it('groups thousands and keeps two decimals', () => {
    expect(formatMoney(1000000)).toBe('€ 1.000.000,00')
    expect(formatMoney(5)).toBe('€ 5,00')
  })

  it('uses the absolute value (sign is dropped)', () => {
    expect(formatMoney(-12.5)).toBe('€ 12,50')
  })

  it('honours a custom currency shape', () => {
    const usd = { symbol_icon: '$', decimal_places: 2, decimal_separator: '.', thousand_separator: ',' }
    expect(formatMoney(1234.5, usd)).toBe('$ 1,234.50')
  })

  it('supports zero-decimal currencies', () => {
    const yen = { symbol_icon: '¥', decimal_places: 0, decimal_separator: '.', thousand_separator: ',' }
    expect(formatMoney(1500, yen)).toBe('¥ 1,500')
  })
})

describe('discountDisplay', () => {
  it('returns null when there is no compare price', () => {
    expect(discountDisplay(20)).toBeNull()
    expect(discountDisplay(20, null)).toBeNull()
  })

  it('returns null when compare price is not strictly greater than the selling price', () => {
    expect(discountDisplay(20, { amount: 20 })).toBeNull()
    expect(discountDisplay(20, { amount: 15 })).toBeNull()
  })

  it('computes the rounded percent off and formats the "was" price', () => {
    const d = discountDisplay(17.5, { amount: 25 })
    expect(d).not.toBeNull()
    expect(d!.percentOff).toBe(30)
    expect(d!.was).toBe('€ 25,00')
  })

  it('formats the "was" price in the compare price currency', () => {
    const usd = { symbol_icon: '$', decimal_places: 2, decimal_separator: '.', thousand_separator: ',' }
    const d = discountDisplay(80, { amount: 100, currency: usd })
    expect(d!.was).toBe('$ 100.00')
    expect(d!.percentOff).toBe(20)
  })
})
