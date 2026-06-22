<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCompareStore } from '@/stores/compare'
import { conciarApi } from '@/api/conciar'
import { useModalA11y } from '@/composables/useModalA11y'
import type { ConciarProduct } from '@/api/conciar-types'

const { t } = useI18n()
const emit = defineEmits<{ close: [] }>()
const compare = useCompareStore()

const dialogRef = ref<HTMLElement | null>(null)
useModalA11y(dialogRef, () => emit('close'))

const details  = ref<(ConciarProduct | null)[]>([])
const loading  = ref(false)

const HIDDEN = new Set(['tags', 'smaaktag', 'label'])

// Fetch full details when modal opens
watch(() => compare.items, async (items) => {
  if (!items.length) return
  loading.value = true
  details.value = await Promise.all(
    items.map(p => conciarApi.products.getDetail(String(p.id)).catch(() => null))
  )
  loading.value = false
}, { immediate: true, deep: true })

// Collect all property keys across all loaded products (preserving first-seen order)
const allPropertyKeys = computed(() => {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const d of details.value) {
    if (!d) continue
    for (const pv of d.property_values ?? []) {
      if (!HIDDEN.has(pv.property.key) && !seen.has(pv.property.key)) {
        keys.push(pv.property.key)
        seen.add(pv.property.key)
      }
    }
  }
  return keys
})

// Get label for a property key from any loaded product
function labelFor(key: string) {
  for (const d of details.value) {
    const pv = d?.property_values?.find(p => p.property.key === key)
    if (pv?.property.default_info?.label) return pv.property.default_info.label
  }
  return key
}

// Get value for a key in a specific product
function valueOf(detail: ConciarProduct | null, key: string) {
  return detail?.property_values?.find(pv => pv.property.key === key)?.default_info?.value ?? null
}

function imageSrc(idx: number) {
  return compare.items[idx]?.files?.find(f => f.type?.name === 'image')?.url ?? null
}

function displayName(idx: number) {
  const item = compare.items[idx]
  return item?.resolved_info?.name ?? `Product ${item?.id}`
}

function displayPrice(idx: number) {
  return compare.items[idx]?.converted_retail_price?.display_price ?? '–'
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" @click="emit('close')" />

    <!-- Panel -->
    <div
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
      class="relative z-10 mt-auto bg-cream rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl"
    >

      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-5 border-b border-black/8 shrink-0">
        <h2 id="compare-modal-title" class="font-display text-2xl font-semibold">{{ t('compare.title') }}</h2>
        <button type="button" @click="emit('close')" :aria-label="t('compare.close')" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/6 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4">
            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z"/>
          </svg>
        </button>
      </div>

      <!-- Scrollable table -->
      <div class="overflow-auto flex-1 px-6 pb-8">

        <!-- Loading -->
        <div v-if="loading" class="py-16 flex items-center justify-center gap-3">
          <svg class="w-5 h-5 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <span class="font-mono text-sm text-gray-400">{{ t('compare.loading') }}</span>
        </div>

        <table v-else class="w-full border-collapse">

          <!-- Product headers -->
          <thead>
            <tr>
              <th class="w-24 sm:w-36 lg:w-48 sticky left-0 z-30 bg-cream" />
              <th
                v-for="(item, i) in compare.items"
                :key="item.id"
                class="pb-6 pt-6 px-3 align-top text-left"
              >
                <!-- Remove button -->
                <div class="flex justify-end mb-3">
                  <button type="button" @click="compare.remove(item.id)" class="font-mono text-xs text-gray-400 hover:text-red-500 transition-colors">{{ t('compare.remove') }}</button>
                </div>
                <!-- Image -->
                <div class="w-full aspect-[3/4] rounded-2xl overflow-hidden bg-white border border-black/8 mb-3 flex items-center justify-center">
                  <img v-if="imageSrc(i)" :src="imageSrc(i)!" :alt="displayName(i)" class="w-full h-full object-cover" />
                  <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="w-10 h-10 text-gray-200">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 3h6M9 3v3.5c0 .5-.2 1-.5 1.4L6 11v9a1 1 0 001 1h10a1 1 0 001-1v-9l-2.5-3.1c-.3-.4-.5-.9-.5-1.4V3M9 3h6"/>
                  </svg>
                </div>
                <!-- Name + price -->
                <p class="font-display font-semibold text-base leading-snug mb-1">{{ displayName(i) }}</p>
                <p class="font-mono text-lg font-semibold mt-1">{{ displayPrice(i) }}</p>
              </th>

              <!-- Empty add slot (if < 3) -->
              <th v-if="compare.items.length < 3" class="pb-6 pt-6 px-3 align-top">
                <div class="w-full aspect-[3/4] rounded-2xl border-2 border-dashed border-black/10 flex items-center justify-center text-gray-300 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-8 h-8">
                    <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"/>
                  </svg>
                </div>
                <p class="font-mono text-xs text-gray-400 text-center">{{ t('compare.addWine') }}</p>
              </th>
            </tr>
          </thead>

          <!-- Property rows -->
          <tbody>
            <tr
              v-for="key in allPropertyKeys"
              :key="key"
              class="border-t border-black/6 group"
            >
              <td class="py-3 pr-4 font-mono text-[11px] font-semibold text-gray-400 uppercase tracking-wider align-middle whitespace-nowrap sticky left-0 z-10 bg-cream">
                {{ labelFor(key) }}
              </td>
              <td
                v-for="(_, i) in compare.items"
                :key="i"
                class="py-3 px-3 font-mono text-sm align-middle"
                :class="valueOf(details[i], key) ? 'text-charcoal' : 'text-gray-400'"
              >
                {{ valueOf(details[i], key) ?? '–' }}
              </td>
              <!-- Empty slot column -->
              <td v-if="compare.items.length < 3" class="py-3 px-3 text-gray-300 font-mono text-sm">–</td>
            </tr>
          </tbody>

        </table>
      </div>
    </div>
  </div>
</template>
