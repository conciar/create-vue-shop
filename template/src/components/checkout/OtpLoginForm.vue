<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCustomerStore } from '@/stores/customer'

const { t } = useI18n()
const emit    = defineEmits<{ success: [] }>()
const customer = useCustomerStore()

const emailInput        = ref('')
const codeInput         = ref('')
const loading           = ref(false)
const error             = ref<string | null>(null)
const attemptsRemaining = ref<number | null>(null)
const resendCountdown   = ref(0)
const resendSuccess     = ref(false)

let countdownTimer: ReturnType<typeof setInterval>

const canSend = computed(() => emailInput.value.trim().includes('@'))
const canVerify = computed(() => codeInput.value.length === 6 && attemptsRemaining.value !== 0)

function startResendTimer() {
  resendCountdown.value = 30
  countdownTimer = setInterval(() => {
    if (--resendCountdown.value <= 0) clearInterval(countdownTimer)
  }, 1000)
}

onUnmounted(() => clearInterval(countdownTimer))

async function sendCode() {
  if (!canSend.value) return
  loading.value = true
  error.value = null
  try {
    await customer.requestOtp(emailInput.value.trim())
    startResendTimer()
  } catch (e: any) {
    error.value = e?.status === 404
      ? t('login.otp.noAccount')
      : t('login.otp.genericError')
  } finally {
    loading.value = false
  }
}

async function verify() {
  if (!canVerify.value) return
  loading.value = true
  error.value = null
  try {
    await customer.verifyOtp(codeInput.value)
    emit('success')
  } catch (e: any) {
    const remaining = e?.attempts_remaining ?? null
    attemptsRemaining.value = remaining
    error.value = remaining === 0
      ? t('login.otp.tooManyAttempts')
      : remaining !== null
        ? t('login.otp.attemptsRemaining', remaining)
        : t('login.otp.invalidCode')
    codeInput.value = ''
  } finally {
    loading.value = false
  }
}

async function resend() {
  loading.value = true
  error.value = null
  resendSuccess.value = false
  try {
    await customer.resendOtp()
    resendSuccess.value = true
    startResendTimer()
  } catch {
    error.value = t('login.otp.resendError')
  } finally {
    loading.value = false
  }
}

function changeEmail() {
  customer.resetOtp()
  codeInput.value = ''
  error.value = null
  attemptsRemaining.value = null
  resendSuccess.value = false
  clearInterval(countdownTimer)
}

function onCodeInput(e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6)
  codeInput.value = val
  error.value = null
  if (val.length === 6) verify()
}
</script>

<template>
  <!-- Step 1: Email -->
  <div v-if="!customer.otpSent" class="flex flex-col gap-4">
    <div>
      <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
        {{ t('login.otp.emailLabel') }}
      </label>
      <input
        v-model="emailInput"
        type="email"
        inputmode="email"
        :placeholder="t('login.otp.emailPlaceholder')"
        @keyup.enter="sendCode"
        :disabled="loading"
        class="w-full border border-black/15 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-charcoal transition-colors bg-white disabled:opacity-60"
      />
    </div>

    <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

    <button
      type="button"
      @click="sendCode"
      :disabled="!canSend || loading"
      class="w-full bg-charcoal text-white text-sm font-mono font-medium py-3.5 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      <svg v-if="loading" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      {{ loading ? t('login.otp.sending') : t('login.otp.sendCode') }}
    </button>
  </div>

  <!-- Step 2: OTP code -->
  <div v-else class="flex flex-col gap-4">
    <div>
      <p class="text-sm text-gray-600 mb-0.5">
        {{ t('login.otp.sentTo') }}
      </p>
      <p class="font-mono text-sm font-medium text-charcoal">{{ customer.identifier }}</p>
      <button
        type="button"
        @click="changeEmail"
        class="text-xs font-mono text-gray-400 hover:text-primary transition-colors mt-1"
      >
        {{ t('login.otp.change') }}
      </button>
    </div>

    <div>
      <label class="text-xs font-mono font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
        {{ t('login.otp.codeLabel') }}
      </label>
      <input
        :value="codeInput"
        @input="onCodeInput"
        type="text"
        inputmode="numeric"
        placeholder="000000"
        maxlength="6"
        :disabled="loading || attemptsRemaining === 0"
        class="w-full border border-black/15 rounded-xl px-4 py-3 text-2xl text-center tracking-[0.5em] font-mono focus:outline-none focus:border-charcoal transition-colors bg-white disabled:opacity-60"
      />
    </div>

    <p v-if="error" class="text-xs text-red-500">{{ error }}</p>

    <button
      type="button"
      @click="verify"
      :disabled="!canVerify || loading"
      class="w-full bg-charcoal text-white text-sm font-mono font-medium py-3.5 rounded-xl hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      <svg v-if="loading" class="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      {{ loading ? t('login.otp.verifying') : t('login.otp.verify') }}
    </button>

    <!-- Resend -->
    <div class="text-center text-xs font-mono">
      <p v-if="resendSuccess" class="text-green-600">{{ t('login.otp.resendSuccess') }}</p>
      <span v-else-if="resendCountdown > 0" class="text-gray-400">
        {{ t('login.otp.resendIn', { n: resendCountdown }) }}
      </span>
      <button
        v-else
        type="button"
        @click="resend"
        :disabled="loading"
        class="text-primary hover:underline transition-colors disabled:opacity-40"
      >
        {{ t('login.otp.resend') }}
      </button>
    </div>
  </div>
</template>
