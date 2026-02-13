<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import Header from './components/header.vue'
import Content from './components/content.vue'
import Footer from './components/footer.vue'

const authStore = useAuthStore()

onMounted(() => {
  authStore.checkConfig().then((isConfigured) => {
    if (isConfigured === false) {
      // 如果未配置，直接跳转到配置页面
      window.location.href = '/config'
    }
  })
  authStore.loadProfile()
})
</script>

<template>
  <div v-if="authStore.isConfigured" class="min-h-screen bg-base-100 text-base-content antialiased font-sans flex flex-col">
    <Header v-if="$route.name != 'config'" />
    <Content />
    <Footer />
  </div>
  <div v-else class="min-h-screen flex items-center justify-center">
    <span class="loading loading-spinner text-primary"></span>
  </div>
</template>
