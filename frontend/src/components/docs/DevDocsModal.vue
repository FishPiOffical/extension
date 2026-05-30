<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const isShow = ref(false)
const activeTab = ref<'web' | 'app'>('web')

const open = () => {
  isShow.value = true
}

const close = () => {
  isShow.value = false
}

defineExpose({
  open,
  close
})
</script>

<template>
  <dialog :class="['modal modal-bottom sm:modal-middle', { 'modal-open': isShow }]" @click.self="close">
    <div class="modal-box w-11/12 max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
      <!-- Header with Tabs -->
      <div class="p-6 bg-base-200 border-b border-base-300 shrink-0">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-black text-2xl flex items-center gap-2">
            <Icon icon="mdi:book-open-page-variant" class="w-8 h-8 text-primary" />
            开发指南与文档
          </h3>
          <button @click="close" class="btn btn-circle btn-ghost btn-sm">
            <Icon icon="mdi:close" class="w-5 h-5" />
          </button>
        </div>
        <div class="tabs tabs-boxed bg-base-100 flex gap-2 p-1.5 rounded-xl">
          <button 
            @click="activeTab = 'web'" 
            :class="['tab grow text-sm font-bold rounded-lg py-2 transition-all', activeTab === 'web' ? 'bg-primary text-primary-content shadow-md' : 'text-base-content/60 hover:bg-base-200']"
          >
            <Icon icon="mdi:web" class="w-4 h-4 mr-2 inline" />
            网页端扩展/主题文档
          </button>
          <button 
            @click="activeTab = 'app'" 
            :class="['tab grow text-sm font-bold rounded-lg py-2 transition-all', activeTab === 'app' ? 'bg-secondary text-secondary-content shadow-md' : 'text-base-content/60 hover:bg-base-200']"
          >
            <Icon icon="mdi:cellphone" class="w-4 h-4 mr-2 inline" />
            APP端扩展/主题文档 (Github SDK)
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto p-8 space-y-6 text-base-content/80">
        
        <!-- WEB DOCS -->
        <div v-if="activeTab === 'web'" class="space-y-6">
          <p class="text-base leading-relaxed font-semibold">
            扩展分为基于 Javascript 的扩展和 CSS 的主题两大类，开发者可以根据需要选择开发类型。Javascript 脚本运行环境是在摸鱼派网站浏览器内，类似于油猴脚本的运行环境，提供了丰富的 API 供开发者使用。
          </p>

          <div class="bg-base-200/50 rounded-2xl p-6">
            <h4 class="font-bold text-xl text-base-content mb-4 flex items-center gap-2">
              <Icon icon="mdi:api" class="text-primary w-6 h-6"/> GM API
            </h4>
            <p class="mb-4 text-base">扩展可以调用部分 GM API 来实现一些特殊功能:</p>
            <ul class="list-none space-y-4">
              <li class="flex items-start gap-3">
                <Icon icon="mdi:check-circle" class="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">GM_xmlhttpRequest</code>
                  <p class="mt-1 text-sm">允许扩展 HTTP 请求，获取外部资源或与服务器通信。<strong class="text-error">不支持跨域</strong></p>
                </div>
              </li>
              <li class="flex items-start gap-3">
                <Icon icon="mdi:check-circle" class="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <div class="flex flex-wrap gap-2 mb-1">
                    <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">GM_setValue</code>
                    <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">GM_getValue</code>
                    <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">GM_deleteValue</code>
                    <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">GM_listValues</code>
                  </div>
                  <p class="text-sm">提供了一个简单的键值存储系统，允许扩展在用户浏览器中保存和读取数据。</p>
                </div>
              </li>
              <li class="flex items-start gap-3">
                <Icon icon="mdi:check-circle" class="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">GM_addStyle</code>
                  <p class="mt-1 text-sm">允许扩展动态添加 CSS 样式到页面中。</p>
                </div>
              </li>
              <li class="flex items-start gap-3">
                <Icon icon="mdi:check-circle" class="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">GM_registerMenuCommand</code>
                  <p class="mt-1 text-sm">允许扩展在用户界面中添加自定义菜单项，用户点击后可以触发扩展的特定功能。</p>
                </div>
              </li>
            </ul>
            <div class="mt-6 flex items-center gap-2 text-sm bg-info/10 p-3 rounded-lg text-info-content">
              <Icon icon="mdi:information" class="text-info w-5 h-5 shrink-0" />
              <span>有其他 GM API 的需求，可以通过 <a href="https://github.com/fishpioffical/extension/issues" target="_blank" class="link link-primary font-bold">GitHub Issues</a> 提出。</span>
            </div>
          </div>

          <div class="bg-base-200/50 rounded-2xl p-6">
            <h4 class="font-bold text-xl text-base-content mb-3 flex items-center gap-2">
              <Icon icon="mdi:cube-outline" class="text-primary w-6 h-6"/> 内置对象
            </h4>
            <p class="leading-relaxed text-sm">Javascript 运行时会注入一个全局对象 <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">fishpi</code>，提供了所有鱼排接口，并已关联登录用户。具体接口参考 <a href="https://fishpioffical.github.io/fishpi.js/classes/FishPi.html" target="_blank" class="link link-primary font-bold">fishpi.js</a>。</p>
          </div>

          <div class="bg-base-200/50 rounded-2xl p-6">
            <h4 class="font-bold text-xl text-base-content mb-3 flex items-center gap-2">
              <Icon icon="mdi:cloud-outline" class="text-primary w-6 h-6"/> 云存储
            </h4>
            <p class="leading-relaxed text-sm mb-2">扩展可以使用 <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">cloudStorage</code> 对象来存储和读取数据，数据会保存在云端，并且与用户账号绑定。</p>
            <p class="leading-relaxed text-sm">接口与 <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">localStorage</code> 一样，但需注意接口皆是异步的（调用需 await 等待结果返回）。<br/><strong class="text-warning bg-warning/10 px-2 py-1 mt-2 inline-block rounded">不建议并发调用操作，可能导致数据丢失。</strong></p>

            <p class="leading-relaxed text-sm mt-4">若需要在多个扩展之间共享数据，可以使用 <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">globalStorage</code> 对象，接口同样与 <code class="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">localStorage</code> 一样，但数据不与用户账号绑定，而是与扩展标识符（<strong>需自行设置</strong>）绑定。<br/><strong class="text-warning bg-warning/10 px-2 py-1 mt-2 inline-block rounded">同样不建议并发调用操作，可能导致数据丢失。</strong></p>
          </div>

          <div class="bg-base-200/50 rounded-2xl p-6">
            <h4 class="font-bold text-xl text-base-content mb-3 flex items-center gap-2">
              <Icon icon="mdi:package-variant-closed" class="text-primary w-6 h-6"/> 依赖
            </h4>
            <p class="leading-relaxed text-sm">扩展本身可以依赖于其他已经发布的扩展。 依赖关系会在加载时自动解析并加载，开发者无需担心加载顺序问题。但需要注意避免循环依赖。只需要在发布时，在依赖列表中选择添加依赖的扩展即可。</p>
          </div>
        </div>

        <!-- APP DOCS -->
        <div v-else class="space-y-6">
          <p class="text-base leading-relaxed font-semibold">
            APP 扩展与 APP 主题专为移动端多端原生环境（FishPi Rust SDK / 原生 App）量身定制。APP 客户端具备专门的模块加载运行时。
          </p>

          <div class="card bg-secondary/10 border border-secondary/20 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="space-y-1">
              <h4 class="font-black text-lg text-secondary flex items-center gap-2">
                <Icon icon="mdi:file-document-box-outline" /> FishPi Rust SDK 开发手册
              </h4>
              <p class="text-sm opacity-80">查看官方部署和 SDK 规范、元数据场景说明以及完整的开发文档门户。</p>
            </div>
            <a href="https://kwdetfpv.github.io/fishpi-rust-sdk/" target="_blank" class="btn btn-secondary font-black text-sm shrink-0 rounded-xl px-6 shadow-md shadow-secondary/20">
              <Icon icon="mdi:open-in-new" />
              直达官方手册网页
            </a>
          </div>

          <div class="bg-base-200/50 rounded-2xl p-6">
            <h4 class="font-bold text-xl text-base-content mb-3 flex items-center gap-2">
              <Icon icon="mdi:code-json" class="text-secondary w-6 h-6"/> 1. APP 扩展元参数与规范
            </h4>
            <p class="leading-relaxed text-sm mb-4">APP 扩展是普通的 Javascript，但在其 **文件最头部/最前端**，必须包含且被以下声明块所括：</p>
            <pre class="bg-base-300 p-4 rounded-xl font-mono text-sm leading-relaxed overflow-x-auto text-base-content"><code>// ==FishPiPlugin==
