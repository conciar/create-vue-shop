import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCompareStore } from './compare'
import type { ConciarConnectProduct } from '@/api/conciar-types'

const product = (id: number) => ({ id } as ConciarConnectProduct)

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('compare store', () => {
  it('toggle adds a product and isSelected reflects it', () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    expect(compare.items).toHaveLength(1)
    expect(compare.isSelected(1)).toBe(true)
  })

  it('toggle removes an already-selected product', () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    compare.toggle(product(1))
    expect(compare.items).toHaveLength(0)
    expect(compare.isSelected(1)).toBe(false)
  })

  it('caps selection at 3 and marks isFull', () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    compare.toggle(product(2))
    compare.toggle(product(3))
    expect(compare.isFull).toBe(true)
    compare.toggle(product(4))
    expect(compare.items).toHaveLength(3)
    expect(compare.isSelected(4)).toBe(false)
  })

  it('remove drops a specific product by id', () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    compare.toggle(product(2))
    compare.remove(1)
    expect(compare.items.map(p => p.id)).toEqual([2])
  })

  it('clear empties the selection', () => {
    const compare = useCompareStore()
    compare.toggle(product(1))
    compare.clear()
    expect(compare.items).toHaveLength(0)
  })
})
