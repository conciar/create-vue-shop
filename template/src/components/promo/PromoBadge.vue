<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { activePriceRules, promoLabel, promoScope } from '@/utils/promos'
import type { ConciarPriceRule } from '@/api/conciar-types'

const props = defineProps<{
  rules?: ConciarPriceRule[] | null
  max?: number          // cap how many badges to show (e.g. 1 on a card)
  showScope?: boolean   // append the reach phrase ("storewide", …)
}>()

const { t } = useI18n()

const badges = computed(() => {
  const out: { label: string; scope: string | null; description: string | null }[] = []
  for (const r of activePriceRules(props.rules)) {
    const label = promoLabel(r, t)
    if (label) out.push({ label, scope: promoScope(r, t), description: r.defaultInfo?.description ?? null })
  }
  return typeof props.max === 'number' ? out.slice(0, props.max) : out
})
</script>

<template>
  <div v-if="badges.length" class="flex flex-wrap gap-1.5">
    <span
      v-for="(b, i) in badges"
      :key="i"
      :title="b.description || t('promo.autoApplied')"
      class="inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-1 rounded-full bg-primary text-white leading-none shadow-sm"
    >
      {{ b.label }}<span v-if="showScope && b.scope" class="font-normal opacity-80">· {{ b.scope }}</span>
    </span>
  </div>
</template>
