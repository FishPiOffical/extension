<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { uploadItem, getMyPublishedItems, getMyDrafts, getItems, updateDraft, publishDraft, type Item } from '@/api/items'
import Message from '@/components/msg'
import { Icon } from '@iconify/vue'

const router = useRouter()
const route = useRoute()

const mode = ref<'new' | 'upgrade'>('new')
const myItems = ref<Item[]>([])
const allApprovedItems = ref<Item[]>([])
const selectedItemId = ref<number | null>(null)
const editingDraftId = ref<number | null>(null)

const name = ref('')
const description = ref('')
const identifier = ref('')
const oldIdentifier = ref('')
const price = ref(0)
const code = ref('')
const language = ref('javascript')
const type = ref<'app-extension' | 'app-theme'>('app-extension')
const uploading = ref(false)
const error = ref('')
const showFullScreenCode = ref(false)

const currentEditorTab = ref<'gui' | 'raw'>('gui')

const themeState = ref({
  schema: 1,
  previewTemplate: 'fishpi-mobile-v1',
  colorScheme: 'light',
  colors: {
    'base-100': '#F3F8FF',
    'base-200': '#FFFFFF',
    'base-300': '#E9F2FF',
    'base-content': '#08233F',
    'primary': '#08233F',
    'primary-content': '#FFFFFF',
    'secondary': '#0B5C93',
    'secondary-content': '#FFFFFF',
    'accent': '#7CFF52',
    'accent-content': '#08233F',
    'neutral': '#5D7188',
    'neutral-content': '#FFFFFF',
    'info': '#0B5C93',
    'success': '#42D94D',
    'warning': '#EAB308',
    'error': '#E53935',
    'message-outgoing': '#0B5C93',
  },
  radius: {
    'radius-selector': 40,
    'radius-field': 18,
    'radius-box': 12
  },
  spacing: {
    'page': 14,
    'section': 12,
    'item': 8,
    'control': 10
  },
  border: {
    'border': 1,
    'opacity': 0.2
  },
  depth: {
    'depth': 0.12
  },
  wallpaper: {
    'image': 'assets/wallpaper.png'
  }
})

const defaultExtensionCode = `// ==FishPiPlugin==
// @name         我的插件
// @author       你的名字
// @version      1.0.0
// @scenes       chatRoom
// ==/FishPiPlugin==

console.log('Hello in FishPi APP Extension!');`

const defaultThemeCode = `{
  "schema": 1,
  "previewTemplate": "fishpi-mobile-v1",
  "name": "Deep Blue Lime",
  "description": "深蓝、荧光绿、白色内容层",
  "colorScheme": "light",
  "colors": {
    "base-100": "#F3F8FF",
    "base-200": "#FFFFFF",
    "base-300": "#E9F2FF",
    "base-content": "#08233F",
    "primary": "#08233F",
    "primary-content": "#FFFFFF",
    "secondary": "#0B5C93",
    "secondary-content": "#FFFFFF",
    "accent": "#7CFF52",
    "accent-content": "#08233F",
    "neutral": "#5D7188",
    "neutral-content": "#FFFFFF",
    "info": "#0B5C93",
    "success": "#42D94D",
    "warning": "#EAB308",
    "error": "#E53935",
    "message-outgoing": "#0B5C93",
  },
  "radius": {
    "radius-selector": 40,
    "radius-field": 18,
    "radius-box": 12
  },
  "spacing": {
    "page": 14,
    "section": 12,
    "item": 8,
    "control": 10
  },
  "border": {
    "border": 1,
    "opacity": 0.2
  },
  "depth": {
    "depth": 0.12
  },
  "wallpaper": {
    "image": "assets/wallpaper.png"
  }
}`

