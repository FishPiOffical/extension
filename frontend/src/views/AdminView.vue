<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { getPendingItems, reviewItem } from '@/api/items'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import Message from '@/components/msg'
import { CodeDiff } from 'v-code-diff'

const items = ref<any[]>([])
const loading = ref(true)
const selectedItem = ref<any>(null)
const reviewComment = ref('')
const viewMode = ref<'code' | 'diff'>('code')

const hasHistory = computed(() => !!selectedItem.value?.upgradeFrom)

const loadPendingItems = async () => {
  loading.value = true
  try {
    const response = await getPendingItems()
    items.value = response.data
  } catch (error) {
    console.error('Failed to load pending items:', error)
  }
  loading.value = false
}

const openReviewModal = async (item: any) => {
  selectedItem.value = item
  reviewComment.value = ''
  viewMode.value = item.upgradeFrom ? 'diff' : 'code'
  await nextTick()
  const block = document.querySelector('.modal pre code')
  if (block) {
    hljs.highlightElement(block as HTMLElement)
  }
}

const review = async (itemId: number, status: 'approved' | 'rejected') => {
  try {
    if (status === 'rejected' && !reviewComment.value) {
      Message.error('拒绝时必须填写原因')
      return
    }
    await reviewItem(itemId, { status, comment: reviewComment.value || undefined })
    Message.success('审核操作已完成')
    selectedItem.value = null
    await loadPendingItems()
  } catch (error: any) {
    console.error('Review failed:', error)
    Message.error(error.response?.data?.msg || error.message || '审核失败')
  }
}

onMounted(() => {
  loadPendingItems()
})
</script>

