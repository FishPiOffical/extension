<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getItemById, purchaseItem, toggleItemState, getItemVersions, getPurchasedItems, type Item } from '@/api/items'
import { useAuthStore } from '@/stores/auth'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import message from '@/components/msg'
import MessageBox from '@/components/msgbox'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const item = ref<Item | null>(null)
const versions = ref<Item[]>([])
const myPurchases = ref<Item[]>([])
const loading = ref(true)
const purchasing = ref(false)

const loadItem = async () => {
  loading.value = true
  try {
    const id = parseInt(route.params.id as string)
    const [itemRes, versionsRes, purchasesRes] = await Promise.all([
      getItemById(id),
      getItemVersions(id),
      authStore.isAuthenticated ? getPurchasedItems() : Promise.resolve({ data: [] })
    ])
    item.value = itemRes.data
    versions.value = versionsRes.data
    myPurchases.value = (purchasesRes as any).data || []
  } catch (error) {
    console.error('Failed to load item:', error)
    message.error('加载作品详情失败')
  } finally {
    loading.value = false
  }
  await nextTick()
  if (item.value?.code) {
    highlightCode()
  }
}

// Watch for route changes (when switching versions via same component)
watch(() => route.params.id, (newId) => {
  if (newId) {
    loadItem()
  }
})

const highlightCode = () => {
  document.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block as HTMLElement)
  })
}

const isPurchased = computed(() => {
  if (!item.value || !authStore.isAuthenticated) return false
  return myPurchases.value.some(p => p.id === item.value!.id)
})

const ownedVersionOfSameProject = computed(() => {
  if (!item.value || !authStore.isAuthenticated) return null
  return myPurchases.value.find(p => 
    p.name === item.value!.name && 
    p.type === item.value!.type && 
    p.author.id === item.value!.author.id
  )
})

const isAuthor = computed(() => {
  if (!item.value || !authStore.isAuthenticated) return false
  return item.value.author?.id === authStore.user?.id
})

const doPurchase = async () => {
  if (!authStore.isAuthenticated) {
    message.error('请先登录')
    router.push('/login')
    return
  }
  
  if (purchasing.value) return

  const owned = ownedVersionOfSameProject.value
  if (owned) {
    const isUpdate = (item.value!.version || 1) > (owned.version || 1)
    const confirmed = await MessageBox.confirm(
      `检测到您已拥有版本 v${owned.version || 1}，是否免费${isUpdate ? '升级' : '切换'}到版本 v${item.value!.version || 1}？`,
      isUpdate ? '发现新版本' : '切换版本'
    )
    if (!confirmed) return
  } else if (item.value!.price > 0) {
    const confirmed = await MessageBox.confirm(
      `确定消耗 ${item.value!.price} 积分购买 "${item.value!.name}" 吗？`,
      '确认购买'
    )
    if (!confirmed) return
  }
  
  purchasing.value = true
  try {
    await purchaseItem(item.value!.id)
    message.success(owned ? '切换成功！' : '购买成功！')
    await loadItem()
  } catch (error: any) {
    console.error('Purchase failed:', error)
  } finally {
    purchasing.value = false
  }
}

const copyCode = () => {
  if (item.value?.code) {
    navigator.clipboard.writeText(item.value.code)
    message.success('代码已复制到剪贴板')
  }
}

const toggleEnabled = async () => {
  if (!item.value) return
  const newState = !item.value.isEnabled
  try {
    await toggleItemState(item.value.id, newState)
    item.value.isEnabled = newState
    message.success(`${item.value.name} 已${newState ? '启用' : '禁用'}`)
  } catch (error) {
    console.error('Failed to toggle state:', error)
  }
}

onMounted(() => {
  loadItem()
})
</script>

