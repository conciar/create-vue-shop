/**
 * Billing-cycle wording, in one place.
 *
 * Two things make this less trivial than it looks.
 *
 * **The API speaks two vocabularies.** A product's `subscription_detail` carries
 * adjectives — `weekly`, `four_weekly`, `quarterly` — while an existing
 * subscription carries nouns: `week`, `month`, `year`. Both reach these
 * functions, so both are accepted.
 *
 * **The two sides want different phrasings.** A catalogue badge reads "Monthly";
 * an account page reads "Every month". Same data, different sentence, so there
 * are two entry points rather than one label everybody bends to fit.
 *
 * `t` and `te` are passed in so these stay plain functions, callable outside a
 * component's setup. An unrecognised unit is humanised (`every_other_week` →
 * "every other week") rather than dropped.
 */

export interface BillingCycle {
  billing_cycle_unit: string
  billing_cycle_interval?: number
}

type Translate = (key: string, named?: Record<string, unknown>) => string
type Exists = (key: string) => boolean

/** Adjective → noun, so `weekly` and `week` both find `billing.units.week`. */
const NOUNS: Record<string, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
  yearly: 'year',
  annually: 'year',
}

function noun(unit: string): string {
  return NOUNS[unit] ?? unit
}

function humanise(unit: string): string {
  return unit.replace(/_/g, ' ')
}

/**
 * The badge form: "Monthly", "Quarterly", "Every 4 weeks".
 *
 * An interval above 1 has no adjective ("Weekly" is wrong for a box billed
 * every second week), so those fall through to the sentence form.
 */
export function cycleLabel(cycle: BillingCycle, t: Translate, te: Exists): string {
  const interval = cycle.billing_cycle_interval ?? 1
  const unit = cycle.billing_cycle_unit

  if (unit === 'four_weekly') return t('billing.everyFourWeeks', { n: interval * 4 })
  if (interval > 1) return billingLabel(cycle, t, te)

  const key = `billing.cycle.${unit}`
  return te(key) ? t(key) : humanise(unit)
}

/**
 * The sentence form: "Every month", "Every 3 months", "Every 4 weeks".
 */
export function billingLabel(cycle: BillingCycle, t: Translate, te: Exists): string {
  const interval = cycle.billing_cycle_interval ?? 1
  const unit = cycle.billing_cycle_unit

  if (unit === 'four_weekly') return t('billing.everyFourWeeks', { n: interval * 4 })

  // An unrecognised unit still gets the sentence frame — "Every fortnight"
  // reads as intended copy, where a bare "fortnight" reads as a bug.
  if (interval === 1) {
    const key = `billing.units.${noun(unit)}`
    return t('billing.every', { unit: te(key) ? t(key) : humanise(unit) })
  }

  const key = `billing.units.${noun(unit)}s`
  return t('billing.everyN', { n: interval, units: te(key) ? t(key) : humanise(unit) })
}