<template>
  <div class="max-w-6xl mx-auto py-12 px-4 pb-32">
    <div class="flex flex-col md:flex-row justify-between items-end mb-16 px-4 gap-6">
      <div class="max-w-xl">
        <h1 class="text-4xl font-black tracking-tighter text-base-content uppercase leading-none mb-4">审核控制台</h1>
        <p class="text-base-content/40 font-medium">请仔细审查社区提交的代码。确保没有恶意脚本、性能问题或违规内容。</p>
      </div>
      
      <div class="flex items-center gap-4 bg-base-100 p-3 rounded-2xl border border-base-200">
        <div class="text-right">
          <div class="text-[10px] font-black opacity-30 uppercase tracking-tighter">待处理任务</div>
          <div class="text-xl font-black text-primary">{{ items.length }}</div>
        </div>
        <button @click="loadPendingItems" class="btn btn-ghost btn-sm rounded-xl">
           <Icon icon="mdi:refresh" class="h-4 w-4" />
        </button>
      </div>
    </div>
    
    <div v-if="loading" class="flex justify-center py-32">
      <div class="loading loading-spinner loading-lg text-primary opacity-20"></div>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="item in items" :key="item.id" 
           @click="openReviewModal(item)"
           class="bg-base-100 border border-base-200 rounded-3xl p-6 hover:border-primary/40 hover:shadow-xl transition-all cursor-pointer group">
        <div class="flex items-start justify-between mb-4">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center bg-base-200 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <Icon :icon="item.type === 'extension' ? 'mdi:code-tags' : 'mdi:palette-outline'" class="w-6 h-6" />
          </div>
          <div class="badge badge-warning badge-sm font-black uppercase tracking-tight py-3">Pending</div>
        </div>
        
        <h3 class="text-xl font-black tracking-tight mb-2 line-clamp-1">{{ item.name }}</h3>
        <p class="text-sm text-base-content/50 line-clamp-2 mb-6 font-medium leading-relaxed">{{ item.description }}</p>
        
        <div class="flex items-center justify-between pt-4 border-t border-base-200">
          <div class="flex items-center gap-2">
            <div class="text-[10px] font-black opacity-30 uppercase tracking-widest">By</div>
            <div class="text-xs font-bold">{{ item.author?.username }}</div>
          </div>
          <div class="text-xs font-black text-primary">v{{ item.version || 1 }}</div>
        </div>
      </div>

      <div v-if="items.length === 0" class="col-span-full flex flex-col items-center justify-center py-32 bg-base-100/50 border border-dashed border-base-200 rounded-[3rem] mx-4">
        <div class="w-16 h-16 bg-base-200 rounded-2xl flex items-center justify-center mb-6 text-base-content/20">
          <Icon icon="mdi:check-all" class="h-8 w-8" />
        </div>
        <p class="text-base-content/20 text-lg font-black uppercase tracking-widest italic">All caught up!</p>
      </div>
    </div>

    <!-- Review Modal -->
    <dialog :class="['modal modal-bottom sm:modal-middle', { 'modal-open': selectedItem }]">
      <div v-if="selectedItem" class="modal-box w-screen max-w-screen h-screen max-h-screen p-0 flex flex-col overflow-hidden rounded-[2.5rem]">
        <div class="flex items-center justify-between px-8 py-6 bg-base-200/50 backdrop-blur-md border-b border-base-300">
           <div class="flex items-center gap-4">
             <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon :icon="selectedItem.type === 'extension' ? 'mdi:code-tags' : 'mdi:palette-outline'" class="w-6 h-6" />
             </div>
             <div>
               <h3 class="font-black text-lg leading-none">{{ selectedItem.name }}</h3>
               <p class="text-[10px] font-black uppercase tracking-tighter opacity-30 mt-1">审核详情 v{{ selectedItem.version }}</p>
             </div>
           </div>
           <button @click="selectedItem = null" class="btn btn-circle btn-ghost btn-sm">
             <Icon icon="mdi:close" class="h-6 w-6" />
           </button>
        </div>

        <div class="flex-1 overflow-auto p-8 lg:p-12">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <!-- Details Column -->
            <div class="lg:col-span-4 space-y-8">
               <section>
                 <div class="text-[10px] font-black uppercase tracking-widest opacity-30 mb-3">项目介绍</div>
                 <p class="text-base-content/70 font-medium leading-relaxed">{{ selectedItem.description }}</p>
               </section>

               <div class="grid grid-cols-2 gap-6 py-8 border-y border-base-200">
                  <div>
                    <div class="text-[10px] uppercase font-black opacity-30 tracking-widest mb-1">价格</div>
                    <div class="font-black text-sm">{{ selectedItem.price ? selectedItem.price + ' 积分' : '免费' }}</div>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase font-black opacity-30 tracking-widest mb-1">提交时间</div>
                    <div class="font-bold text-sm">{{ new Date(selectedItem.createdAt).toLocaleDateString() }}</div>
                  </div>
                  <div class="col-span-2">
                    <div class="text-[10px] uppercase font-black opacity-30 tracking-widest mb-1">作者</div>
                    <div class="flex items-center gap-2">
                       <img :src="selectedItem.author?.avatar" class="w-6 h-6 rounded-full" />
                       <span class="font-bold text-sm">{{ selectedItem.author?.username }}</span>
                    </div>
                  </div>
               </div>

               <section class="space-y-4">
                 <div class="text-[10px] font-black uppercase tracking-widest opacity-30">审核回复</div>
                 <textarea 
                   v-model="reviewComment" 
                   placeholder="填写通过备注或拒绝原因..." 
                   class="textarea textarea-bordered w-full h-32 rounded-2xl bg-base-200/50 border-base-300 focus:border-primary px-4 py-3 text-sm font-medium"
                 ></textarea>
                 <div class="flex gap-3">
                   <button @click="review(selectedItem.id, 'approved')" class="btn btn-success flex-1 rounded-2xl font-black uppercase tracking-widest  shadow-lg shadow-success/20">通过</button>
                   <button @click="review(selectedItem.id, 'rejected')" class="btn btn-error btn-outline border-2 flex-1 rounded-2xl font-black uppercase tracking-widest">拒绝申请</button>
                 </div>
               </section>
            </div>

            <!-- Code Column -->
            <div class="lg:col-span-8">
               <div class="bg-base-200 p-2 rounded-3xl border border-base-300">
                  <div class="bg-base-300 p-4 rounded-t-2xl flex justify-between items-center border-b border-base-content/5">
                    <div class="flex items-center gap-4">
                      <span class="text-[10px] font-black uppercase tracking-widest opacity-40">源代码 ({{ selectedItem.language }})</span>
                      <div v-if="hasHistory" class="join">
                        <button 
                          @click="viewMode = 'code'" 
                          class="join-item btn btn-xs border-none" 
                          :class="viewMode === 'code' ? 'btn-primary' : 'btn-soft'"
                        >最新代码</button>
                        <button 
                          @click="viewMode = 'diff'" 
                          class="join-item btn btn-xs border-none" 
                          :class="viewMode === 'diff' ? 'btn-primary' : 'btn-soft'"
                        >版本比对</button>
                      </div>
                    </div>
                    <div class="flex gap-1.5">
                      <div class="w-2.5 h-2.5 rounded-full bg-error/20"></div>
                      <div class="w-2.5 h-2.5 rounded-full bg-warning/20"></div>
                      <div class="w-2.5 h-2.5 rounded-full bg-success/20"></div>
                    </div>
                  </div>
                  <div class="rounded-b-2xl overflow-hidden">
                    <pre v-if="viewMode === 'code'" class="m-0 p-8 overflow-auto max-h-[70vh] text-xs font-mono leading-relaxed bg-[#0d1117]">
                      <code :class="'language-' + selectedItem.language">{{ selectedItem.code }}</code>
                    </pre>
                    <div v-else class="max-h-[70vh] overflow-auto bg-[#0d1117]">
                      <CodeDiff
                        :old-string="selectedItem.upgradeFrom?.code || ''"
                        :new-string="selectedItem.code"
                        :language="selectedItem.language"
                        output-format="side-by-side"
                        theme="dark"
                      />
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="selectedItem = null">close</button>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
pre code {
  background: transparent !important;
}
</style>