// @name         我的插件
// @author       你的名字
// @version      1.0.0
// @scenes       chatRoom
// ==/FishPiPlugin==</code></pre>
            <p class="leading-relaxed text-xs opacity-60 mt-2">※ 提示：客户端将在检测完毕该头部后将其作为原生 Plugin 动态挂载运行。</p>
          </div>

          <div class="bg-base-200/50 rounded-2xl p-6">
            <h4 class="font-bold text-xl text-base-content mb-3 flex items-center gap-2">
              <Icon icon="mdi:palette-swatch" class="text-secondary w-6 h-6"/> 2. APP 主题配色 JSON
            </h4>
            <p class="leading-relaxed text-sm mb-4">APP 主题采用标准化 JSON 配色结构，内置 previewTemplate 与 16 进制颜色控制，您可以使用本平台提供的 **GUI 可视化配色编辑器** 进行直观编辑生成：</p>
            <pre class="bg-base-300 p-4 rounded-xl font-mono text-xs leading-relaxed overflow-y-auto max-h-48 scrollbar-style text-base-content"><code>{
  "schema": 1,
  "previewTemplate": "fishpi-mobile-v1",
  "name": "Deep Blue Lime",
  "description": "深蓝、荧光绿、白色内容层",
  "colorScheme": "light",
  "colors": {
    "base-100": "#F3F8FF",
    "base-200": "#FFFFFF",
    ...
  }
}</code></pre>
            <p class="leading-relaxed text-sm mt-4">更具体的参数说明、radius 圆角、Wallpaper 适配等，均可以在 SDK 手册中深入查阅。</p>
          </div>

          <div class="bg-base-200/50 rounded-2xl p-6">
            <h4 class="font-bold text-xl text-base-content mb-3 flex items-center gap-2">
              <Icon icon="mdi:alert-circle-outline" class="text-error w-6 h-6"/> 3. 特殊规则
            </h4>
            <ul class="list-disc list-inside space-y-2 text-sm text-base-content/85">
              <li>由于客户端运行时的沙盒独立管理特性，**APP 扩展与 APP 主题均不支持第三方作品的依赖配置 (Dependency)**。</li>
              <li>APP 扩展或主题的代码一经启用，会自动部署在专属的 API 网关下，客户端将通过相应的 API 获取用户配置的地址集并直接热重载。</li>
            </ul>
          </div>
        </div>

      </div>

      <div class="modal-action shrink-0 border-t border-base-200 p-6 bg-base-200 mt-0">
        <button @click="close" class="btn btn-primary px-8">知道了</button>
      </div>
    </div>
    
    <form method="dialog" class="modal-backdrop">
      <button @click="close">关闭</button>
    </form>
  </dialog>
</template>