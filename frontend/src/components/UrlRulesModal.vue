<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  getItemUrlRules,
  getUserUrlRules,
  setItemUrlRules,
  setUserUrlRules,
  type UrlRules,
} from '@/api/items'
import message from '@/components/msg'

const props = defineProps<{
  open: boolean
  itemId?: number
  title?: string
}>()

const emit = defineEmits<{
  close: []
  saved: [rules: UrlRules]
}>()

const allowUrls = ref('')
const blockUrls = ref('')
const loading = ref(false)
const saving = ref(false)

const toLines = (urls: string[] = []) => urls.join('\n')
const fromLines = (value: string) => [...new Set(value
  .split(/\r?\n/)
  .map(url => url.trim())
  .filter(Boolean))]

const loadRules = async () => {
  loading.value = true
  try {
    const response = props.itemId
      ? await getItemUrlRules(props.itemId)
      : await getUserUrlRules()
    allowUrls.value = toLines(response.data.allowUrls)
    blockUrls.value = toLines(response.data.blockUrls)
  } catch {
    emit('close')
  } finally {
    loading.value = false
  }
}

const save = async () => {
  const rules = {
    allowUrls: fromLines(allowUrls.value),
    blockUrls: fromLines(blockUrls.value),
  }
  saving.value = true
  try {
    const response = props.itemId
      ? await setItemUrlRules(props.itemId, rules)
      : await setUserUrlRules(rules)
    message.success('已保存')
    emit('saved', response.data)
    emit('close')
  } catch {
    // 请求层已显示错误。
  } finally {
    saving.value = false
  }
}

watch(() => props.open, open => {
  if (open) loadRules()
})
</script>

<template>
  <dialog :class="['modal modal-bottom sm:modal-middle', { 'modal-open': open }]">
    <div class="modal-box w-full max-w-xl rounded-lg p-0 overflow-hidden">
      <header class="flex items-center justify-between px-5 py-4 border-b border-base-200">
        <h2 class="font-bold text-lg">{{ title || '网址设置' }}</h2>
        <button class="btn btn-ghost btn-sm btn-circle" title="关闭" @click="emit('close')">
          <Icon icon="mdi:close" class="w-5 h-5" />
        </button>
      </header>

      <div v-if="loading" class="h-72 flex items-center justify-center">
        <span class="loading loading-spinner loading-md"></span>
      </div>

      <form v-else class="p-5 space-y-5" @submit.prevent="save">
        <label class="form-control block">
          <span class="label-text font-bold mb-2 block">白名单</span>
          <textarea
            v-model="allowUrls"
            class="textarea textarea-bordered w-full h-28 font-mono text-xs leading-relaxed resize-y"
            placeholder="https://fishpi.cn/*"
          ></textarea>
        </label>

        <label class="form-control block">
          <span class="label-text font-bold mb-2 block">黑名单</span>
          <textarea
            v-model="blockUrls"
            class="textarea textarea-bordered w-full h-28 font-mono text-xs leading-relaxed resize-y"
            placeholder="/admin/*"
          ></textarea>
        </label>

        <footer class="flex justify-end gap-2 pt-1">
          <button type="button" class="btn" @click="emit('close')">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="loading loading-spinner loading-xs"></span>
            保存
          </button>
        </footer>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button" @click="emit('close')">关闭</button>
    </form>
  </dialog>
</template>
