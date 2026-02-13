<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getItems, purchaseItem, getPurchasedItems } from '@/api/items'
import Message from '@/components/msg'
import MessageBox from '@/components/msgbox'

const router = useRouter()
const authStore = useAuthStore()
const items = ref<any[]>([])
const myPurchases = ref<any[]>([])
const loading = ref(true)
const activeTab = ref('all')
const searchQuery = ref('')

const loadItems = async () => {
  loading.value = true
  try {
    const [itemsRes, purchasesRes] = await Promise.all([
      getItems(),
      authStore.isAuthenticated ? getPurchasedItems() : Promise.resolve({ data: [] })
    ])
    items.value = itemsRes.data
    myPurchases.value = purchasesRes.data
  } catch (error) {
    console.error('Failed to load items:', error)
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
    await loadItems()
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

  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.description?.toLowerCase().includes(query)
    )
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
  loadItems()
})
</script>

<template>
  <div class="space-y-6 p-4">
    <!-- Header Area -->
    <header class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-base-100 p-6 rounded-2xl border border-base-200">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">扩展集市</h1>
        <p class="text-xs text-base-content/50 mt-1 whitespace-nowrap">发现并获取鱼排的最新扩展与主题</p>
      </div>

      <div class="flex flex-col md:flex-row gap-4 items-center flex-1 max-w-2xl lg:justify-end w-full">
        <!-- Search -->
        <div class="flex-1 input input-bordered">
          <Icon icon="mdi:magnify" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索插件或主题..."
            class="grow"
          />
        </div>

        <!-- Filter Tabs -->
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
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-dots loading-lg text-primary"></span>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredItems.length === 0" class="text-center py-20 opacity-50">
      <p>暂无相关内容</p>
    </div>

    <!-- Items Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div v-for="item in filteredItems" :key="item.id" 
        @click="router.push(`/item/${item.id}`)"
        class="group bg-base-200 border border-base-200 rounded-xl hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 flex flex-col p-5 cursor-pointer">
        
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
              <router-link :to="`/user/${item.author?.username}`" @click.stop class="text-xs opacity-40 hover:text-primary transition-colors truncate">@{{ item.author?.username || '匿名' }}</router-link>
            </div>
          </div>
        </div>

        <p class="text-sm text-base-content/70 line-clamp-2 mb-5 leading-relaxed">
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
