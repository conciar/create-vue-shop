<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useCustomerStore } from '@/stores/customer'
import OtpLoginForm from '@/components/checkout/OtpLoginForm.vue'

const { t } = useI18n()
const customer = useCustomerStore()
const router   = useRouter()
const route    = useRoute()

const returnTo = (route.query.returnTo as string) || '/'

function onLoginSuccess() { router.replace(returnTo) }

onMounted(() => {
  if (customer.isLoggedIn) router.replace(returnTo)
})
</script>

<template>
  <div class="bg-cream min-h-screen flex flex-col">

    <header class="bg-white border-b border-black/8">
      <div class="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <RouterLink to="/" class="font-display text-lg font-semibold tracking-tight">Cellier</RouterLink>
        <RouterLink to="/products" class="text-sm font-mono text-gray-400 hover:text-charcoal transition-colors">
          {{ t('login.continueShopping') }}
        </RouterLink>
      </div>
    </header>

    <div class="flex-1 flex items-center justify-center px-6 py-16">
      <div class="w-full max-w-md">

        <div class="text-center mb-8">
          <h1 class="font-display text-3xl font-semibold mb-2">{{ t('login.title') }}</h1>
          <p class="text-gray-500 text-sm">{{ t('login.subtitle') }}</p>
        </div>

        <div class="bg-white rounded-2xl border border-black/8 p-8">
          <OtpLoginForm @success="onLoginSuccess" />
        </div>

        <p class="text-center text-xs font-mono text-gray-400 mt-6">
          {{ t('login.noAccountNeeded') }}
        </p>

      </div>
    </div>

  </div>
</template>
