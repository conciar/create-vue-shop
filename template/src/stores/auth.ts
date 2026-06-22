import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { generateCodeVerifier, generateCodeChallenge } from '@/utils/pkce'

export interface Customer {
  id: string
  email: string
  firstName: string
  lastName: string
  avatar?: string
}

const PORTAL_URL = import.meta.env.VITE_CONCIAR_PORTAL_URL as string ?? 'https://portal.conciar.com'
const API_URL = import.meta.env.VITE_CONCIAR_API_URL as string ?? ''
const CLIENT_ID = import.meta.env.VITE_CONCIAR_CLIENT_ID as string ?? ''

// When no CLIENT_ID is set the app falls back to a mock login for development
export const DEV_MODE = !CLIENT_ID

function getRedirectUri() {
  const base = import.meta.env.VITE_APP_URL as string ?? window.location.origin
  return `${base}/auth/callback`
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<Customer | null>(
    JSON.parse(localStorage.getItem('cellier_user') ?? 'null')
  )
  // Access token lives in sessionStorage — cleared on tab close, not persisted cross-session
  const accessToken = ref<string | null>(sessionStorage.getItem('cellier_token'))

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)

  // ── OAuth 2.0 PKCE login ────────────────────────────────────────────────
  // Requires Conciar to expose:
  //   GET  {PORTAL_URL}/oauth/authorize   (authorization endpoint)
  //   POST {API_URL}/oauth/token          (token endpoint)
  //   GET  {API_URL}/oauth/userinfo       (user info endpoint)
  //   GET  {PORTAL_URL}/logout            (logout endpoint)
  async function login(returnTo = window.location.pathname) {
    if (DEV_MODE) return  // handled by LoginView mock form

    const verifier = await generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)

    sessionStorage.setItem('pkce_verifier', verifier)
    sessionStorage.setItem('pkce_return_to', returnTo)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: getRedirectUri(),
      response_type: 'code',
      scope: 'openid profile email orders',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })

    window.location.href = `${PORTAL_URL}/oauth/authorize?${params}`
  }

  // Called by AuthCallbackView after Conciar redirects back with ?code=
  async function handleCallback(code: string): Promise<string> {
    const verifier = sessionStorage.getItem('pkce_verifier')
    if (!verifier) throw new Error('Missing PKCE verifier — possible replay attack')

    const res = await fetch(`${API_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        code,
        redirect_uri: getRedirectUri(),
        code_verifier: verifier,
      }),
    })

    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)

    const { access_token } = await res.json()

    accessToken.value = access_token
    sessionStorage.setItem('cellier_token', access_token)
    sessionStorage.removeItem('pkce_verifier')

    await fetchUser()

    const returnTo = sessionStorage.getItem('pkce_return_to') ?? '/'
    sessionStorage.removeItem('pkce_return_to')
    return returnTo
  }

  async function fetchUser() {
    const token = accessToken.value
    if (!token) return

    const res = await fetch(`${API_URL}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Failed to fetch user info')

    const info = await res.json()
    user.value = {
      id: info.sub,
      email: info.email,
      firstName: info.given_name ?? info.first_name ?? '',
      lastName: info.family_name ?? info.last_name ?? '',
      avatar: info.picture,
    }
    localStorage.setItem('cellier_user', JSON.stringify(user.value))
  }

  // Dev-only mock login (used when VITE_CONCIAR_CLIENT_ID is not set)
  function mockLogin(email: string, firstName: string, lastName: string) {
    const mockUser: Customer = { id: 'dev-user', email, firstName, lastName }
    user.value = mockUser
    accessToken.value = 'dev-mock-token'
    sessionStorage.setItem('cellier_token', 'dev-mock-token')
    localStorage.setItem('cellier_user', JSON.stringify(mockUser))
  }

  function logout() {
    const wasAuthenticated = isAuthenticated.value
    user.value = null
    accessToken.value = null
    sessionStorage.removeItem('cellier_token')
    localStorage.removeItem('cellier_user')

    if (!DEV_MODE && wasAuthenticated) {
      const params = new URLSearchParams({ redirect_uri: window.location.origin })
      window.location.href = `${PORTAL_URL}/logout?${params}`
    }
  }

  return { user, accessToken, isAuthenticated, login, handleCallback, fetchUser, mockLogin, logout }
})
