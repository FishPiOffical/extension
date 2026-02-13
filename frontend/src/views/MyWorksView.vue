<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getMyPublishedItems, getMyDrafts, publishDraft, withdrawItem, deleteItem, type Item } from '@/api/items'
import Message from '@/components/msg'
import MessageBox from '@/components/msgbox'

const router = useRouter()
const authStore = useAuthStore()
const allItems = ref<Item[]>([])
const loading = ref(true)

const searchQuery = ref('')
const typeFilter = ref<'all' | 'extension' | 'theme'>('all')

const loadWorks = async () => {
  loading.value = true
  try {
    const [publishedRes, draftsRes] = await Promise.all([
      getMyPublishedItems(),
      getMyDrafts()
    ])
    // Merge everything
    const combined = [...publishedRes.data]
    draftsRes.data.forEach(d => {
      if (!combined.find(c => c.id === d.id)) combined.push(d)
    })
    allItems.value = combined
  } catch (error) {
    console.error('Failed to load works:', error)
  }
  loading.value = false
}

// Logic to group items by project
const groupedWorks = computed(() => {
  const groups: Record<number, Item[]> = {}
  
  const findRootId = (item: Item): number => {
    let curr = item
    while (curr.upgradeFromId) {
      const parent = allItems.value.find(i => i.id === curr.upgradeFromId)
      if (!parent) break
      curr = parent
    }
    return curr.id
  }

  allItems.value.forEach(item => {
    const rootId = findRootId(item)
    if (!groups[rootId]) groups[rootId] = []
    groups[rootId].push(item)
  })

  // Sort each group by version descending
  Object.keys(groups).forEach(rootId => {
    groups[Number(rootId)]?.sort((a, b) => (b.version || 1) - (a.version || 1))
  })

  let result = Object.entries(groups).map(([rootId, group]) => {
    const approved = group.find(i => i.status === 'approved')
    const pending = group.find(i => i.status === 'pending')
    const draft = group.find(i => i.status === 'draft')
    const rejected = group.filter(i => i.status === 'rejected')
    const history = group.filter(i => i.status === 'approved' && i.id !== approved?.id)
    
    // The "Display" item for the project list
    const mainItem = (approved || pending || draft || group[0])!
    
    return {
      rootId: Number(rootId),
      mainItem,
      items: group,
      hasPending: !!pending,
      hasDraft: !!draft,
      pendingItem: pending,
      draftItem: draft,
      history,
      rejected
    }
  }).filter(g => g.mainItem) // Filter out any groups that somehow ended up without a main item

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(g => g.mainItem?.name.toLowerCase().includes(q))
  }

  if (typeFilter.value !== 'all') {
    result = result.filter(g => g.mainItem?.type === typeFilter.value)
  }

  return result
})

const handleWithdraw = async (id: number) => {
  if (!await MessageBox.confirm('确定要撤回审核吗？撤回后将变为草稿。')) return
  try {
    await withdrawItem(id)
    await loadWorks()
  } catch (err: any) {
    Message.error(err.response?.data?.msg || '撤回失败')
  }
}

const handleDelete = async (id: number) => {
  if (!await MessageBox.confirm('确定要删除此草稿吗？此操作不可恢复。')) return
  try {
    await deleteItem(id)
    await loadWorks()
  } catch (err: any) {
    Message.error(err.response?.data?.msg || '删除失败')
  }
}

const handlePublish = async (id: number) => {
  if (!await MessageBox.confirm('确定要发布这个草稿吗？发布后将进入审核流程。')) return
  try {
    await publishDraft(id)
    Message.success('发布成功！作品已进入审核流程。')
    await loadWorks()
  } catch (err: any) {
    Message.error(err.response?.data?.msg || '发布失败')
  }
}

