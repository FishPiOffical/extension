<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getItemsByAuthor, purchaseItem, getPurchasedItems } from '@/api/items'
import { getUser, type UserProfile } from '@/api/user'
import Message from '@/components/msg'
import MessageBox from '@/components/msgbox'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const items = ref<any[]>([])
const user = ref<UserProfile | null>(null)
const myPurchases = ref<any[]>([])
const loading = ref(true)
const activeTab = ref('all')
const username = computed(() => route.params.username as string)

const loadData = async () => {
  loading.value = true
  try {
    const [userRes, itemsRes, purchasesRes] = await Promise.all([
      getUser(username.value),
      getItemsByAuthor(username.value),
      authStore.isAuthenticated ? getPurchasedItems() : Promise.resolve({ data: [] })
    ])
    user.value = userRes.data
    items.value = itemsRes.data
    myPurchases.value = purchasesRes.data
  } catch (error) {
    console.error('Failed to load user data:', error)
    Message.error('加载用户信息失败')
  }
  loading.value = false
}

const handlePurchase = async (item: any) => {
  const ownedVersion = getOwnedVersionOfSameProject(item)
  if (ownedVersion) {
    const isUpdate = (item.version || 1) > (ownedVersion.version || 1)
    const confirmed = await MessageBox.confirm(
      `检测到您已拥有版本 v${ownedVersion.version || 1}，是否免费${isUpdate ? '升级' : '切换'}到版本 v${item.version || 1}？`,
      isUpdate ? '发现新版本' : '切换版本'
    )
    if (!confirmed) return
  } else if (item.price > 0) {
    const confirmed = await MessageBox.confirm(
      `确定消耗 ${item.price} 积分购买 "${item.name}" 吗？`,
      '确认购买'
    )
    if (!confirmed) return
  }

  try {
    await purchaseItem(item.id)
    Message.success(ownedVersion ? '切换成功！' : '购买成功！')
    const purchasesRes = await getPurchasedItems()
    myPurchases.value = purchasesRes.data
  } catch (error: any) {
    console.error('Purchase failed:', error)
  }
}

const filteredItems = computed(() => {
  let filtered = items.value
  
  // Tab filter
  if (activeTab.value !== 'all') {
    filtered = filtered.filter(item => item.type === activeTab.value)
  }

  return filtered
})

const isPurchased = (item: any) => {
  if (!authStore.isAuthenticated) return false
  return myPurchases.value.some((p: any) => p.id === item.id)
}

const getOwnedVersionOfSameProject = (item: any) => {
  if (!authStore.isAuthenticated) return null
  return myPurchases.value.find(p => 
    p.name === item.name && 
    p.type === item.type && 
    p.author.id === item.author.id
  )
}

onMounted(() => {
  loadData()
})

watch(() => route.params.username, () => {
  loadData()
})
</script>

