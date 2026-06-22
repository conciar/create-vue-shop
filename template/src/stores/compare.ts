import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { ConciarConnectProduct } from '@/api/conciar-types'

const MAX = 3

export const useCompareStore = defineStore('compare', () => {
  const items = ref<ConciarConnectProduct[]>([])

  const isFull     = computed(() => items.value.length >= MAX)
  const isSelected = (id: number) => items.value.some(p => p.id === id)

  function toggle(product: ConciarConnectProduct) {
    if (isSelected(product.id)) {
      items.value = items.value.filter(p => p.id !== product.id)
    } else if (!isFull.value) {
      items.value = [...items.value, product]
    }
  }

  function remove(id: number) {
    items.value = items.value.filter(p => p.id !== id)
  }

  function clear() {
    items.value = []
  }

  return { items, isFull, isSelected, toggle, remove, clear }
})
