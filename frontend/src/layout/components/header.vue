<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const theme = ref('light')

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme.value)
  localStorage.setItem('theme', theme.value)
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') || 'light'
  theme.value = savedTheme
  document.documentElement.setAttribute('data-theme', savedTheme)
})

const logout = () => {
  authStore.logout()
  window.location.href = '/'
}
</script>

<template>
  <div class="sticky top-0 z-50 w-full border-b border-base-200 backdrop-blur transition-all glass/50">
    <div class="mx-auto px-6 h-16 flex items-center justify-between">
      <!-- Logo -->
      <div class="flex items-center gap-4">
        <RouterLink to="/" class="flex items-center gap-2 group">
          <img src="@/assets/logo.svg" width="32" />
          <span class="font-bold text-lg tracking-tight">鱼排扩展集市</span>
        </RouterLink>
        
        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-1 ml-6">
          <RouterLink to="/market" class="px-4 py-1.5 rounded-full text-sm font-medium hover:bg-primary/50 transition-colors" active-class="bg-primary text-primary-content">
            集市
          </RouterLink>
          <RouterLink v-if="authStore.isAuthenticated" to="/my-purchases" class="px-4 py-1.5 rounded-full text-sm font-medium hover:bg-primary/50 transition-colors" active-class="bg-primary text-primary-content">
            已购
          </RouterLink>
          <RouterLink v-if="authStore.isAuthenticated" to="/my-works" class="px-4 py-1.5 rounded-full text-sm font-medium hover:bg-primary/50 transition-colors" active-class="bg-primary text-primary-content">
            作品
          </RouterLink>
        </nav>
      </div>

      <!-- Right Side Actions -->
      <div class="flex items-center gap-3">
        <!-- Theme Toggle -->
        <button @click="toggleTheme" class="btn btn-circle btn-ghost" aria-label="Toggle Theme">
          <!-- Sun Icon -->
          <Icon v-if="theme === 'light'" icon="tabler:sun-high-filled" />
          <!-- Moon Icon -->
          <Icon v-else icon="tabler:moon-filled" />
        </button>

        <div class="w-px h-6 bg-base-300 mx-1"></div>

        <!-- Upload Button -->
        <RouterLink v-if="authStore.isAuthenticated" to="/upload" class="btn btn-primary btn-sm">
          <Icon icon="mdi:code-tags" class="text-base" />
          发布作品
        </RouterLink>

        <template v-if="!authStore.isAuthenticated">
          <a href="/api/auth/login" class="btn btn-primary btn-sm rounded-full px-6 font-medium">登录</a>
        </template>
        
        <div v-else class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar placeholder border border-base-200">
            <div class="bg-base-200 text-base-content rounded-full w-9">
              <img :src="authStore.user?.avatar" />
            </div>
          </div>
          <ul tabindex="0" class="dropdown-content z-1 menu p-2 shadow-lg bg-base-100 rounded-box w-52 mt-4 border border-base-200/50">
            <li class="px-4 py-2 opacity-50 text-xs font-bold uppercase tracking-wider">
              {{ authStore.user?.username }}
            </li>
            <li><RouterLink to="/my-purchases">我的收藏</RouterLink></li>
            <li><RouterLink to="/my-works">我的作品</RouterLink></li>
            <li v-if="authStore.isAdmin"><RouterLink to="/admin">管理后台</RouterLink></li>
            <div class="divider my-1"></div>
            <li><a @click="logout" class="text-error">退出登录</a></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

