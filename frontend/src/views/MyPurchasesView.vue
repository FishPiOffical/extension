<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getPurchasedItems, toggleItemState, getItems, purchaseItem, setAutoUpdate, removePurchaseItem } from '@/api/items'
import message from '@/components/msg'
import MessageBox from '@/components/msgbox'
import { useDependencyCheck } from '@/utils/hooks'
import UrlRulesModal from '@/components/UrlRulesModal.vue'
import { useAuthStore } from '@/stores/auth'

const { checkDependencies } = useDependencyCheck()
const router = useRouter()
const authStore = useAuthStore()
const items = ref<any[]>([])
const latestItems = ref<any[]>([])
const loading = ref(true)
const showUrlRules = ref(false)
const urlRulesItem = ref<any | null>(null)

const openUrlRules = (item?: any) => {
  urlRulesItem.value = item || null
  showUrlRules.value = true
}

const loadPurchasedItems = async () => {
  loading.value = true
  try {
    const [purchasedRes, latestRes] = await Promise.all([
      getPurchasedItems(),
      getItems()
    ])
    items.value = purchasedRes.data
    latestItems.value = latestRes.data.items || latestRes.data
  } catch (error) {
    console.error('Failed to load purchased items:', error)
    message.error('加载已购项目失败')
  }
  loading.value = false
}

const getLatestVersion = (item: any) => {
  return latestItems.value.find(l => 
    l.name === item.name && 
    l.type === item.type && 
    l.author.id === item.author.id
  )
}

const handleUpgrade = async (item: any, latest: any) => {
  const confirmed = await MessageBox.confirm(
    `检测到新版本 v${latest.version || 1}，是否通过免费升级从当前版本 v${item.version || 1} 升级？`,
    '版本升级'
  )
  if (!confirmed) return

  if (!await checkDependencies(latest, {
    title: '运行依赖提示',
    messagePrefix: `新版本 v${latest.version || 1} 运行有以下依赖，请确保它们已启用`,
    messageSuffix: '是否继续升级？'
  })) return

  try {
    if (item.author?.id === authStore.user?.id) {
      await toggleItemState(latest.id, true)
    } else {
      await purchaseItem(latest.id)
    }
    message.success('升级成功')
    await loadPurchasedItems()
  } catch (error: any) {
    console.error('Upgrade failed:', error)
  }
}

const toggleAutoUpdate = async (item: any) => {
  const newState = !item.isAutoUpdate
  try {
    const res = await setAutoUpdate(item.id, newState)
    if (res.data) {
      item.isAutoUpdate = res.data.isAutoUpdate
      message.success(`${item.name} 自动更新已${item.isAutoUpdate ? '开启' : '关闭'}`)
    }
  } catch (error) {
    console.error('Failed to toggle auto update:', error)
  }
}

const toggleEnabled = async (item: any) => {
  const newState = !item.isEnabled
  
  if (newState && !await checkDependencies(item, {
    messageSuffix: '是否继续启用？'
  })) return

  try {
    const res = await toggleItemState(item.id, newState)
    if (res.data) {
      item.isEnabled = res.data.isEnabled
      if (res.data.isAutoUpdate !== undefined) {
        item.isAutoUpdate = res.data.isAutoUpdate
      }
      message.success(`${item.name} 已${item.isEnabled ? '启用' : '禁用'}`)
    }
  } catch (error) {
    console.error('Failed to toggle state:', error)
  }
}

const handleRemove = async (item: any) => {
  const isAuthor = item.author?.id === authStore.user?.id
  let warningMsg = isAuthor
    ? `卸载 <b>${item.name}</b>？`
    : `确定要从账号中移除 <b class="text-error">${item.name}</b> 吗？<br><br>移除后您将无法继续使用此${item.type === 'extension' ? '扩展' : '主题'}以及获得相关更新。`
  if (!isAuthor && item.price && item.price > 0) {
    warningMsg += `<br><br><span class="text-error font-bold">警告：此为付费项目，移除后购买费用（ ${item.price} 积分 ）将不会退回！重新获取将需再次付费！</span>`
  }

  const confirmed = await MessageBox.confirm(warningMsg, '移除确认', {
    confirmButtonText: '确定移除',
    cancelButtonText: '取消',
    type: 'error',
    dangerouslyUseHTMLString: true
  } as any)
  
  if (!confirmed) return

  try {
    await removePurchaseItem(item.id)
    message.success(isAuthor ? '已卸载' : '移除成功')
    await loadPurchasedItems()
  } catch (error: any) {
    console.error('Remove failed:', error)
    message.error(error.response?.data?.msg || '移除失败')
  }
}

onMounted(() => {
  loadPurchasedItems()
})
</script>

