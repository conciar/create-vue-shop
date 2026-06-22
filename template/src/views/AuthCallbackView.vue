<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const error = ref<string | null>(null)

onMounted(async () => {
  const code = route.query.code as string
  const oauthError = route.query.error as string
  const errorDesc = route.query.error_description as string

  if (oauthError) {
    error.value = errorDesc ?? oauthError
    return
  }

  if (!code) {
    error.value = 'No authorization code received from Conciar.'
    return
  }

  try {
    const returnTo = await auth.handleCallback(code)
    router.replace(returnTo)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Authentication failed. Please try again.'
  }
})
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center px-6">
    <!-- Loading -->
    <div v-if="!error" class="text-center">
      <div class="w-8 h-8 border-2 border-charcoal border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p class="text-sm text-gray-500">Signing you in…</p>
    </div>

    <!-- Error -->
    <div v-else class="max-w-sm w-full text-center">
      <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-red-500">
          <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
        </svg>
      </div>
      <h2 class="font-display font-semibold text-lg mb-2">Sign in failed</h2>
      <p class="text-sm text-gray-500 mb-6">{{ error }}</p>
      <RouterLink to="/login" class="bg-charcoal text-white font-medium px-6 py-3 rounded-xl hover:bg-primary transition-colors text-sm">
        Try again
      </RouterLink>
    </div>
  </div>
</template>
