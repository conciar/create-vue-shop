import { describe, it, expect } from 'vitest'
import { formatCountryName } from './countries'

describe('formatCountryName', () => {
  it('replaces underscores and title-cases each word', () => {
    expect(formatCountryName('new_zealand')).toBe('New Zealand')
    expect(formatCountryName('united_states')).toBe('United States')
  })

  it('capitalises a single word', () => {
    expect(formatCountryName('netherlands')).toBe('Netherlands')
  })

  it('handles an empty string', () => {
    expect(formatCountryName('')).toBe('')
  })

  it('is idempotent on already-formatted input', () => {
    expect(formatCountryName('Netherlands')).toBe('Netherlands')
  })
})