const handleTypeChange = () => {
  if (type.value === 'app-extension') {
    language.value = 'javascript'
    if (!code.value || code.value.trim() === '' || code.value === defaultThemeCode) {
      code.value = defaultExtensionCode
    }
  } else {
    language.value = 'json'
    if (!code.value || code.value.trim() === '' || code.value === defaultExtensionCode) {
      code.value = defaultThemeCode
      parseThemeFromCode()
    }
  }
}

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function getContrastColor(hex: string): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#0E1726' : '#FFFFFF';
}

const generateRandomColors = () => {
  const isDark = themeState.value.colorScheme === 'dark' || Math.random() > 0.5;
  themeState.value.colorScheme = isDark ? 'dark' : 'light';

  const baseHue = Math.floor(Math.random() * 360);

  let b100 = '';
  let b200 = '';
  let b300 = '';
  let bContent = '';

  if (isDark) {
    const s = Math.floor(10 + Math.random() * 15);
    b100 = hslToHex(baseHue, s, Math.floor(6 + Math.random() * 6));
    b200 = hslToHex(baseHue, s, Math.floor(12 + Math.random() * 6));
    b300 = hslToHex(baseHue, s, Math.floor(18 + Math.random() * 6));
    bContent = hslToHex(baseHue, 5, Math.floor(88 + Math.random() * 7));
  } else {
    const s = Math.floor(10 + Math.random() * 15);
    b100 = hslToHex(baseHue, s, Math.floor(94 + Math.random() * 4));
    b200 = hslToHex(baseHue, s, Math.floor(98 + Math.random() * 2));
    b300 = hslToHex(baseHue, s, Math.floor(86 + Math.random() * 6));
    bContent = hslToHex(baseHue, 30, Math.floor(8 + Math.random() * 10));
  }

  const primaryHue = Math.floor(Math.random() * 360);
  const primary = hslToHex(primaryHue, Math.floor(65 + Math.random() * 25), Math.floor(40 + Math.random() * 15));

  const secondaryHue = (primaryHue + 30 + Math.floor(Math.random() * 120)) % 360;
  const secondary = hslToHex(secondaryHue, Math.floor(60 + Math.random() * 25), Math.floor(40 + Math.random() * 15));

  const accentHue = (primaryHue + 120 + Math.floor(Math.random() * 120)) % 360;
  const accent = hslToHex(accentHue, Math.floor(75 + Math.random() * 25), Math.floor(55 + Math.random() * 15));

  const neutralHue = baseHue;
  const neutral = isDark 
    ? hslToHex(neutralHue, 15, Math.floor(25 + Math.random() * 15))
    : hslToHex(neutralHue, 15, Math.floor(35 + Math.random() * 15));

  const primaryContent = getContrastColor(primary);
  const secondaryContent = getContrastColor(secondary);
  const accentContent = getContrastColor(accent);
  const neutralContent = getContrastColor(neutral);

  const messageOutgoing = secondary;

  const success = '#22C55E';
  const warning = '#EAB308';
  const errorColor = '#EF4444';
  const info = '#3B82F6';

  themeState.value.colors = {
    'base-100': b100,
    'base-200': b200,
    'base-300': b300,
    'base-content': bContent,
    'primary': primary,
    'primary-content': primaryContent,
    'secondary': secondary,
    'secondary-content': secondaryContent,
    'accent': accent,
    'accent-content': accentContent,
    'neutral': neutral,
    'neutral-content': neutralContent,
    'info': info,
    'success': success,
    'warning': warning,
    'error': errorColor,
    'message-outgoing': messageOutgoing,
  };
};

