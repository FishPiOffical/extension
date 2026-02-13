<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { uploadItem, getMyPublishedItems, getMyDrafts, updateDraft, publishDraft, type Item } from '@/api/items'
import Message from '@/components/msg'

const router = useRouter()
const route = useRoute()

const mode = ref<'new' | 'upgrade'>('new')
const myItems = ref<Item[]>([])
const selectedItemId = ref<number | null>(null)
const editingDraftId = ref<number | null>(null)

const name = ref('')
const description = ref('')
const price = ref(0)
const code = ref('')
const language = ref('javascript')
const type = ref<'extension' | 'theme'>('extension')
const uploading = ref(false)
const error = ref('')
const showFullScreenCode = ref(false)

const upgradeableItems = computed(() => {
  // Only APPROVED items that don't have a PENDING or DRAFT upgrade
  return myItems.value.filter(item => {
    if (item.status !== 'approved') return false
    // Check if any other item in myItems has upgradeFrom === item.id
    const hasActiveUpgrade = myItems.value.some(other => {
      const parentId = typeof other.upgradeFrom === 'object' ? (other.upgradeFrom as any)?.id : other.upgradeFrom
      return parentId === item.id && (other.status === 'pending' || other.status === 'draft')
    })
    return !hasActiveUpgrade
  })
})

onMounted(async () => {
  try {
    const res = await getMyPublishedItems()
    myItems.value = res.data
  } catch(e) { console.error(e) }

  // Check if upgrading from an item
  const upgradeFromId = route.query.upgradeFromId
  if (upgradeFromId) {
    mode.value = 'upgrade'
    selectedItemId.value = parseInt(upgradeFromId as string)
  }

  // Check if editing a draft
  const draftId = route.query.draftId
  if (draftId) {
    try {
      const draftsRes = await getMyDrafts()
      const draft = draftsRes.data.find((d: Item) => d.id === parseInt(draftId as string))
      if (draft) {
        editingDraftId.value = draft.id
        name.value = draft.name
        description.value = draft.description
        price.value = draft.price
        type.value = draft.type
        language.value = draft.language
        code.value = draft.code
      }
    } catch(e) { console.error(e) }
  }
})

watch(selectedItemId, (newId) => {
  if (newId) {
    const item = myItems.value.find(i => i.id === newId)
    if (item) {
      name.value = item.name
      description.value = item.description
      price.value = item.price || 0
      type.value = item.type
      language.value = item.language
      code.value = item.code || ''
    }
  }
})