<template>
  <div class="space-y-6 p-4">
    <!-- User Profile Header -->
    <header class="bg-base-100 p-8 rounded-2xl border border-base-200 flex flex-col md:flex-row items-center gap-6">
      <div class="avatar">
        <div class="w-24 h-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
          <img :src="user?.avatar || 'https://pwl.icu/images/default-avatar.png'" />
        </div>
      </div>
      <div class="flex-1 text-center md:text-left">
        <h1 class="text-3xl font-bold flex items-center justify-center md:justify-start gap-2">
          {{ user?.nickname || user?.username || '加载中...' }}
          <div v-if="user?.isAdmin" class="badge badge-secondary">管理员</div>
        </h1>
        <p class="text-base-content/60 mt-2">@{{ user?.username }}</p>
        <div class="mt-4 flex flex-wrap justify-center md:justify-start gap-4 text-sm opacity-70">
          <span class="flex items-center gap-1">
            <Icon icon="mdi:calendar" />
            注册于 {{ user ? new Date(user.createdAt).toLocaleDateString() : '...' }}
          </span>
          <span class="flex items-center gap-1">
            <Icon icon="mdi:package-variant" />
            发布了 {{ items.length }} 个作品
          </span>
        </div>
      </div>
      <div class="join bg-base-200/40 p-1 rounded-xl shrink-0">
        <button 
          @click="activeTab = 'all'" 
          class="btn btn-sm join-item px-4"
          :class="activeTab === 'all' ? 'btn-primary shadow-sm' : 'btn-soft opacity-60'"
        >全部</button>
        <button 
          @click="activeTab = 'extension'" 
          class="btn btn-sm join-item px-4"
          :class="activeTab === 'extension' ? 'btn-primary shadow-sm' : 'btn-soft opacity-60'"
        >插件</button>
        <button 
          @click="activeTab = 'theme'" 
          class="btn btn-sm join-item px-4"
          :class="activeTab === 'theme' ? 'btn-primary shadow-sm' : 'btn-soft opacity-60'"
        >主题</button>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-dots loading-lg text-primary"></span>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredItems.length === 0" class="text-center py-20 opacity-50">
      <p>这位小伙伴还没有发布任何作品呢~</p>
    </div>

    <!-- Items Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="item in filteredItems" :key="item.id" 
        @click="router.push(`/item/${item.id}`)"
        class="group bg-base-100 border border-base-200 rounded-xl hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 flex flex-col p-5 cursor-pointer">
        
        <div class="flex items-start gap-4 mb-4">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                :class="item.type === 'extension' ? 'bg-primary/20 text-primary group-hover:bg-primary group-hover:text-primary-content' : 'bg-secondary/20 text-secondary group-hover:bg-secondary group-hover:text-secondary-content'">
            <Icon :icon="item.type === 'extension' ? 'mdi:code-tags' : 'mdi:palette-outline'" class="w-7 h-7" />
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="font-bold text-base truncate flex items-center gap-1.5 group-hover:text-primary transition-colors">
              {{ item.name }}
              <span class="text-[10px] font-normal opacity-40">v{{ item.version || 1 }}</span>
            </h2>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="badge badge-sm border-none px-2 font-medium" 
                :class="item.type === 'extension' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'">
                {{ item.type === 'extension' ? '插件' : '主题' }}
              </span>
            </div>
          </div>
        </div>

        <p class="text-sm text-base-content/70 line-clamp-2 h-10 mb-5 leading-relaxed">
          {{ item.description || '暂无描述信息...' }}
        </p>

        <div class="flex items-center justify-between pt-4 border-t border-base-200">
          <div class="flex flex-col">
            <span v-if="isPurchased(item)" class="text-xs text-success font-medium flex items-center gap-1">
              <Icon icon="mdi:check-circle" class="w-3.5 h-3.5" />
              已拥有
            </span>
            <span v-else class="text-sm font-bold flex items-center gap-1">
              <Icon icon="mdi:poker-chip" class="w-4 h-4 opacity-30" v-if="item.price > 0" />
              {{ item.price > 0 ? `${item.price} 积分` : '免费' }}
            </span>
          </div>

          <div class="flex gap-2">
            <template v-if="!isPurchased(item)">
              <button v-if="getOwnedVersionOfSameProject(item)"
                      :disabled="!authStore.isAuthenticated"
                      @click.stop="handlePurchase(item)" 
                      class="btn btn-sm btn-primary">
                {{ (item.version || 1) > (getOwnedVersionOfSameProject(item).version || 1) ? '升级' : '切换' }}
              </button>
              <button v-else
                      :disabled="!authStore.isAuthenticated"
                      @click.stop="handlePurchase(item)" 
                      class="btn btn-sm"
                      :class="item.price > 0 ? 'btn-primary' : 'btn-ghost bg-base-200'">
                {{ item.price > 0 ? '购买' : '使用' }}
              </button>
            </template>
            <a v-if="item.downloadUrl && isPurchased(item)" 
               :href="item.downloadUrl" 
               target="_blank" 
               @click.stop
               class="btn btn-sm btn-primary btn-outline border-primary/20 hover:border-primary">
              下载
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
