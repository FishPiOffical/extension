<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getItemById, purchaseItem, toggleItemState, getItemVersions, getPurchasedItems, setAutoUpdate, type Item, getComments, addComment, blockComment, type Comment, reportComment } from '@/api/items'
import { useAuthStore } from '@/stores/auth'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import message from '@/components/msg'
import MessageBox from '@/components/msgbox'
import { useDependencyCheck } from '@/utils/hooks'

const { checkDependencies } = useDependencyCheck()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const item = ref<Item | null>(null)
const versions = ref<Item[]>([])
const myPurchases = ref<Item[]>([])
const loading = ref(true)
const purchasing = ref(false)

const comments = ref<Comment[]>([])
const commentContent = ref('')
const replyingTo = ref<Comment | null>(null)
const sendingComment = ref(false)

const loadItem = async () => {
  loading.value = true
  try {
    const id = parseInt(route.params.id as string)
    const [itemRes, versionsRes, purchasesRes, commentsRes] = await Promise.all([
      getItemById(id),
      getItemVersions(id),
      authStore.isAuthenticated ? getPurchasedItems() : Promise.resolve({ data: [] }),
      getComments(id)
    ])
    item.value = itemRes.data
    versions.value = versionsRes.data
    myPurchases.value = (purchasesRes as any).data || []
    comments.value = commentsRes.data
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

const submitComment = async () => {
  if (!commentContent.value.trim()) return
  if (!authStore.isAuthenticated) {
    message.error('请先登录')
    return
  }

  sendingComment.value = true
  try {
    await addComment(item.value!.id, commentContent.value, replyingTo.value?.id)
    commentContent.value = ''
    replyingTo.value = null
    message.success('回复成功')
    // Refresh comments
    const res = await getComments(item.value!.id)
    comments.value = res.data
  } catch (error) {
    message.error('回复失败')
  } finally {
    sendingComment.value = false
  }
}

const doBlockComment = async (id: number) => {
  if (!await MessageBox.confirm('确定要屏蔽此回复吗？这将对所有用户不可见。', '屏蔽确认')) return
  try {
    await blockComment(id)
    message.success('已屏蔽')
    const res = await getComments(item.value!.id)
    comments.value = res.data
  } catch (error) {
    message.error('操作失败')
  }
}

const doReportComment = async (id: number) => {
  if (!await MessageBox.confirm('确定要举报此评论吗？恶意举报可能会影响您的账号信誉。', '举报确认')) return
  try {
    await reportComment(id)
    message.success('举报成功，管理员将进行处理')
  } catch (error) {
    message.error('举报失败')
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
    window.location.href = '/api/auth/login'
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
  }
  
  if (!await checkDependencies(item.value!, {
    title: '确认为作品添加依赖',
    messagePrefix: '此作品运行需要以下依赖，请确保您已单独安装并切换到对应版本',
    messageSuffix: '是否继续安装当前作品？'
  })) return
  
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
  
  if (newState && !await checkDependencies(item.value, {
    messagePrefix: '此作品运行有以下依赖，请确保它们已启用',
    messageSuffix: '是否继续启用？'
  })) return

  try {
    await toggleItemState(item.value.id, newState)
    if (!isPurchased.value && isAuthor.value) {
      await loadItem()
    } else {
      item.value.isEnabled = newState
      if (item.value.isEnabled && item.value.isAutoUpdate === undefined) {
          // If enabling, we might want to check if auto-update is set?
          // The backend returns the new state.
          // Wait, toggleItemState returns { isEnabled, isAutoUpdate } now.
      }
      // Re-fetch item to be safe or update from response if possible.
      // The toggleItemState API returns { isEnabled, isAutoUpdate }
      // But here we are just awaiting it. Let's update it to use the response.
    }
    // We need to re-fetch or use response because enabling might change auto-update state (e.g. enabling old version disables auto-update)
    await loadItem() 
    
    message.success(`${item.value.name} 已${newState ? '启用' : '禁用'}`)
  } catch (error) {
    console.error('Failed to toggle state:', error)
  }
}

const toggleAutoUpdate = async () => {
  if (!item.value) return
  const newState = !item.value.isAutoUpdate
  try {
    const res = await setAutoUpdate(item.value.id, newState)
    if (res.data) {
      item.value.isAutoUpdate = res.data.isAutoUpdate
      message.success(`${item.value.name} 自动更新已${item.value.isAutoUpdate ? '开启' : '关闭'}`)
    }
  } catch (error) {
    console.error('Failed to toggle auto update:', error)
  }
}

const handleUseAuthorItem = async () => {
  if (!item.value) return
  if (!await checkDependencies(item.value, {
    title: '预览版本依赖提示',
    messagePrefix: '此预览版本具有以下依赖，请确保它们已启用',
    messageSuffix: '是否继续启用预览？'
  })) return
  try {
    await toggleItemState(item.value.id, true)
    message.success('已开始使用该版本（开发者模式）')
    await loadItem()
  } catch (error) {
    console.error('Failed to use author item:', error)
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
                <ul tabindex="0" class="dropdown-content z-1 menu p-2 shadow-2xl bg-base-200 rounded-2xl w-32 mt-2 border border-base-300">
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

            <div v-if="item.matchUrls && item.matchUrls.length > 0" class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-black uppercase tracking-widest opacity-40">生效网址:</span>
              <span v-for="url in item.matchUrls" :key="url" class="badge badge-sm badge-ghost opacity-60 font-mono">{{ url }}</span>
            </div>

            <div v-if="item.dependencies && item.dependencies.length > 0" class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-black uppercase tracking-widest opacity-40">依赖作品:</span>
              <router-link v-for="dep in item.dependencies" :key="dep.id" :to="`/item/${dep.id}`" 
                           class="badge badge-sm badge-primary badge-outline hover:bg-primary hover:text-primary-content transition-all font-bold">
                {{ dep.name }} (v{{ dep.version }})
              </router-link>
            </div>
            
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
                安装量 {{ item.purchaseCount }}
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

            <button v-if="!isPurchased && !isAuthor" 
                    @click="doPurchase" 
                    :disabled="purchasing"
                    class="btn btn-primary btn-block rounded-xl h-12">
              <span v-if="purchasing" class="loading loading-spinner loading-xs"></span>
              {{ item.price > 0 ? '立即购买' : '免费获取' }}
            </button>
            <div v-else-if="!isPurchased && isAuthor" class="space-y-3">
              <button @click="handleUseAuthorItem" 
                      class="btn btn-primary btn-block rounded-xl h-12">
                使用此版本
              </button>
              <button v-if="item.code" 
                      @click="copyCode" 
                      class="btn btn-primary btn-outline btn-block rounded-xl h-12">
                <Icon icon="mdi:content-copy" class="w-4 h-4 mr-2" />
                复制代码
              </button>
            </div>
            <div v-else class="space-y-3">
              <div class="bg-base-200/50 p-3 rounded-xl flex items-center justify-between">
                <span class="text-xs font-bold opacity-60">运行状态</span>
                <input type="checkbox" 
                       class="toggle toggle-sm toggle-primary" 
                       :checked="item.isEnabled" 
                       @change="toggleEnabled" />
              </div>
              <div v-if="item.isEnabled" class="bg-base-200/50 p-3 rounded-xl flex items-center justify-between">
                <span class="text-xs font-bold opacity-60">自动更新</span>
                <input type="checkbox" 
                       class="toggle toggle-sm toggle-success" 
                       :checked="item.isAutoUpdate" 
                       @change="toggleAutoUpdate" />
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

      <!-- Comments Section -->
      <div class="space-y-6 pt-8">
        <h2 class="text-2xl font-black border-b border-base-200 pb-4">
          评论回复 ({{ comments.length }})
        </h2>
        
        <!-- Comment Input -->
        <div v-if="authStore.isAuthenticated" class="bg-base-100 border border-base-200 p-6 rounded-3xl space-y-4">
          <div v-if="replyingTo" class="flex items-center justify-between text-sm px-4 py-2 bg-base-200 rounded-xl">
            <span>正在回复 <b>@{{ replyingTo.author.nickname || replyingTo.author.username }}</b></span>
            <button @click="replyingTo = null" class="btn btn-ghost btn-xs">取消回复</button>
          </div>
          <textarea v-model="commentContent" 
                    class="textarea textarea-bordered w-full h-24 rounded-2xl resize-none focus:textarea-primary"
                    :placeholder="replyingTo ? '请输入回复内容...' : '说说你的看法...'"></textarea>
          <div class="flex justify-end">
             <button @click="submitComment" 
                     :disabled="!commentContent.trim() || sendingComment"
                     class="btn btn-primary btn-sm rounded-xl px-6">
                {{ sendingComment ? '发送中...' : '提交回复' }}
             </button>
          </div>
        </div>
        <div v-else class="text-center py-8 bg-base-200/30 rounded-3xl border border-dashed border-base-200">
          <p class="text-base-content/50">请 <a href="/api/auth/login" class="text-primary link">登录</a> 后发表评论</p>
        </div>

        <!-- Comments List -->
        <div class="space-y-8">
          <div v-for="c in comments" :key="c.id" class="space-y-4">
            <!-- Main Comment -->
            <div class="flex gap-4">
              <img :src="c.author.avatar" class="w-10 h-10 rounded-xl shrink-0" alt="Avatar">
              <div class="flex-1 space-y-1">
                <div class="flex items-center gap-2">
                  <span class="font-bold">{{ c.author.nickname || c.author.username }}</span>
                  <span class="text-[10px] opacity-40 uppercase tracking-widest">{{ new Date(c.createdAt).toLocaleString() }}</span>
                  <div v-if="authStore.user?.isAdmin" class="ml-auto flex gap-2">
                    <div class="tooltip tooltip-left" data-tip="管理员屏蔽">
                      <button v-if="!c.isBlocked" @click="doBlockComment(c.id)" class="btn btn-ghost btn-xs btn-circle text-error">
                        <Icon icon="mdi:eye-off-outline" class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <div v-if="c.isBlocked" class="p-3 bg-base-200 rounded-2xl text-sm italic opacity-40">此条评论已被管理员屏蔽</div>
                <div v-else class="text-sm leading-relaxed whitespace-pre-wrap">{{ c.content }}</div>
                <div v-if="!c.isBlocked && authStore.isAuthenticated" class="flex gap-3">
                  <div class="tooltip tooltip-top" data-tip="回复TA">
                    <button @click="replyingTo = c" class="btn btn-ghost btn-xs btn-circle text-primary">
                      <Icon icon="mdi:reply" class="w-4 h-4" />
                    </button>
                  </div>
                  <div class="tooltip tooltip-top" data-tip="举报">
                    <button @click="doReportComment(c.id)" class="btn btn-ghost btn-xs btn-circle text-error/60">
                      <Icon icon="mdi:flag-outline" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <!-- Replies -->
                <div v-if="c.replies?.length" class="mt-4 space-y-4 border-l-2 border-base-200 ml-2 pl-6">
                  <div v-for="r in c.replies" :key="r.id" class="flex gap-3">
                     <img :src="r.author.avatar" class="w-8 h-8 rounded-lg shrink-0" alt="Avatar">
                     <div class="flex-1 space-y-1">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-sm">{{ r.author.nickname || r.author.username }}</span>
                          <span class="text-[9px] opacity-40 uppercase tracking-widest">{{ new Date(r.createdAt).toLocaleString() }}</span>
                          <div v-if="authStore.user?.isAdmin" class="ml-auto">
                            <div class="tooltip tooltip-left" data-tip="管理员屏蔽">
                              <button v-if="!r.isBlocked" @click="doBlockComment(r.id)" class="btn btn-ghost btn-xs btn-circle text-error">
                                <Icon icon="mdi:eye-off-outline" class="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                        <div v-if="r.isBlocked" class="p-2 bg-base-200 rounded-xl text-xs italic opacity-40">此条回复已被管理员屏蔽</div>
                        <div v-else class="text-xs leading-relaxed whitespace-pre-wrap">{{ r.content }}</div>
                        <div v-if="!r.isBlocked && authStore.isAuthenticated" class="flex gap-4">
                           <div class="tooltip tooltip-top" data-tip="举报">
                              <button @click="doReportComment(r.id)" class="btn btn-ghost btn-xs btn-circle text-error/60">
                                <Icon icon="mdi:flag-outline" class="w-3 h-3" />
                              </button>
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="comments.length === 0" class="text-center py-10 opacity-30">
            暂无评论，快来抢沙发吧~
          </div>
        </div>
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