const parseThemeFromCode = () => {
  try {
    const parsed = JSON.parse(code.value)
    if (parsed && typeof parsed === 'object') {
      themeState.value.schema = parsed.schema ?? 1
      themeState.value.previewTemplate = parsed.previewTemplate ?? 'fishpi-mobile-v1'
      themeState.value.colorScheme = parsed.colorScheme ?? 'light'
      
      if (parsed.colors && typeof parsed.colors === 'object') {
        themeState.value.colors = { ...themeState.value.colors, ...parsed.colors }
      }
      if (parsed.radius && typeof parsed.radius === 'object') {
        themeState.value.radius = { ...themeState.value.radius, ...parsed.radius }
      }
      if (parsed.spacing && typeof parsed.spacing === 'object') {
        themeState.value.spacing = { ...themeState.value.spacing, ...parsed.spacing }
      }
      if (parsed.border && typeof parsed.border === 'object') {
        themeState.value.border = { ...themeState.value.border, ...parsed.border }
      }
      if (parsed.depth && typeof parsed.depth === 'object') {
        themeState.value.depth = { ...themeState.value.depth, ...parsed.depth }
      }
      if (parsed.wallpaper && typeof parsed.wallpaper === 'object') {
        themeState.value.wallpaper = { ...themeState.value.wallpaper, ...parsed.wallpaper }
      }
    }
  } catch (e) {
    // Ignore coding errors
  }
}

const updateCodeFromThemeState = () => {
  const payload = {
    schema: themeState.value.schema,
    previewTemplate: themeState.value.previewTemplate,
    name: name.value,
    description: description.value,
    colorScheme: themeState.value.colorScheme,
    colors: themeState.value.colors,
    radius: themeState.value.radius,
    spacing: themeState.value.spacing,
    border: themeState.value.border,
    depth: themeState.value.depth,
    wallpaper: themeState.value.wallpaper
  }
  code.value = JSON.stringify(payload, null, 2)
}

watch(type, (newType) => {
  if (newType === 'app-theme') {
    parseThemeFromCode()
  }
})

watch(currentEditorTab, (newTab) => {
  if (newTab === 'gui') {
    parseThemeFromCode()
  } else {
    updateCodeFromThemeState()
  }
})

watch([name, description, themeState], () => {
  if (type.value === 'app-theme' && currentEditorTab.value === 'gui') {
    updateCodeFromThemeState()
  }
}, { deep: true })

const upgradeableItems = computed(() => {
  return myItems.value.filter(item => item.status === 'approved' && (item.type === 'app-extension' || item.type === 'app-theme'))
})

onMounted(async () => {
  try {
    const [myRes, allRes] = await Promise.all([
      getMyPublishedItems(),
      getItems()
    ])
    myItems.value = myRes.data.filter((item: Item) => item.type === 'app-extension' || item.type === 'app-theme')
    allApprovedItems.value = allRes.data.items || allRes.data
  } catch(e) { console.error(e) }

  const upgradeFromId = route.query.upgradeFromId
  if (upgradeFromId) {
    mode.value = 'upgrade'
    selectedItemId.value = parseInt(upgradeFromId as string)
  }

  const draftId = route.query.draftId
  if (draftId) {
    try {
      const draftsRes = await getMyDrafts()
      const draft = draftsRes.data.find((d: Item) => d.id === parseInt(draftId as string))
      if (draft) {
        editingDraftId.value = draft.id
        name.value = draft.name
        description.value = draft.description
        identifier.value = draft.identifier || ''
        oldIdentifier.value = draft.identifier || ''
        price.value = draft.price
        type.value = draft.type as 'app-extension' | 'app-theme'
        language.value = draft.language
        code.value = draft.code
        if (draft.type === 'app-theme') {
          parseThemeFromCode()
        }
      }
    } catch(e) { console.error(e) }
  } else {
    code.value = defaultExtensionCode
  }
})

watch(selectedItemId, (newId) => {
  if (newId) {
    const item = myItems.value.find(i => i.id === newId)
    if (item) {
      name.value = item.name
      description.value = item.description
      identifier.value = item.identifier || ''
      price.value = item.price || 0
      type.value = item.type as 'app-extension' | 'app-theme'
      language.value = item.language
      code.value = item.code || ''
      if (item.type === 'app-theme') {
        parseThemeFromCode()
      }
    }
  }
})

