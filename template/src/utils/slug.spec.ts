import { describe, it, expect } from 'vitest'
import { productSlug } from '@/utils/slug'

describe('productSlug', () => {
  it('lowercases and hyphenates a Latin name', () => {
    expect(productSlug('Nice Red Chair!')).toBe('nice-red-chair')
  })

  it('collapses runs of punctuation and trims the edges', () => {
    expect(productSlug('  --Oak & Ash Table--  ')).toBe('oak-ash-table')
  })

  it('falls back to the SKU when the name has no Latin characters', () => {
    expect(productSlug('經典麵包箱', 'LEK-BOX-BREAD-W1')).toBe('lek-box-bread-w1')
  })

  it('falls back to a numeric id when there is no usable SKU', () => {
    expect(productSlug('經典麵包箱', 631)).toBe('631')
  })

  it('never returns an empty string, so the :slug route always matches', () => {
    expect(productSlug('經典麵包箱')).toBe('product')
    expect(productSlug(null)).toBe('product')
    expect(productSlug(undefined, null)).toBe('product')
  })
})
