<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCartStore } from '@/stores/cart'
import { useModalA11y } from '@/composables/useModalA11y'
import PromoBadge from '@/components/promo/PromoBadge.vue'

const { t } = useI18n()
const cart = useCartStore()
const router = useRouter()

function goToCheckout() {
  cart.isOpen = false
  router.push('/checkout')
}

// Dialog a11y (Escape, focus trap, focus restore) tied to the open state.
const asideRef = ref<HTMLElement | null>(null)
useModalA11y(asideRef, () => (cart.isOpen = false), computed(() => cart.isOpen))
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="fade">
      <div
        v-if="cart.isOpen"
        class="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        @click="cart.isOpen = false"
      />
    </Transition>

    <!-- Drawer -->
    <Transition name="slide">
      <aside
        v-if="cart.isOpen"
        ref="asideRef"
        role="dialog"
        aria-modal="true"
        :aria-label="t('cart.drawer.title')"
        tabindex="-1"
        class="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col focus:outline-none"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-5 border-b border-black/8">
          <h2 class="font-display font-semibold text-lg">
            {{ t('cart.drawer.title') }}
            <span v-if="cart.count" class="text-sm font-normal text-gray-400 ml-2">({{ cart.count }})</span>
          </h2>
          <button @click="cart.isOpen = false" :aria-label="t('compare.close')" class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Empty state -->
        <div v-if="!cart.items.length" class="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400 px-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.2" stroke="currentColor" class="w-16 h-16 opacity-30">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
          </svg>
          <p class="text-sm">{{ t('cart.empty.title') }}</p>
          <button @click="cart.isOpen = false; $router.push('/products')" class="text-sm font-medium text-primary hover:underline">
            {{ t('cart.drawer.browse') }}
          </button>
        </div>

        <!-- Items -->
        <div v-else class="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
          <div
            v-for="item in cart.items"
            :key="`${item.id}-${item.type}`"
            class="flex gap-4 items-start"
          >
            <!-- Image -->
            <div class="w-14 h-18 rounded-xl bg-cream shrink-0 overflow-hidden flex items-center justify-center" style="height: 72px">
              <img
                v-if="item.product.image"
                :src="item.product.image"
                :alt="item.product.name"
                class="w-full h-full object-cover"
              />
              <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 text-gray-300">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 3h6M9 3v3.5c0 .5-.2 1-.5 1.4L6 11v9a1 1 0 001 1h10a1 1 0 001-1v-9l-2.5-3.1c-.3-.4-.5-.9-.5-1.4V3M9 3h6"/>
              </svg>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm leading-snug truncate">{{ item.product.name }}</p>

              <!-- Type badge -->
              <span
                v-if="item.type === 'subscription'"
                class="inline-block font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/8 text-primary mt-1"
              >
                ↻ {{ item.interval ?? t('cart.subscriptionBadge') }}
              </span>
              <span
                v-else-if="item.type === 'product'"
                class="inline-block font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 mt-1"
              >
                {{ t('cart.oneTimeShort') }}
              </span>

              <!-- Automatic promotion badges -->
              <PromoBadge :rules="item.product.priceRules" :max="1" class="mt-1.5" />

              <!-- Quantity controls -->
              <div class="flex items-center gap-2 mt-2">
                <button
                  @click="cart.updateQty(item.id, item.quantity - 1, item.type)"
                  class="w-6 h-6 rounded-full border border-black/20 flex items-center justify-center text-sm hover:border-black transition-colors"
                >−</button>
                <span class="text-sm font-mono w-4 text-center">{{ item.quantity }}</span>
                <button
                  @click="cart.updateQty(item.id, item.quantity + 1, item.type)"
                  class="w-6 h-6 rounded-full border border-black/20 flex items-center justify-center text-sm hover:border-black transition-colors"
                >+</button>
              </div>
            </div>

            <!-- Price + remove -->
            <div class="text-right shrink-0">
              <p class="font-mono font-semibold text-sm">{{ cart.formatMoney(item.price * item.quantity) }}</p>
              <button
                @click="cart.remove(item.id, item.type)"
                class="text-xs text-gray-400 hover:text-red-500 transition-colors mt-1 block"
              >
                {{ t('cart.remove') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div v-if="cart.items.length" class="border-t border-black/8 px-6 py-5 flex flex-col gap-3">
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-500">{{ t('cart.subtotal') }} <span class="text-xs text-gray-400">{{ t('cart.taxIncluded') }}</span></span>
            <span class="font-mono font-semibold">{{ cart.formatMoney(cart.subtotal) }}</span>
          </div>
          <p class="text-xs text-gray-400">{{ t('cart.drawer.shippingNote') }}</p>
          <button
            @click="goToCheckout"
            class="w-full bg-charcoal text-white font-medium py-3.5 rounded-xl hover:bg-primary transition-colors"
          >
            {{ t('cart.drawer.checkout') }}
          </button>
          <RouterLink
            to="/cart"
            @click="cart.isOpen = false"
            class="text-center text-sm text-gray-500 hover:text-black transition-colors"
          >
            {{ t('cart.drawer.viewFullCart') }}
          </RouterLink>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active { transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>