const handleSubmit = async (isDraft: boolean = false) => {
  if (type.value === 'app-theme' && currentEditorTab.value === 'gui') {
    updateCodeFromThemeState()
  }

  if (!isDraft && !code.value) {
    error.value = '请输入代码/配置内容'
    return
  }

  if (!identifier.value) {
    error.value = '标识符不能为空，至少为3位，且只能包含字母、数字、下划线或连字符'
    return
  }

  if (identifier.value.length < 3) {
    error.value = '标识符长度至少为3位'
    return
  }

  if (code.value) {
    if (type.value === 'app-extension') {
      const regex = /\/\/\s*==FishPiPlugin==[\s\S]*?\/\/\s*==\/FishPiPlugin==/
      if (!regex.test(code.value)) {
        error.value = 'APP扩展前端内容必须包含 // ==FishPiPlugin== 到 // ==/FishPiPlugin== 头部声明元数据'
        return
      }
    } else if (type.value === 'app-theme') {
      try {
        const parsed = JSON.parse(code.value)
        if (typeof parsed !== 'object' || parsed === null) {
          error.value = 'APP主题内容必须是一个有效的JSON对象'
          return
        }
      } catch (err: any) {
        error.value = 'APP主题内容必须是一个合法的JSON格式: ' + err.message
        return
      }
    }
  }

  uploading.value = true
  error.value = ''

  try {
    if (editingDraftId.value) {
      await updateDraft(editingDraftId.value, {
        name: name.value,
        description: description.value,
        identifier: identifier.value || undefined,
        price: price.value,
        type: type.value,
        code: code.value,
        language: language.value,
        matchUrls: [],
        dependencyIds: [],
      })
      
      if (isDraft) {
        Message.success('草稿已更新！')
      } else {
        await publishDraft(editingDraftId.value)
        Message.success('发布成功！作品已进入审核流程。')
        router.push('/my-works')
      }
    } else {
      await uploadItem({
        name: name.value,
        description: description.value,
        identifier: identifier.value || undefined,
        price: price.value,
        type: type.value,
        code: code.value,
        language: language.value,
        matchUrls: [],
        upgradeFromId: mode.value === 'upgrade' && selectedItemId.value ? selectedItemId.value : undefined,
        isDraft,
        dependencyIds: [],
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
          <Icon icon="mdi:cellphone" class="h-8 w-8" />
        </div>
        <h1 class="text-4xl font-black tracking-tight text-base-content mb-4 uppercase">发布 APP 作品</h1>
        <p class="text-lg text-base-content/40 font-medium leading-relaxed mb-6">
          专为 FishPi APP（客户端）打造的扩展与主题发布界面。
        </p>

        <div class="mt-12 space-y-6">
          <div class="flex items-center gap-4">
            <div class="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center text-[10px] font-black mt-1">1</div>
            <p class="text-sm font-bold text-base-content/60">APP 扩展必须以 FishPiPlugin 头部格式开始</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center text-[10px] font-black mt-1">2</div>
            <p class="text-sm font-bold text-base-content/60">APP 主题必须是合法的 JSON 格式配置</p>
          </div>
          <div class="flex items-center gap-4">
            <div class="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center text-[10px] font-black mt-1">3</div>
            <p class="text-sm font-bold text-base-content/60">APP 类型发布无需且不支持设定生效网址</p>
          </div>
        </div>

        <!-- APP Live Preview -->
        <div v-if="type === 'app-theme' && currentEditorTab === 'gui'" class="mt-12 space-y-4">
          <h4 class="font-black text-sm text-base-content/60 uppercase tracking-widest text-center flex items-center justify-center gap-1">
            <Icon icon="mdi:cellphone" class="text-secondary" />APP 界面实时预览
          </h4>
          
          <!-- Mock Device -->
          <div class="mock-device border-8 border-slate-800 shadow-2xl rounded-[2.5rem] p-3 max-w-65 mx-auto overflow-hidden text-xs relative select-none"
               :style="{
                 background: themeState.colors['base-100'],
                 color: themeState.colors['base-content'],
                 fontFamily: 'sans-serif',
                 borderColor: '#1e293b'
               }"
          >
            <!-- Status Bar -->
            <div class="flex justify-between items-center text-[8px] mb-2 px-1 font-semibold opacity-60">
              <span>10:24</span>
              <div class="flex items-center gap-0.5">
                <Icon icon="mdi:signal" class="w-2.5 h-2.5" />
                <Icon icon="mdi:wifi" class="w-2.5 h-2.5" />
                <Icon icon="mdi:battery" class="w-3.5 h-3.5" />
              </div>
            </div>

            <!-- Header / Title Bar -->
            <div class="p-2 shadow-sm flex items-center gap-1.5 mb-2"
                 :style="{
                   background: themeState.colors['primary'],
                   color: themeState.colors['primary-content'],
                   borderRadius: themeState.radius['radius-selector'] + 'px'
                 }"
            >
              <Icon icon="mdi:chevron-left" class="w-3.5 h-3.5 shrink-0" />
              <div class="grow font-bold text-center pr-3 text-[10px]">摸鱼派聊天室</div>
            </div>

            <!-- Chat Bubbles Area -->
            <div class="space-y-2 min-h-35 px-1 py-1" :style="{ padding: themeState.spacing['page'] + 'px' }">
              <!-- Left bubble (other user) -->
              <div class="flex gap-1.5 items-start">
                <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-bold bg-slate-300 text-slate-700 text-[8px]">
                  鱼
                </div>
                <div class="flex flex-col gap-0.5 max-w-[85%]">
                  <span class="text-[8px] opacity-40 font-bold">@fish_lover</span>
                  <div class="p-2 leading-relaxed"
                       :style="{
                         background: themeState.colors['base-200'],
                         color: themeState.colors['base-content'],
                         borderRadius: themeState.radius['radius-box'] + 'px',
                         borderWidth: themeState.border['border'] + 'px',
                         borderColor: themeState.colors['base-content'] + '33',
                         boxShadow: '0 2px 6px ' + themeState.colors['base-content'] + '1A',
                         padding: themeState.spacing['item'] + 'px'
                       }"
                  >
                    <p class="font-medium text-[10px] leading-snug">这个APP可视化配色效果真是太酷了！</p>
                    <span class="badge py-0.5 px-1 rounded font-bold text-[7px] mt-1 inline-block"
                          :style="{
                            background: themeState.colors['accent'],
                            color: themeState.colors['accent-content']
                          }"
                    >
                      社区红人
                    </span>
                  </div>
                </div>
              </div>

              <!-- Right bubble (Me) -->
              <div class="flex gap-1.5 items-start justify-end">
                <div class="flex flex-col gap-0.5 items-end max-w-[85%]">
                  <span class="text-[8px] opacity-40 font-bold">我</span>
                  <div class="p-2 leading-relaxed"
                       :style="{
                         background: themeState.colors['message-outgoing'],
                         color: themeState.colors['base-content'],
                         borderRadius: themeState.radius['radius-box'] + 'px',
                         padding: themeState.spacing['item'] + 'px'
                       }"
                  >
                    <p class="font-medium text-[10px] leading-snug">实时预览极其流畅，完美契合！</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Typing Controls -->
            <div class="mt-2 pt-1.5 border-t border-slate-500/5 flex items-center gap-1" :style="{ padding: themeState.spacing['control'] + 'px' }">
              <div class="grow py-0.5 px-1.5 flex items-center justify-between"
                   :style="{
                     background: themeState.colors['base-200'],
                     borderRadius: themeState.radius['radius-field'] + 'px',
                     borderWidth: themeState.border['border'] + 'px',
                     borderColor: themeState.colors['base-content'] + '1A'
                   }"
              >
                <span class="opacity-30 text-[9px]">说点什么...</span>
                <Icon icon="mdi:emoticon-happy-outline" class="w-3 h-3 opacity-30" />
              </div>
              
              <button class="btn btn-circle btn-xs border-none shrink-0"
                      :style="{
                        background: themeState.colors['primary'],
                        color: themeState.colors['primary-content']
                      }"
              >
                <Icon icon="mdi:send" class="w-2 h-2" />
              </button>
            </div>

            <!-- Status Indicators -->
            <div class="mt-4 flex justify-around items-center text-[8px] text-center font-bold">
              <div class="p-0.5 px-1 rounded" :style="{ background: themeState.colors['success'] + '1A', color: themeState.colors['success'] }">成功</div>
              <div class="p-0.5 px-1 rounded" :style="{ background: themeState.colors['warning'] + '1A', color: themeState.colors['warning'] }">警告</div>
              <div class="p-0.5 px-1 rounded" :style="{ background: themeState.colors['error'] + '1A', color: themeState.colors['error'] }">错误</div>
            </div>
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
                <label class="label mb-2"><span class="text-xs font-black uppercase tracking-widest opacity-40">选择要升级的 APP 作品</span></label>
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
                <input v-model="name" type="text" placeholder="例如: 简约炫彩APP主题" class="input input-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 h-14 font-medium" required />
              </div>

              <div class="form-control w-full md:col-span-2">
                <label class="label mb-2">
                  <span class="text-xs font-black uppercase tracking-widest opacity-40">作品标识符</span>
                  <span class="text-[10px] opacity-30 font-bold ml-2">最小3位，设置后不可修改</span>
                </label>
                <input v-model="identifier" 
                       type="text" 
                       :disabled="oldIdentifier !== ''"
                       placeholder="如: my-app-theme"
                       pattern="^[\w-.]+$" 
                       class="input input-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 h-14 font-mono font-medium" />
              </div>

              <div class="form-control w-full md:col-span-2">
                <label class="label mb-2"><span class="text-xs font-black uppercase tracking-widest opacity-40">功能描述</span></label>
                <textarea v-model="description" placeholder="简单介绍一下这个APP作品的功能或设计..." class="textarea textarea-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 py-4 h-28 font-medium" required></textarea>
              </div>

              <div class="form-control w-full">
                <label class="label mb-2"><span class="text-xs font-black uppercase tracking-widest opacity-40">项目类型</span></label>
                <select v-model="type" class="select select-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 h-14 font-bold" @change="handleTypeChange">
                  <option value="app-extension">APP扩展 (JavaScript)</option>
                  <option value="app-theme">APP主题 (JSON/Theme配色)</option>
                </select>
              </div>

              <div class="form-control w-full">
                <label class="label mb-2"><span class="text-xs font-black uppercase tracking-widest opacity-40">设定积分价格</span></label>
                <input v-model.number="price" type="number" min="0" class="input input-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 h-14 font-bold" required />
              </div>

              <!-- APP Theme GUI / Raw Editor -->
              <div v-if="type === 'app-theme'" class="form-control w-full md:col-span-2 space-y-6">
                <div class="tabs tabs-boxed bg-base-100 flex gap-2 p-1.5 rounded-xl border border-base-300">
                  <button 
                    type="button"
                    @click="currentEditorTab = 'gui'" 
                    :class="['tab grow text-sm font-bold rounded-lg py-2 transition-all', currentEditorTab === 'gui' ? 'bg-primary text-primary-content shadow-md' : 'text-base-content/60 hover:bg-base-200']"
                  >
                    <Icon icon="mdi:palette-outline" class="w-4 h-4 mr-2 inline" />
                    GUI 配色/参数编辑器
                  </button>
                  <button 
                    type="button"
                    @click="currentEditorTab = 'raw'" 
                    :class="['tab grow text-sm font-bold rounded-lg py-2 transition-all', currentEditorTab === 'raw' ? 'bg-primary text-primary-content shadow-md' : 'text-base-content/60 hover:bg-base-200']"
                  >
                    <Icon icon="mdi:code-json" class="w-4 h-4 mr-2 inline" />
                    原始 JSON 源码
                  </button>
                </div>

                <!-- GUI Editor -->
                <div v-if="currentEditorTab === 'gui'" class="space-y-6">
                  <!-- Config specs -->
                  <div class="card bg-base-100 p-6 border border-base-300 rounded-2xl">
                    <h4 class="font-black text-sm text-base-content/60 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Icon icon="mdi:settings-outline" />元数据配置</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="form-control">
                        <label class="label p-1"><span class="label-text text-xs opacity-60 font-bold">主题版本规范 (Schema)</span></label>
                        <input v-model.number="themeState.schema" type="number" class="input input-bordered rounded-xl font-bold bg-base-200/50" />
                      </div>
                      <div class="form-control">
                        <label class="label p-1"><span class="label-text text-xs opacity-60 font-bold">预览模版标识 (previewTemplate)</span></label>
                        <input v-model="themeState.previewTemplate" type="text" class="input input-bordered rounded-xl font-bold" />
                      </div>
                      <div class="form-control md:col-span-2">
                        <label class="label p-1"><span class="label-text text-xs opacity-60 font-bold">配色方案倾向 (ColorScheme)</span></label>
                        <select v-model="themeState.colorScheme" class="select select-bordered rounded-xl font-bold w-full">
                          <option value="light">明亮模式 (light)</option>
                          <option value="dark">暗黑模式 (dark)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <!-- Colors -->
                  <div class="card bg-base-100 p-6 border border-base-300 rounded-2xl">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                      <h4 class="font-black text-sm text-base-content/60 uppercase tracking-widest flex items-center gap-1.5">
                        <Icon icon="mdi:palette-swatch-outline" />主题配色方案 (Colors)
                      </h4>
                      <button 
                        type="button" 
                        @click="generateRandomColors" 
                        class="btn btn-xs btn-outline btn-secondary rounded-lg font-bold gap-1 active:scale-95 transition-all text-xs"
                      >
                        <Icon icon="mdi:wand" class="w-3 h-3" />
                        魔法随机配色 ✨
                      </button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div v-for="(val, key) in themeState.colors" :key="key" class="form-control bg-base-200/40 p-3 rounded-xl border border-base-300">
                        <label class="label p-0 pb-1 flex justify-between">
                          <span class="text-[11px] font-mono opacity-60 font-bold">{{ key }}</span>
                        </label>
                        <div class="flex gap-2 items-center">
                          <input type="color" v-model="themeState.colors[key]" class="w-8 h-8 rounded-lg border border-base-content/10 cursor-pointer overflow-hidden p-0 bg-transparent shrink-0" />
                          <input type="text" v-model="themeState.colors[key]" placeholder="#FFFFFF" class="input input-xs input-bordered grow rounded-lg text-xs font-mono font-bold px-2 py-1" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Radius & Spacing sliders -->
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="card bg-base-100 p-6 border border-base-300 rounded-2xl">
                      <h4 class="font-black text-sm text-base-content/60 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Icon icon="mdi:vector-difference-ba" />圆角半径 (Radius)</h4>
                      <div class="space-y-4">
                        <div v-for="(val, key) in themeState.radius" :key="key" class="form-control">
                          <label class="label p-0 pb-1 flex justify-between text-xs font-bold text-base-content/70">
                            <span>{{ key }}</span>
                            <span class="font-mono text-primary">{{ val }}px</span>
                          </label>
                          <div class="flex gap-3 items-center">
                            <input type="range" min="0" max="60" v-model.number="themeState.radius[key]" class="range range-primary range-xs grow" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="card bg-base-100 p-6 border border-base-300 rounded-2xl">
                      <h4 class="font-black text-sm text-base-content/60 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Icon icon="mdi:ruler-square" />元件边距 (Spacing)</h4>
                      <div class="space-y-4">
                        <div v-for="(val, key) in themeState.spacing" :key="key" class="form-control">
                          <label class="label p-0 pb-1 flex justify-between text-xs font-bold text-base-content/70">
                            <span>{{ key }}</span>
                            <span class="font-mono text-primary">{{ val }}px</span>
                          </label>
                          <div class="flex gap-3 items-center">
                            <input type="range" min="0" max="30" v-model.number="themeState.spacing[key]" class="range range-primary range-xs grow" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Border, Depth & Wallpaper -->
                  <div class="card bg-base-100 p-6 border border-base-300 rounded-2xl">
                    <h4 class="font-black text-sm text-base-content/60 uppercase tracking-widest mb-4 flex items-center gap-1.5"><Icon icon="mdi:image-filter-black-white" />边框、厚度与壁纸 (Others)</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div class="space-y-4">
                        <div class="form-control">
                          <label class="label p-0 pb-1 flex justify-between text-xs font-bold text-base-content/70">
                            <span>边框厚度 (border)</span>
                            <span class="font-mono text-primary">{{ themeState.border.border }}px</span>
                          </label>
                          <input type="range" min="0" max="5" v-model.number="themeState.border.border" class="range range-xs" />
                        </div>
                        <div class="form-control">
                          <label class="label p-0 pb-1 flex justify-between text-xs font-bold text-base-content/70">
                            <span>边框不透明度 (opacity)</span>
                            <span class="font-mono text-primary">{{ themeState.border.opacity }}</span>
                          </label>
                          <input type="range" min="0" max="1" step="0.05" v-model.number="themeState.border.opacity" class="range range-xs" />
                        </div>
                      </div>

                      <div class="space-y-4">
                        <div class="form-control">
                          <label class="label p-0 pb-1 flex justify-between text-xs font-bold text-base-content/70">
                            <span>阴影深度不透明度 (depth)</span>
                            <span class="font-mono text-primary">{{ themeState.depth.depth }}</span>
                          </label>
                          <input type="range" min="0" max="1" step="0.05" v-model.number="themeState.depth.depth" class="range range-xs" />
                        </div>
                        <div class="form-control">
                          <label class="label p-0 pb-1 flex justify-between text-xs font-bold text-base-content/70">
                            <span>缩略图壁纸路径 (wallpaper)</span>
                          </label>
                          <input v-model="themeState.wallpaper.image" type="text" placeholder="assets/wallpaper.png" class="input input-sm input-bordered rounded-xl font-bold w-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Raw JSON Editor -->
                <div v-if="currentEditorTab === 'raw'" class="relative group">
                  <textarea 
                    v-model="code" 
                    placeholder="在此处编辑您的 APP 主题 JSON 配置..." 
                    class="textarea textarea-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 py-6 h-120 font-mono text-sm leading-relaxed" 
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

              <!-- Standard Code and Fullscreen Modal for APP Extension -->
              <div v-if="type === 'app-extension'" class="form-control w-full md:col-span-2">
                <label class="label mb-2 flex justify-between">
                  <span class="text-xs font-black uppercase tracking-widest opacity-40">代码/配置内容</span>
                  <span class="text-[10px] font-black uppercase tracking-widest text-primary">{{ language }}</span>
                </label>
                <div class="relative group">
                  <textarea 
                    v-model="code" 
                    placeholder="在此处粘贴您的 APP 源代码..." 
                    class="textarea textarea-bordered w-full rounded-2xl bg-base-100 border-base-300 focus:border-primary px-6 py-6 h-120 font-mono text-sm leading-relaxed" 
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
                {{ uploading ? '正在发布...' : '发布作品' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>