<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import { LOCALES } from '@/i18n'
import { SHOP_NAME } from '@/config'

const cart        = useCartStore()
const customerAuth = useCustomerStore()

const isLoggedIn = computed(() => customerAuth.isLoggedIn)
const displayName = computed(() =>
  customerAuth.customer
    ? `${customerAuth.customer.first_name} ${customerAuth.customer.last_name}`.trim()
    : customerAuth.identifier
)
const { t, locale } = useI18n()

const mobileOpen = ref(false)
const userMenuOpen = ref(false)
const langOpen = ref(false)

const announcements = [
  { icon: '🚚', text: 'Fast, tracked delivery on every order' },
  { icon: '↩', text: 'Free, easy returns' },
  { icon: '🔒', text: 'Secure checkout' },
]
const announcementIndex = ref(0)
let announcementTimer: ReturnType<typeof setInterval>

onMounted(() => {
  announcementTimer = setInterval(() => {
    announcementIndex.value = (announcementIndex.value + 1) % announcements.length
  }, 4000)
})

onUnmounted(() => {
  clearInterval(announcementTimer)
})

function closeAll() {
  mobileOpen.value = false
  userMenuOpen.value = false
  langOpen.value = false
}

function setLocale(code: string) {
  locale.value = code
  localStorage.setItem('locale', code)
  langOpen.value = false
}
</script>

