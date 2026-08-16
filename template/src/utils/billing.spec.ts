import { describe, it, expect, beforeEach } from 'vitest'
import { i18n } from '@/i18n'
import { cycleLabel, billingLabel } from '@/utils/billing'

// The real English messages, so these assert on the copy shoppers actually see.
// Cast because `i18n.global` types keys as a literal union, while these
// functions take runtime-built keys — the same shape a component's
// `useI18n()` hands them.
const { t, te } = i18n.global as unknown as {
  t: (key: string, named?: Record<string, unknown>) => string
  te: (key: string) => boolean
}

beforeEach(() => {
  i18n.global.locale.value = 'en'
})

const cycle = (unit: string, interval?: number) => ({
  billing_cycle_unit: unit,
  billing_cycle_interval: interval,
})

describe('cycleLabel — the catalogue badge', () => {
  it('renders the adjectival form for a plain cycle', () => {
    expect(cycleLabel(cycle('monthly'), t, te)).toBe('Monthly')
    expect(cycleLabel(cycle('quarterly'), t, te)).toBe('Quarterly')
    expect(cycleLabel(cycle('weekly'), t, te)).toBe('Weekly')
  })

  it('spells out four-weekly, which has no adjective', () => {
    expect(cycleLabel(cycle('four_weekly'), t, te)).toBe('Every 4 weeks')
  })

  it('drops to the sentence form when the interval is above one', () => {
    // "Weekly" would be wrong for a box billed every second week.
    expect(cycleLabel(cycle('weekly', 2), t, te)).toBe('Every 2 weeks')
  })

  it('humanises an unrecognised unit rather than dropping it', () => {
    expect(cycleLabel(cycle('every_other_week'), t, te)).toBe('every other week')
  })
})

describe('billingLabel — the account sentence', () => {
  it('handles the noun vocabulary an existing subscription carries', () => {
    expect(billingLabel(cycle('month', 1), t, te)).toBe('Every month')
    expect(billingLabel(cycle('month', 3), t, te)).toBe('Every 3 months')
  })

  it('handles the adjectival vocabulary a product carries', () => {
    expect(billingLabel(cycle('monthly', 1), t, te)).toBe('Every month')
    expect(billingLabel(cycle('yearly', 2), t, te)).toBe('Every 2 years')
  })

  it('multiplies the interval out for four-weekly', () => {
    expect(billingLabel(cycle('four_weekly', 1), t, te)).toBe('Every 4 weeks')
    expect(billingLabel(cycle('four_weekly', 2), t, te)).toBe('Every 8 weeks')
  })

  it('keeps the sentence frame around an unrecognised unit', () => {
    expect(billingLabel(cycle('fortnight', 1), t, te)).toBe('Every fortnight')
  })

  it('treats a missing interval as one', () => {
    expect(billingLabel(cycle('month'), t, te)).toBe('Every month')
  })
})
