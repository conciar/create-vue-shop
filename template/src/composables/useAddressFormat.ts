import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { ConciarCountry } from '@/api/conciar-types'

/**
 * Which address fields a country uses, and in what order.
 *
 * Countries disagree about this and the API says so per country: `has_zipcode`
 * and `has_state` decide whether a field applies at all, and `address_format`
 * — a template like `{zipcode} {city}` or `{house_number} {street}` — decides
 * the order. Japan puts the postcode first, the US wants a state, Ireland has
 * no postcode to speak of.
 *
 * Every form that collects an address needs the same answers, so they live
 * here rather than being re-derived per form. A form that hardcodes the Dutch
 * order silently collects the wrong thing everywhere else.
 */
export function useAddressFormat(country: MaybeRefOrGetter<ConciarCountry | null | undefined>) {
  const selected = computed(() => toValue(country) ?? null)

  const format = computed(() => selected.value?.address_format ?? '')

  /** Ordered before the country has loaded, so the field isn't hidden mid-typing. */
  const showPostcode = computed(() => selected.value === null || selected.value.has_zipcode !== false)
  const showState = computed(() => selected.value?.has_state === true)

  const zipcodeBeforeCity = computed(() => precedes(format.value, '{zipcode}', '{city}'))
  const houseNumberFirst = computed(() => precedes(format.value, '{house_number}', '{street}'))

  return { selectedCountry: selected, showPostcode, showState, zipcodeBeforeCity, houseNumberFirst }
}

/** True only when both placeholders are present and `first` comes first. */
function precedes(format: string, first: string, second: string): boolean {
  const a = format.indexOf(first)
  const b = format.indexOf(second)
  return a !== -1 && b !== -1 && a < b
}