<template>
  <!-- Announcement bar (not fixed — scrolls away) -->
  <div class="bg-charcoal text-white text-xs font-medium h-8 overflow-hidden">
    <div class="max-w-7xl mx-auto px-6 h-full flex items-center justify-end">
      <Transition name="announce" mode="out-in">
        <span :key="announcementIndex" class="flex items-center gap-2">
          <span>{{ announcements[announcementIndex].icon }}</span>
          {{ announcements[announcementIndex].text }}
        </span>
      </Transition>
    </div>
  </div>

  <!-- Sticky (not fixed): the announcement bar above scrolls away naturally and
       the nav sticks to the top — reserves its own space, so no manual offset. -->
  <header class="sticky top-0 z-40">
    <!-- Main navbar -->
    <div class="bg-white/95 backdrop-blur-sm border-b border-black/8">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
      <!-- Logo -->
      <RouterLink to="/" class="font-display text-lg font-semibold tracking-tight shrink-0" @click="closeAll">
        {{ SHOP_NAME }}
      </RouterLink>

      <!-- Desktop nav -->
      <nav class="hidden md:flex items-center gap-7 text-base font-medium text-gray-600">
        <RouterLink to="/subscriptions" class="hover:text-black transition-colors" active-class="text-black">{{ t('nav.theBox') }}</RouterLink>
        <RouterLink to="/products" class="hover:text-black transition-colors" active-class="text-black">{{ t('nav.wines') }}</RouterLink>
      </nav>

      <div class="flex items-center gap-2">
        <!-- Language switcher -->
        <div class="relative hidden md:block" v-click-outside="() => (langOpen = false)">
          <button
            @click="langOpen = !langOpen"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium text-gray-500 hover:text-black hover:bg-gray-100 transition-colors uppercase tracking-widest"
          >
            {{ locale }}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-gray-400">
              <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
            </svg>
          </button>
          <Transition name="dropdown">
            <div
              v-if="langOpen"
              class="absolute right-0 top-full mt-2 w-36 bg-white rounded-xl shadow-xl border border-black/8 py-1 overflow-hidden z-50"
            >
              <button
                v-for="loc in LOCALES"
                :key="loc.code"
                @click="setLocale(loc.code)"
                :class="[
                  'w-full text-left px-3.5 py-2 text-sm transition-colors flex items-center justify-between',
                  locale === loc.code ? 'text-primary font-medium bg-primary-light' : 'text-gray-700 hover:bg-gray-50'
                ]"
              >
                {{ loc.label }}
                <span v-if="locale === loc.code" class="font-mono text-xs text-primary">✓</span>
              </button>
            </div>
          </Transition>
        </div>

        <!-- Cart -->
        <button
          @click="cart.isOpen = true"
          class="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Open cart"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
          </svg>
          <span
            v-if="cart.count > 0"
            class="absolute -top-0.5 -right-0.5 bg-primary text-white rounded-full flex items-center justify-center font-mono leading-none"
            style="font-size: 10px; width: 18px; height: 18px;"
          >
            {{ cart.count > 9 ? '9+' : cart.count }}
          </span>
        </button>

        <!-- User menu (desktop) -->
        <div class="relative hidden md:block">
          <!-- Authenticated -->
          <button
            v-if="isLoggedIn"
            @click="userMenuOpen = !userMenuOpen"
            class="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            <div class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold font-display">
              {{ displayName[0]?.toUpperCase() }}
            </div>
            <span class="max-w-[120px] truncate">{{ displayName }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-gray-400">
              <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Sign in -->
          <RouterLink
            v-else
            to="/login"
            class="text-sm font-medium px-4 py-2 rounded-xl bg-charcoal text-white hover:bg-primary transition-colors"
          >
            {{ t('nav.signIn') }}
          </RouterLink>

          <!-- Dropdown -->
          <Transition name="dropdown">
            <div
              v-if="userMenuOpen && isLoggedIn"
              v-click-outside="() => (userMenuOpen = false)"
              class="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-black/8 py-2 overflow-hidden"
            >
              <div class="px-4 py-2.5 border-b border-black/6">
                <p class="text-sm font-medium truncate">{{ displayName }}</p>
                <p class="text-xs text-gray-400 truncate mt-0.5">
                  {{ customerAuth.customer?.email ?? customerAuth.identifier }}
                </p>
              </div>
              <RouterLink to="/account/orders" @click="userMenuOpen = false" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-gray-400">
                  <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h9A1.5 1.5 0 0 1 14 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9ZM3.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-9Zm1 2.25a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5h-3a.75.75 0 0 1-.75-.75Z" />
                </svg>
                {{ t('nav.myOrders') }}
              </RouterLink>
              <RouterLink to="/account/subscriptions" @click="userMenuOpen = false" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-gray-400">
                  <path d="M9 3h6M9 3v3.5c0 .5-.2 1-.5 1.4L6 11v9a1 1 0 001 1h10a1 1 0 001-1v-9l-2.5-3.1c-.3-.4-.5-.9-.5-1.4V3M9 3h6" />
                  <path fill-rule="evenodd" d="M2 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3.5a.75.75 0 0 0 0-1.5H2.5v-9h11v2.25a.75.75 0 0 0 1.5 0V3a1 1 0 0 0-1-1H2Zm1.75 5a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Zm0 3a.75.75 0 0 0 0 1.5H6a.75.75 0 0 0 0-1.5H3.75Z" clip-rule="evenodd" />
                </svg>
                {{ t('nav.mySubscriptions') }}
              </RouterLink>
              <a
                href="https://portal.conciar.com"
                target="_blank"
                rel="noopener noreferrer"
                @click="userMenuOpen = false"
                class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-gray-400">
                  <path fill-rule="evenodd" d="M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z" clip-rule="evenodd" />
                </svg>
                {{ t('nav.manageAccount') }} ↗
              </a>
              <div class="border-t border-black/6 mt-1 pt-1">
                <button
                  @click="customerAuth.logout(); userMenuOpen = false"
                  class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-gray-400">
                    <path fill-rule="evenodd" d="M2 4.75A2.75 2.75 0 0 1 4.75 2h3a2.75 2.75 0 0 1 2.75 2.75v.5a.75.75 0 0 1-1.5 0v-.5c0-.69-.56-1.25-1.25-1.25h-3c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h3c.69 0 1.25-.56 1.25-1.25v-.5a.75.75 0 0 1 1.5 0v.5A2.75 2.75 0 0 1 7.75 14h-3A2.75 2.75 0 0 1 2 11.25v-6.5Zm9.47.47a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 1 1-1.06-1.06l.97-.97H6.75a.75.75 0 0 1 0-1.5h5.69l-.97-.97a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                  </svg>
                  {{ t('nav.signOut') }}
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Mobile menu button -->
        <button
          @click="mobileOpen = !mobileOpen; userMenuOpen = false"
          class="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg v-if="!mobileOpen" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.6" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    </div>

    <!-- Mobile nav -->
    <div v-if="mobileOpen" class="md:hidden border-t border-black/8 bg-white px-6 py-4 flex flex-col gap-1">
      <!-- User info (mobile) -->
      <div v-if="isLoggedIn" class="flex items-center gap-3 py-3 mb-2 border-b border-black/6">
        <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold font-display">
          {{ displayName[0]?.toUpperCase() }}
        </div>
        <div>
          <p class="text-sm font-medium">{{ displayName }}</p>
          <p class="text-xs text-gray-400">
            {{ customerAuth.customer?.email ?? customerAuth.identifier }}
          </p>
        </div>
      </div>

      <template v-if="isLoggedIn">
        <RouterLink to="/account/orders" class="py-2.5 text-sm font-medium text-gray-700 hover:text-black" @click="closeAll">{{ t('nav.myOrders') }}</RouterLink>
        <RouterLink to="/account/subscriptions" class="py-2.5 text-sm font-medium text-gray-700 hover:text-black" @click="closeAll">{{ t('nav.mySubscriptions') }}</RouterLink>
      </template>
      <RouterLink to="/subscriptions" class="py-2.5 text-sm font-medium text-gray-700 hover:text-black" @click="closeAll">{{ t('nav.theBox') }}</RouterLink>
      <RouterLink to="/products" class="py-2.5 text-sm font-medium text-gray-700 hover:text-black" @click="closeAll">{{ t('nav.wines') }}</RouterLink>
      <a href="https://portal.conciar.com" target="_blank" rel="noopener noreferrer" class="py-2.5 text-sm font-medium text-gray-700 hover:text-black">
        {{ t('nav.manageAccount') }} ↗
      </a>

      <!-- Language switcher (mobile) -->
      <div class="border-t border-black/6 pt-3 mt-1">
        <p class="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Language</p>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="loc in LOCALES"
            :key="loc.code"
            @click="setLocale(loc.code)"
            :class="[
              'px-3 py-1.5 rounded-lg text-xs font-mono font-medium uppercase tracking-widest transition-colors',
              locale === loc.code ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            ]"
          >
            {{ loc.code }}
          </button>
        </div>
      </div>

      <div class="border-t border-black/6 pt-3 mt-1">
        <button v-if="isLoggedIn" @click="customerAuth.logout(); closeAll()" class="w-full text-left py-2.5 text-sm font-medium text-gray-700 hover:text-black">
          {{ t('nav.signOut') }}
        </button>
        <RouterLink v-else to="/login" @click="closeAll" class="block py-2.5 text-sm font-medium text-primary">
          {{ t('nav.signIn') }}
        </RouterLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
.dropdown-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.dropdown-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-6px); }

.announce-enter-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.announce-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.announce-enter-from { opacity: 0; transform: translateY(8px); }
.announce-leave-to   { opacity: 0; transform: translateY(-8px); }
</style>
