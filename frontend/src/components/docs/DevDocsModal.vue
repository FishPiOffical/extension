<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

const isShow = ref(false)

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
    <div class="modal-box w-11/12 max-w-4xl max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-center mb-6 shrink-0">
        <h3 class="font-black text-2xl flex items-center gap-2">
          <Icon icon="mdi:book-open-page-variant" class="w-8 h-8 text-primary" />
          扩展开发指南
        </h3>
        <button @click="close" class="btn btn-circle btn-ghost btn-sm">
          <Icon icon="mdi:close" class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-6 text-base-content/80 overflow-y-auto pr-2 pb-4">
        <p class="text-base leading-relaxed">
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
        </div>

        <div class="bg-base-200/50 rounded-2xl p-6">
          <h4 class="font-bold text-xl text-base-content mb-3 flex items-center gap-2">
            <Icon icon="mdi:package-variant-closed" class="text-primary w-6 h-6"/> 依赖
          </h4>
          <p class="leading-relaxed text-sm">扩展本身可以依赖于其他已经发布的扩展。 依赖关系会在加载时自动解析并加载，开发者无需担心加载顺序问题。但需要注意避免循环依赖。只需要在发布时，在依赖列表中选择添加依赖的扩展即可。</p>
        </div>
      </div>

      <div class="modal-action shrink-0 border-t border-base-200 pt-4 mt-0">
        <button @click="close" class="btn btn-primary px-8">知道了</button>
      </div>
    </div>
    
    <form method="dialog" class="modal-backdrop">
      <button @click="close">关闭</button>
    </form>
  </dialog>
</template>