<template>
  <div class="p-4 space-y-6">
    <!-- Unified Header -->
    <header class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-base-100 p-6 rounded-2xl border border-base-200">
      <div class="flex items-center gap-4 min-w-0">
        <div class="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary shrink-0">
          <Icon icon="mdi:bookmark-outline" class="h-6 w-6" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight flex items-center gap-3">
            已购项目
            <span class="badge badge-primary badge-soft font-bold rounded-lg">{{ items.length }}</span>
          </h1>
          <p class="text-xs text-base-content/50 mt-1">管理已获取的扩展与主题</p>
        </div>
      </div>
      <button class="btn btn-outline btn-sm shrink-0" @click="openUrlRules()">
        <Icon icon="mdi:web-cog" class="w-4 h-4" />
        网址设置
      </button>
    </header>

    <div v-if="loading" class="flex justify-center py-32">
      <div class="loading loading-dots loading-lg text-primary"></div>
    </div>

    <div v-else>
      <div v-if="items.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div v-for="item in items" :key="item.id" 
          @click="router.push(`/item/${item.id}`)"
          class="group bg-base-200 border border-base-200 rounded-xl hover:border-primary/20 hover:shadow-lg transition-all duration-300 flex flex-col p-5 cursor-pointer"
          :class="{'opacity-60 grayscale-[0.5]': !item.isEnabled}">
          
          <div class="flex items-start gap-4 mb-4">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                  :class="item.type === 'extension' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'">
              <Icon :icon="item.type === 'extension' ? 'mdi:code-tags' : 'mdi:palette-outline'" class="w-7 h-7" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="font-bold text-base truncate">{{ item.name }}</h2>
              <router-link :to="`/user/${item.author?.username}`" @click.stop class="text-xs opacity-40 mt-1 hover:text-primary transition-colors block">@{{ item.author?.username }}</router-link>
            </div>
            <div class="flex flex-col items-end gap-2">
               <div class="flex flex-col gap-1 items-end">
                 <div class="badge font-black text-[8px] tracking-tight py-0 px-1.5 border-none">
                   v{{ item.version || 1 }}
                 </div>
                 <div v-if="item.status && item.status !== 'approved'" 
                      class="badge badge-warning badge-soft font-black text-[8px] tracking-tight py-0 px-1.5 border-none">
                   {{ item.status.toUpperCase() }}
                 </div>
               </div>
               
               <div class="flex items-center gap-2 mt-1">
                 <div v-if="item.type === 'extension' || item.type === 'theme'" @click.stop class="tooltip tooltip-left" data-tip="网址设置">
                   <button class="btn btn-ghost btn-xs btn-circle" @click="openUrlRules(item)">
                     <Icon icon="mdi:web-cog" class="w-4 h-4" />
                   </button>
                 </div>
                 <!-- Auto Update Checkbox -->
                 <div v-if="item.isEnabled" @click.stop class="tooltip tooltip-left" data-tip="自动更新">
                   <input type="checkbox" 
                          class="toggle toggle-xs toggle-success" 
                          :checked="item.isAutoUpdate" 
                          @change="toggleAutoUpdate(item)" />
                 </div>
                 <!-- Toggle Switch -->
                 <div @click.stop class="tooltip tooltip-left" :data-tip="item.isEnabled ? '已启用' : '已禁用'">
                   <input type="checkbox" 
                          class="toggle toggle-xs toggle-primary" 
                          :checked="item.isEnabled" 
                          @change="toggleEnabled(item)" />
                 </div>
               </div>
            </div>
          </div>

          <p class="text-sm text-base-content/70 line-clamp-2 h-10 mb-5 leading-relaxed">
            {{ item.description || '暂无描述信息...' }}
          </p>

          <div class="flex items-center justify-between pt-4 border-t border-base-200 mt-auto">
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-bold opacity-30 uppercase tracking-widest">
                {{ new Date(item.acquiredAt || Date.now()).toLocaleDateString() }}
              </span>
              <div v-if="getLatestVersion(item) && (getLatestVersion(item).version || 1) > (item.version || 1)" 
                   @click.stop="handleUpgrade(item, getLatestVersion(item))"
                   class="badge badge-error badge-sm text-[9px] font-black cursor-pointer hover:scale-105 active:scale-95 transition-transform">
                有更新
              </div>
            </div>
            <span class="group">
              <!-- Remove Purchase Button -->
              <div @click.stop class="tooltip tooltip-left group-hover:inline hidden" data-tip="移除当前项目">
                <button @click="handleRemove(item)" class="btn btn-ghost btn-xs btn-circle text-error/50 hover:text-error hover:bg-error/10">
                  <Icon icon="mdi:trash-can-outline" />
                </button>
              </div>

              <span class="text-[10px] font-black uppercase tracking-widest" :class="item.isEnabled ? 'text-success' : 'text-base-content/30 italic'">
                {{ item.isEnabled ? '已启用' : '已禁用' }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div v-else class="card bg-base-100 border border-dashed border-base-300 py-32 flex flex-col items-center">
        <div class="w-20 h-20 bg-base-200 rounded-3xl flex items-center justify-center mb-6">
          <Icon icon="mdi:shopping-outline" class="opacity-20" :size="32" />
        </div>
        <h3 class="text-xl font-bold opacity-40 mb-2">库中空空如也</h3>
        <p class="text-sm text-base-content/30 mb-8">前往集市浏览并获取您中意的扩展与主题</p>
        <router-link to="/" class="btn btn-primary btn-outline px-8 rounded-xl font-bold">前往集市</router-link>
      </div>
    </div>

    <UrlRulesModal
      :open="showUrlRules"
      :item-id="urlRulesItem?.id"
      :title="urlRulesItem ? urlRulesItem.name : '网址设置'"
      @close="showUrlRules = false"
    />
  </div>
</template>

<style scoped>
</style>


<style scoped>
.scrollbar-style::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.scrollbar-style::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-style::-webkit-scrollbar-thumb {
  background: rgba(var(--bc), 0.1);
  border-radius: 4px;
}
pre code {
  background: transparent !important;
}
</style>