<template>
  <div class="p-4 max-w-6xl mx-auto space-y-8">
    <!-- Back Button -->
    <button @click="router.back()" class="btn btn-ghost btn-sm gap-2 opacity-60 hover:opacity-100">
      <Icon icon="mdi:arrow-left" class="w-4 h-4" />
      返回
    </button>

    <div v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-dots loading-lg text-primary"></span>
    </div>

    <div v-else-if="!item" class="text-center py-20 opacity-50">
      <p>找不到该作品</p>
    </div>

    <div v-else class="space-y-8">
      <!-- Item Header -->
      <div class="bg-base-100 border border-base-200 rounded-3xl p-8 shadow-sm">
        <div class="flex flex-col md:flex-row gap-8 items-start">
          <!-- Icon -->
          <div class="w-24 h-24 rounded-3xl flex items-center justify-center shrink-0"
               :class="item.type === 'extension' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'">
            <Icon :icon="item.type === 'extension' ? 'mdi:code-tags' : 'mdi:palette-outline'" class="w-12 h-12" />
          </div>

          <!-- Info -->
          <div class="flex-1 space-y-4">
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="text-3xl font-black tracking-tight">{{ item.name }}</h1>
              <div v-if="versions.length > 1" class="dropdown">
                <label tabindex="0" class="badge pr-1 pl-2 badge-lg badge-primary cursor-pointer gap-1 transition-all hover:brightness-110">
                  v{{ item.version || 1 }}
                  <Icon icon="mdi:chevron-down" class="w-4 h-4" />
                </label>
                <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow-2xl bg-base-200 rounded-2xl w-32 mt-2 border border-base-300">
                  <li v-for="v in versions" :key="v.id">
                    <a @click="router.push(`/item/${v.id}`)" 
                       class="rounded-xl font-bold py-2"
                       :class="v.id === item.id ? 'bg-primary text-primary-content' : 'hover:bg-primary/20'">
                      v{{ v.version || 1 }}
                      <span v-if="v.id === item.id" class="text-[10px] lowercase opacity-60">(当前)</span>
                    </a>
                  </li>
                </ul>
              </div>
              <span v-else class="badge badge-lg badge-ghost font-medium">v{{ item.version || 1 }}</span>
              <span class="badge badge-lg border-none" :class="item.type === 'extension' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'">
                {{ item.type === 'extension' ? '插件' : '主题' }}
              </span>
            </div>
            
            <p class="text-lg text-base-content/70 leading-relaxed">{{ item.description }}</p>
            
            <div class="flex flex-wrap items-center gap-6 pt-2">
              <router-link :to="`/user/${item.author?.username}`" class="flex items-center gap-2 hover:text-primary transition-colors">
                <div class="avatar">
                  <div class="w-8 h-8 rounded-full">
                    <img :src="item.author?.avatar" alt="Author Avatar" />
                  </div>
                </div>
                <span class="text-sm font-medium">{{ item.author?.username }}</span>
              </router-link>
              <div class="flex items-center gap-2 text-sm opacity-50">
                <Icon icon="mdi:calendar" class="w-4 h-4" />
                {{ new Date(item.createdAt).toLocaleDateString() }}
              </div>
              <div class="flex items-center gap-2 text-sm opacity-50">
                <Icon icon="mdi:download-outline" class="w-4 h-4" />
                {{ item.purchasedBy?.length || 0 }} 次获取
              </div>
            </div>
          </div>

          <!-- Action -->
          <div class="flex flex-col gap-3 w-full md:w-48">
            <div class="p-4 bg-base-200/50 rounded-2xl text-center mb-2">
              <div class="text-xs opacity-50 uppercase font-black tracking-widest mb-1">价格</div>
              <div class="text-2xl font-black text-primary" v-if="!isPurchased">
                {{ item.price > 0 ? `${item.price} 积分` : '免费' }}
              </div>
              <div class="text-xl font-black text-success flex items-center justify-center gap-1" v-else>
                <Icon icon="mdi:check-circle" class="w-5 h-5" />
                已拥有
              </div>
            </div>

            <button v-if="!isPurchased" 
                    @click="doPurchase" 
                    :disabled="purchasing"
                    class="btn btn-primary btn-block rounded-xl h-12">
              <span v-if="purchasing" class="loading loading-spinner loading-xs"></span>
              {{ item.price > 0 ? '立即购买' : '免费获取' }}
            </button>
            <div v-else class="space-y-3">
              <div class="bg-base-200/50 p-3 rounded-xl flex items-center justify-between">
                <span class="text-xs font-bold opacity-60">运行状态</span>
                <input type="checkbox" 
                       class="toggle toggle-sm toggle-primary" 
                       :checked="item.isEnabled" 
                       @change="toggleEnabled" />
              </div>
              <button v-if="item.code" 
                      @click="copyCode" 
                      class="btn btn-primary btn-outline btn-block rounded-xl h-12">
                <Icon icon="mdi:content-copy" class="w-4 h-4 mr-2" />
                复制代码
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Code Section (Only if purchased/author) -->
      <div v-if="(isPurchased || isAuthor) && item.code" class="space-y-4">
        <div class="flex items-center justify-between px-2">
          <h2 class="text-xl font-bold flex items-center gap-2">
            <Icon icon="mdi:xml" class="text-primary" />
            源码内容
          </h2>
          <div class="badge badge-ghost uppercase text-[10px] font-black tracking-widest">{{ item.language }}</div>
        </div>
        <div class="rounded-3xl overflow-hidden border border-base-200 bg-[#0d1117] relative group">
          <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
             <button @click="copyCode" class="btn btn-sm btn-circle btn-primary">
                <Icon icon="mdi:content-copy" class="w-4 h-4" />
             </button>
          </div>
          <pre class="p-6 overflow-x-auto text-sm leading-relaxed">
            <code :class="`language-${item.language}`">{{ item.code }}</code>
          </pre>
        </div>
      </div>
      
      <!-- Preview/Placeholder for non-purchased -->
      <div v-else-if="!isPurchased" class="bg-base-200/30 rounded-3xl p-12 text-center border-2 border-dashed border-base-200">
         <Icon icon="mdi:lock-outline" class="w-12 h-12 mx-auto mb-4 opacity-20" />
         <h3 class="text-lg font-bold opacity-40">获取后即可查看源码</h3>
         <p class="text-sm opacity-30 mt-2">支持 {{ item.language }} 格式的高亮代码预览</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
pre {
  margin: 0;
  background: transparent !important;
}
</style>
