<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCompareStore } from '@/stores/compare'
import CompareModal from './CompareModal.vue'

const { t } = useI18n()
const compare = useCompareStore()
const showModal = ref(false)

function imageSrc(idx: number) {
  return compare.items[idx]?.files?.find(f => f.type?.name === 'image')?.url ?? null
}
function name(idx: number) {
  const item = compare.items[idx]
  return item?.resolved_info?.name ?? `Product ${item?.id}`
}
</script>

<template>
  <Teleport to="body">
    <!-- Tray -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-y-full"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="compare.items.length"
        class="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-black/8 shadow-xl px-4 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div class="max-w-7xl mx-auto flex items-center gap-3 sm:gap-4">
          <!-- Thumbnails (scroll horizontally on small screens) -->
          <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 overflow-x-auto">
            <div
              v-for="(item, i) in compare.items"
              :key="item.id"
              class="relative group/thumb shrink-0"
            >
              <div class="w-12 h-14 rounded-xl overflow-hidden bg-cream border border-black/8 flex items-center justify-center">
                <img v-if="imageSrc(i)" :src="imageSrc(i)!" :alt="name(i)" class="w-full h-full object-cover" />
                <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-5 h-5 text-gray-300">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 3h6M9 3v3.5c0 .5-.2 1-.5 1.4L6 11v9a1 1 0 001 1h10a1 1 0 001-1v-9l-2.5-3.1c-.3-.4-.5-.9-.5-1.4V3M9 3h6"/>
                </svg>
              </div>
              <!-- Remove (always visible — hover-only is unusable on touch) -->
              <button
                type="button"
                @click="compare.remove(item.id)"
                :aria-label="t('compare.removeFromComparison')"
                class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-charcoal text-white flex items-center justify-center shadow-sm hover:bg-primary transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" class="w-3 h-3">
                  <path d="M6.53 6l2.735-2.734a.375.375 0 1 0-.53-.531L6 5.47 3.265 2.735a.375.375 0 1 0-.53.531L5.47 6 2.735 8.734a.375.375 0 1 0 .531.531L6 6.53l2.734 2.735a.375.375 0 1 0 .531-.531L6.53 6Z"/>
                </svg>
              </button>
            </div>

            <!-- Empty slots -->
            <div
              v-for="n in (3 - compare.items.length)"
              :key="`empty-${n}`"
              class="w-12 h-14 rounded-xl border-2 border-dashed border-black/10 shrink-0"
            />

            <div class="min-w-0 ml-1 hidden sm:block shrink-0">
              <p class="font-mono text-sm font-medium text-charcoal">{{ t('compare.selected', compare.items.length) }}</p>
              <p class="font-mono text-xs text-gray-400">{{ t('compare.slotsRemaining', 3 - compare.items.length) }}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 shrink-0">
            <button
              type="button"
              @click="compare.clear()"
              class="font-mono text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              {{ t('compare.clear') }}
            </button>
            <button
              type="button"
              :disabled="compare.items.length < 2"
              @click="showModal = true"
              class="bg-charcoal text-white font-mono font-medium text-sm px-5 py-2.5 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                <path fill-rule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" clip-rule="evenodd"/>
              </svg>
              {{ t('compare.compare') }}
              <span class="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none">{{ compare.items.length }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modal -->
    <CompareModal v-if="showModal" @close="showModal = false" />
  </Teleport>
</template>
