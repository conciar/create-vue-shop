<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useCountriesStore, formatCountryName } from '@/stores/countries'
import type { ConciarCountry } from '@/api/conciar-types'

const props = defineProps<{
  modelValue?: string  // v-model: full phone string, e.g. "+31612345678"
  disabled?: boolean
  countryId?: number  // sync selected country when phone is still empty
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const countriesStore = useCountriesStore()

onMounted(() => {
  countriesStore.fetch()
  document.addEventListener('mousedown', onClickOutside)
})
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))

const selectedCountry = ref<ConciarCountry | null>(null)
const phoneNumber = ref('')
const dropdownOpen = ref(false)
const searchQuery = ref('')
const containerRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)

// Default to Netherlands once countries load
const defaultCountry = computed(() =>
  countriesStore.countries.find(c => c.iso_code_2.toUpperCase() === 'NL') ?? countriesStore.countries[0] ?? null
)

const activeCountry = computed(() => selectedCountry.value ?? defaultCountry.value)

// When the parent changes the country and phone is still empty, follow along
watch(() => props.countryId, (id) => {
  if (!id || phoneNumber.value) return
  const match = countriesStore.countries.find(c => c.id === id)
  if (match) selectedCountry.value = match
})

// Parse an externally-set modelValue (e.g. pre-fill from saved phones: "+31612345678")
watch(() => props.modelValue, (val) => {
  if (!val || phoneNumber.value) return  // don't overwrite user input
  const country = countriesStore.countries.find(c => val.startsWith(`+${c.call_prefix}`))
  if (country) {
    selectedCountry.value = country
    phoneNumber.value = val.slice(`+${country.call_prefix}`.length)
  }
}, { immediate: true })

const filteredCountries = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return countriesStore.countries
  return countriesStore.countries.filter(c =>
    formatCountryName(c.name).toLowerCase().includes(q) || String(c.call_prefix).includes(q)
  )
})

function getFlagEmoji(isoCode: string) {
  return [...isoCode.toUpperCase()].map(c => String.fromCodePoint(127397 + c.charCodeAt(0))).join('')
}

function dialCode(country: ConciarCountry) {
  return `+${country.call_prefix}`
}

async function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
  if (dropdownOpen.value) {
    await nextTick()
    searchRef.value?.focus()
  } else {
    searchQuery.value = ''
  }
}

function selectCountry(country: ConciarCountry) {
  selectedCountry.value = country
  dropdownOpen.value = false
  searchQuery.value = ''
  emitValue()
}

function emitValue() {
  const digits = phoneNumber.value.replace(/\D/g, '')
  const country = activeCountry.value
  emit('update:modelValue', digits && country ? `+${country.call_prefix}${digits}` : '')
}

function onPhoneInput(e: Event) {
  phoneNumber.value = (e.target as HTMLInputElement).value
  emitValue()
}

function onClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
    searchQuery.value = ''
  }
}
</script>

<template>
  <div ref="containerRef" class="flex relative">
    <!-- Country selector trigger -->
    <button
      type="button"
      @click="toggleDropdown"
      :disabled="disabled || countriesStore.loading"
      class="flex items-center gap-1.5 border border-black/15 border-r-0 rounded-l-xl px-3 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm focus:outline-none focus:z-10 focus:border-charcoal disabled:opacity-40 shrink-0"
    >
      <template v-if="activeCountry">
        <span class="text-base leading-none">{{ getFlagEmoji(activeCountry.iso_code_2) }}</span>
        <span class="text-gray-600 font-mono text-xs">{{ dialCode(activeCountry) }}</span>
      </template>
      <span v-else class="w-8 h-4 bg-gray-200 rounded animate-pulse" />
      <svg
        class="w-3 h-3 text-gray-400 transition-transform"
        :class="{ 'rotate-180': dropdownOpen }"
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
      </svg>
    </button>

    <!-- Phone number input -->
    <input
      :value="phoneNumber"
      @input="onPhoneInput"
      type="tel"
      inputmode="tel"
      :placeholder="activeCountry?.phone_format ?? ''"
      :maxlength="activeCountry?.phone_digits ? activeCountry.phone_digits + 1 : undefined"
      :disabled="disabled"
      class="flex-1 min-w-0 border border-black/15 rounded-r-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-charcoal transition-colors bg-white"
    />

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="dropdownOpen"
        class="absolute z-50 top-full left-0 mt-1.5 bg-white border border-black/10 rounded-xl shadow-xl overflow-hidden origin-top-left"
        style="min-width: 16rem"
      >
        <!-- Search -->
        <div class="p-2 border-b border-black/8">
          <input
            ref="searchRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search country…"
            class="w-full text-xs px-3 py-2 border border-black/15 rounded-lg focus:outline-none focus:border-charcoal bg-white"
          />
        </div>

        <!-- Country list -->
        <div class="max-h-52 overflow-y-auto">
          <button
            v-for="country in filteredCountries"
            :key="country.id"
            type="button"
            @click="selectCountry(country)"
            class="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
            :class="{ 'bg-gray-50 font-medium': country.id === activeCountry?.id }"
          >
            <span class="text-base leading-none shrink-0">{{ getFlagEmoji(country.iso_code_2) }}</span>
            <span class="flex-1 truncate text-xs">{{ formatCountryName(country.name) }}</span>
            <span class="text-xs text-gray-400 font-mono shrink-0">{{ dialCode(country) }}</span>
          </button>
          <p v-if="filteredCountries.length === 0" class="px-3 py-4 text-xs text-gray-400 text-center">
            No countries found
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>
