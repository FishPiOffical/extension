import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, register as registerApi } from '@/api/auth'
import { getUserProfile } from '@/api/user'
import { getConfigStatus } from '@/api/config'
import { useRouter } from 'vue-router'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'))
  const user = ref<any>(JSON.parse(localStorage.getItem('user') || 'null'))
  const isConfigured = ref<boolean>()

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.isAdmin || false)

  function setAuth(authData: { access_token: string; user: any }) {
    token.value = authData.access_token
    user.value = authData.user
    localStorage.setItem('token', authData.access_token)
    localStorage.setItem('user', JSON.stringify(authData.user))
  }

  function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  async function login(username: string, password: string) {
    try {
      const response = await loginApi({ username, password })
      setAuth(response.data)
      return true
    } catch (error) {
      return false
    }
  }

  async function loadProfile() {
    if (!token.value) return

    try {
      const response = await getUserProfile()
      user.value = response.data
      setAuth({ access_token: token.value, user: user.value })
    } catch (error: any) {
      if (error.response?.data?.code === 40101) {
        clearAuth()
      }
    }
  }

  async function loginWithToken(accessToken: string) {
    token.value = accessToken
    localStorage.setItem('token', accessToken)
    await loadProfile()
  }

  function logout() {
    clearAuth()
  }

  async function checkConfig() {
    isConfigured.value = await getConfigStatus().then(res => res.data.configured);
    return isConfigured.value;
  }

  return {
    token,
    user,
    isAuthenticated,
    isAdmin,
    isConfigured,
    login,
    loginWithToken,
    logout,
    loadProfile,
    checkConfig,
  }
})