const handleSubmit = async (isDraft: boolean = false) => {
  if (!isDraft && !code.value) {
    error.value = '请输入代码内容'
    return
  }

  uploading.value = true
  error.value = ''

  try {
    if (editingDraftId.value) {
      // Update existing draft
      await updateDraft(editingDraftId.value, {
        name: name.value,
        description: description.value,
        price: price.value,
        type: type.value,
        code: code.value,
        language: language.value,
      })
      
      if (isDraft) {
        Message.success('草稿已更新！')
      } else {
        await publishDraft(editingDraftId.value)
        Message.success('发布成功！作品已进入审核流程。')
        router.push('/my-works')
      }
    } else {
      // Create new item
      await uploadItem({
        name: name.value,
        description: description.value,
        price: price.value,
        type: type.value,
        code: code.value,
        language: language.value,
        upgradeFromId: mode.value === 'upgrade' && selectedItemId.value ? selectedItemId.value : undefined,
        isDraft,
      })

      if (isDraft) {
        Message.success('草稿已保存！')
        router.push('/my-works')
      } else {
        Message.success('发布成功！作品已进入审核流程。')
        router.push('/my-works')
      }
    }
  } catch (err: any) {
    error.value = err.response?.data?.msg || err.message || '操作失败'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto p-4">
    <div class="flex flex-col md:flex-row gap-12 items-start">
      <!-- Title Section -->
      <div class="md:w-1/3 sticky top-32">
        <div class="w-16 h-16 bg-secondary text-secondary-content rounded-3xl flex items-center justify-center mb-8 opacity-70">
          <Icon icon="mdi:code-tags" class="h-8 w-8" />
        </div>
        <h1 class="text-4xl font-black tracking-tight text-base-content mb-4 uppercase">分享作品</h1>
        <p class="text-lg text-base-content/40 font-medium leading-relaxed">
          将您的创意带到社区。请确保您的代码清晰、无毒且对他人有益。
        </p>
        
        <div class="mt-12 space-y-6">
          <div class="flex items-center gap-4">
            <div class="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center text-[10px] font-black mt-1">1</div>
            <p class="text-sm font-bold text-base-content/60">完善作品名称与描述</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center text-[10px] font-black mt-1">2</div>
            <p class="text-sm font-bold text-base-content/60">选择正确的导出类型</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center text-[10px] font-black mt-1">3</div>
            <p class="text-sm font-bold text-base-content/60">粘贴您的代码内容</p>
          </div>
        </div>
      </div>

      <!-- Form Section -->
      <div class="md:flex-1 w-full">
        <div class="card p-10 bg-base-200">
          <div v-if="error" class="alert alert-error mb-8 rounded-2xl border-none font-bold text-sm">
            <span>{{ error }}</span>
          </div>

          <form @submit.prevent class="space-y-8">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <!-- Mode Selection -->
              <div class="form-control w-full md:col-span-2">
                <label class="label mb-2"><span class="text-xs font-black uppercase tracking-widest opacity-40">发布类型</span></label>
                <div class="flex gap-4">
                  <label class="label cursor-pointer justify-start gap-2">
                     <input type="radio" v-model="mode" value="new" class="radio radio-primary" />
                     <span class="label-text font-bold">新发布</span>
                  </label>
                  <label class="label cursor-pointer justify-start gap-2">
                     <input type="radio" v-model="mode" value="upgrade" class="radio radio-primary" />
                     <span class="label-text font-bold">升级版本</span>
                  </label>
                </div>
              </div>

              <!-- Item Selection for Upgrade -->
              <div v-if="mode === 'upgrade'" class="form-control w-full md:col-span-2">
                <label class="label mb-2"><span class="text-xs font-black uppercase tracking-widest opacity-40">选择要升级的作品</span></label>
                <select v-model="selectedItemId" class="select select-bordered w-full rounded-2xl border-base-300 bg-base-100 focus:border-primary px-6 h-14 font-bold">
                  <option :value="null" disabled>请选择...</option>
                  <option v-for="item in upgradeableItems" :key="item.id" :value="item.id">
                    {{ item.name }} (当前版本: v{{ item.version || 1 }})
                  </option>
                </select>
                <label class="label" v-if="selectedItemId">
                  <span class="label-text-alt text-success">升级后版本将变为: v{{ (myItems.find(i => i.id === selectedItemId)?.version || 1) + 1 }}</span>
                </label>
              </div>

              <div class="form-control w-full md:col-span-2">
                <label class="label mb-2"><span class="text-xs font-black uppercase tracking-widest opacity-40">作品名称</span></label>
                <input v-model="name" type="text" placeholder="例如: 极简黑色主题" class="input input-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 h-14 font-medium" required />
              </div>

              <div class="form-control w-full md:col-span-2">
                <label class="label mb-2"><span class="text-xs font-black uppercase tracking-widest opacity-40">功能描述</span></label>
                <textarea v-model="description" placeholder="简单介绍一下这个作品的功能..." class="textarea textarea-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 py-4 h-28 font-medium" required></textarea>
              </div>

              <div class="form-control w-full">
                <label class="label mb-2"><span class="text-xs font-black uppercase tracking-widest opacity-40">项目类型</span></label>
                <select v-model="type" class="select select-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 h-14 font-bold" @change="language = type === 'extension' ? 'javascript' : 'css'">
                  <option value="extension">功能扩展 (JavaScript)</option>
                  <option value="theme">视觉主题 (CSS)</option>
                </select>
              </div>

              <div class="form-control w-full">
                <label class="label mb-2"><span class="text-xs font-black uppercase tracking-widest opacity-40">设定积分价格</span></label>
                <input v-model.number="price" type="number" min="0" class="input input-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 h-14 font-bold" required />
              </div>

              <div class="form-control w-full md:col-span-2">
                <label class="label mb-2 flex justify-between">
                  <span class="text-xs font-black uppercase tracking-widest opacity-40">代码内容</span>
                  <span class="text-[10px] font-black uppercase tracking-widest text-primary">{{ language }}</span>
                </label>
                <div class="relative group">
                  <textarea 
                    v-model="code" 
                    placeholder="在此处粘贴您的源代码..." 
                    class="textarea textarea-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 py-6 h-80 font-mono text-sm leading-relaxed" 
                    required 
                  ></textarea>
                  <button 
                    type="button"
                    @click="showFullScreenCode = true"
                    class="absolute bottom-4 right-4 btn btn-circle btn-ghost opacity-0 group-hover:opacity-100 transition-opacity bg-base-200/50 hover:bg-base-200"
                    title="全屏编辑"
                  >
                    <Icon icon="mdi:magnify-plus-outline" class="w-5 h-5" />
                  </button>
                </div>
              </div>

              <!-- Full Screen Code Modal -->
              <dialog :class="['modal modal-bottom sm:modal-middle', { 'modal-open': showFullScreenCode }]">
                <div class="modal-box w-screen max-w-screen h-screen max-h-screen flex flex-col p-0 overflow-hidden rounded-3xl">
                  <div class="flex items-center justify-between px-8 py-4 bg-base-300/50 backdrop-blur-md">
                    <div class="flex items-center gap-3">
                      <Icon icon="mdi:code-braces" class="text-primary w-6 h-6" />
                      <h3 class="font-black uppercase tracking-tight text-sm">全屏代码编辑器</h3>
                      <span class="badge badge-primary badge-sm font-black">{{ language }}</span>
                    </div>
                    <button @click="showFullScreenCode = false" class="btn btn-circle btn-ghost btn-sm">
                      <Icon icon="mdi:close" class="w-5 h-5" />
                    </button>
                  </div>
                  <div class="flex-1 p-0 relative">
                    <textarea 
                      v-model="code" 
                      class="w-full h-full bg-base-100 focus:outline-none px-8 py-8 font-mono text-sm leading-relaxed resize-none"
                      placeholder="在此输入您的源代码..."
                    ></textarea>
                  </div>
                  <div class="p-6 bg-base-200/80 flex justify-end gap-4">
                    <button @click="showFullScreenCode = false" class="btn btn-primary rounded-xl px-12 font-black">完成</button>
                  </div>
                </div>
                <form method="dialog" class="modal-backdrop">
                  <button @click="showFullScreenCode = false">关闭</button>
                </form>
              </dialog>
            </div>

            <div class="pt-6 flex w-full gap-4 justify-end">
              <button 
                type="button" 
                @click="handleSubmit(true)"
                class="btn btn-outline btn-ghost h-14 rounded-2xl text-base font-bold uppercase tracking-widest active:scale-95 transition-all"
                :disabled="uploading"
              >
                <span v-if="uploading" class="loading loading-spinner"></span>
                {{ uploading ? '正在保存...' : '保存为草稿' }}
              </button>
              <button 
                type="submit" 
                @click="handleSubmit(false)"
                class="btn btn-primary h-14 rounded-2xl text-lg font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 transition-all"
                :disabled="uploading"
              >
                <span v-if="uploading" class="loading loading-spinner"></span>
                {{ uploading ? '正在提交...' : '发布并提交审核' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