const editWork = (item: Item) => {
  if (item.status === 'draft') {
    router.push({ path: '/upload', query: { draftId: item.id.toString() } })
  } else {
    // Check if project already has a pending or draft update
    const project = groupedWorks.value.find(p => p.items.some(i => i.id === item.id))
    if (project?.hasPending || project?.hasDraft) {
      Message.warning('已有正在进行的升级或草稿，不能再次触发升级')
      return
    }
    router.push({ path: '/upload', query: { upgradeFromId: item.id.toString() } })
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'approved': return { text: '已上架', class: 'bg-success/10 text-success' }
    case 'pending': return { text: '审核中', class: 'bg-warning/10 text-warning' }
    case 'draft': return { text: '草稿', class: 'bg-base-300 text-base-content/50' }
    case 'rejected': return { text: '已拒绝', class: 'bg-error/10 text-error' }
    default: return { text: status, class: 'bg-base-200' }
  }
}

onMounted(() => {
  loadWorks()
})
</script>

<template>
  <div class="p-4 space-y-6">
    <!-- Header -->
    <header class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-base-100 p-6 rounded-2xl border border-base-200">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary shrink-0">
          <Icon icon="mdi:package-variant" class="h-6 w-6" />
        </div>
        <div>
          <h1 class="text-2xl font-bold tracking-tight flex items-center gap-3">
            我的作品
            <span class="badge badge-primary badge-soft font-bold rounded-lg">{{ groupedWorks.length }}</span>
            <router-link v-if="authStore.user" :to="`/user/${authStore.user.username}`" class="btn btn-xs btn-ghost gap-1 opacity-50 hover:opacity-100">
              <Icon icon="mdi:account-circle-outline" />
              查看公共主页
            </router-link>
          </h1>
          <p class="text-xs text-base-content/50 mt-0.5 whitespace-nowrap">管理您创建的所有作品及其版本</p>
        </div>
      </div>

      <div class="flex flex-col md:flex-row gap-3 flex-1 max-w-2xl lg:justify-end lg:items-center w-full">
        <div class="md:flex-1 input transition-all">
          <Icon icon="mdi:magnify" class="opacity-50" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索作品名称..."
            class="w-full"
          />
        </div>
        <div class="flex gap-2">
          <select v-model="typeFilter" class="select select-sm select-bordered bg-base-200/40 border-transparent focus:border-primary focus:bg-base-100 font-medium">
            <option value="all">全部类型</option>
            <option value="extension">扩展</option>
            <option value="theme">主题</option>
          </select>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <main v-if="loading" class="flex justify-center py-20">
      <span class="loading loading-dots loading-lg text-primary"></span>
    </main>

    <!-- Project List -->
    <main v-else-if="groupedWorks.length === 0" class="text-center py-20 opacity-50">
      <Icon icon="mdi:code-tags" class="h-16 w-16 mx-auto mb-4 opacity-30" />
      <p class="text-lg">暂无作品</p>
      <p class="text-sm text-base-content/60 mt-2">点击“分享作品”发布您的第一个创意</p>
    </main>

    <main v-else class="space-y-4">
      <div v-for="project in groupedWorks" :key="project.rootId" 
        class="bg-base-100 border border-base-200 rounded-3xl overflow-hidden hover:border-primary/20 transition-all flex flex-col md:flex-row items-center p-6 gap-8">
        
        <!-- Left: Project Icon -->
        <div class="w-20 h-20 rounded-3xl flex items-center justify-center shrink-0"
              :class="project.mainItem.type === 'extension' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'">
          <Icon :icon="project.mainItem.type === 'extension' ? 'mdi:code-tags' : 'mdi:palette-outline'" class="w-10 h-10" />
        </div>

        <!-- Middle: Info -->
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-3 mb-2">
            <h3 class="font-black text-xl truncate tracking-tight">{{ project.mainItem.name }}</h3>
            <span class="badge badge-sm font-bold opacity-50">{{ project.mainItem.type === 'extension' ? '插件' : '主题' }}</span>
            <div v-if="project.hasPending" class="badge badge-warning badge-sm font-black gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-warning-content animate-pulse"></span>
              待审核 v{{ project.pendingItem?.version }}
            </div>
            <div v-if="project.hasDraft" class="badge badge-ghost badge-sm font-black italic">
              草稿 v{{ project.draftItem?.version }}
            </div>
          </div>
          <p class="text-sm text-base-content/60 line-clamp-1 mb-4">{{ project.mainItem.description }}</p>
          
          <!-- Version History Pills -->
          <div class="flex flex-wrap gap-2 items-center">
             <span class="text-[10px] font-black uppercase text-base-content/30 tracking-widest mr-2">版本历史</span>
             <div v-for="item in project.items" :key="item.id" 
                  class="group/v relative py-1 px-3 bg-base-200/50 rounded-full flex items-center gap-2 hover:bg-base-200 transition-colors">
                <span class="text-[10px] font-black italic">v{{ item.version }}</span>
                <div class="w-1.5 h-1.5 rounded-full" :class="{
                  'bg-success': item.status === 'approved',
                  'bg-warning': item.status === 'pending',
                  'bg-error': item.status === 'rejected',
                  'bg-base-content/20': item.status === 'draft',
                }"></div>
                
                <!-- Expanded Hover Info / Actions -->
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 pb-2 hidden group-hover/v:block z-50">
                  <div class="bg-base-300 text-base-content p-3 rounded-2xl shadow-xl border border-base-200 w-64">
                    <div class="flex justify-between items-center mb-2">
                      <span class="text-xs font-black">v{{ item.version }} {{ getStatusBadge(item.status).text }}</span>
                      <span class="text-[10px] opacity-40">{{ new Date(item.createdAt).toLocaleDateString() }}</span>
                    </div>
                    <p v-if="item.reviewComment" class="text-[10px] bg-error/10 text-error p-2 rounded-lg mb-2">
                      拒绝理由: {{ item.reviewComment }}
                    </p>
                    <div class="flex gap-2">
                      <button v-if="item.status === 'approved'" @click="router.push(`/item/${item.id}`)" class="btn btn-xs btn-ghost bg-base-100 flex-1">详情</button>
                      <button v-if="item.status === 'draft'" @click="editWork(item)" class="btn btn-xs btn-primary flex-1">编辑</button>
                      <button v-if="item.status === 'draft'" @click="handlePublish(item.id)" class="btn btn-xs btn-success flex-1">发布</button>
                      <button v-if="item.status === 'draft'" @click="handleDelete(item.id)" class="btn btn-xs btn-error btn-outline flex-1">删除</button>
                      <button v-if="item.status === 'pending'" @click="handleWithdraw(item.id)" class="btn btn-xs btn-warning btn-outline flex-1">撤回</button>
                    </div>
                  </div>
                </div>
             </div>
          </div>
        </div>

        <!-- Right: Main Actions -->
        <div class="flex gap-3 md:flex-col lg:flex-row">
          <button v-if="project.mainItem.status === 'approved'" 
                  @click="editWork(project.mainItem)" 
                  class="btn btn-sm btn-outline px-6 rounded-xl font-black uppercase tracking-widest text-[10px]"
                  :disabled="project.hasPending || project.hasDraft">
            {{ project.hasPending || project.hasDraft ? '正在升级中' : '升级版本' }}
          </button>
          
          <button v-if="project.draftItem" @click="handlePublish(project.draftItem.id)" class="btn btn-sm btn-primary px-6 rounded-xl font-black uppercase tracking-widest text-[10px]">
            发布草稿 v{{ project.draftItem.version }}
          </button>

          <button v-else-if="project.pendingItem" @click="handleWithdraw(project.pendingItem.id)" class="btn btn-sm btn-ghost bg-base-200 px-6 rounded-xl font-black uppercase tracking-widest text-[10px]">
            撤回审核
          </button>
        </div>
      </div>
    </main>
  </div>
</template>