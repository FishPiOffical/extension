<p align="center">
  <img width="200" src="./frontend/src/assets/logo.svg">
</p>

<h1 align="center">摸鱼派扩展集市</h1>
<p align="center">
  摸鱼派扩展集市是一个为<a href="https://fishpi.cn/" target="_blank">摸鱼派平台</a>提供插件分发和管理的系统，旨在为统一用户分发与使用鱼排专属扩展，提升摸鱼派的功能和用户体验。即刻访问：<a href="https://ext.adventext.fun/" target="_blank">鱼排扩展集市</a>
</p>
  
## ⚙️ 调试/运行

1. 执行 `npm install` 安装所有工程依赖。
2. 使用 Visual Studio Code 运行调试（直接按下`F5`即可），或执行 `npm run dev:backend` 启动后端开发服务器。
3. 执行 `npm run dev:frontend` 启动前端开发服务器，访问 `http://localhost:5173` 即可开始开发。
4. 或执行 `npm run dev` 同时启动后端和前端，访问 `http://localhost:5173` 也可开始开发。

## 使用

在网站上添加如下代码即可使用：

```html
<script src="https://ext.adventext.fun/api/items/<user_oId>/loader.js"></script>
```

## 扩展开发

扩展分为基于 Javascript 的扩展和 CSS 的主题两大类，开发者可以根据需要选择开发类型。Javascript 脚本运行环境是在摸鱼派网站浏览器内，类似于油猴脚本的运行环境，提供了丰富的 API 供开发者使用。

### GM API

扩展可以调用部分 GM API 来实现一些特殊功能:

- `GM_xmlhttpRequest`：允许扩展 HTTP 请求，获取外部资源或与服务器通信。**不支持跨域**
- `GM_setValue`, `GM_getValue`, `GM_deleteValue`, `GM_listValues`：提供了一个简单的键值存储系统，允许扩展在用户浏览器中保存和读取数据。
- `GM_addStyle`：允许扩展动态添加 CSS 样式到页面中。
- `GM_registerMenuCommand`：允许扩展在用户界面中添加自定义菜单项，用户点击后可以触发扩展的特定功能。

有其他 GM API 的需求，可以通过 [GitHub Issues](https://github.com/fishpioffical/extension/issues) 提出。

### 内置对象

Javascript 运行时会注入一个全局对象 `fishpi`，提供了所有鱼排接口，并已关联登录用户。具体接口参考 [fishpi.js](https://fishpioffical.github.io/fishpi.js/classes/FishPi.html)。

### 云存储

扩展可以使用 `cloudStorage` 对象来存储和读取数据，数据会保存在云端，并且与用户账号绑定。接口与 `localStorage` 一样，但需注意接口皆是异步的（调用需 await 等待结果返回）。**不建议并发调用操作，可能导致数据丢失**。

### 依赖

扩展本身可以依赖于其他已经发布的扩展。 依赖关系会在加载时自动解析并加载，开发者无需担心加载顺序问题。但需要注意避免循环依赖。只需要在发布时，在依赖列表中选择添加依赖的扩展即可。