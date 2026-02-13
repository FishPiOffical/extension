<p align="center">
  <img width="200" src="./frontend/src/assets/logo.svg">
</p>

<p align="center">摸鱼派扩展商店</p>
<p align="center">
  摸鱼派扩展商店是一个为<a href="https://fishpi.cn/" target="_blank">摸鱼派平台</a>提供插件分发和管理的系统，旨在为统一用户分发与使用鱼排专属扩展，提升摸鱼派的功能和用户体验。即刻访问：<a href="https://ext.adventext.fun/" target="_blank">鱼排扩展商店</a>
</p>
  
## ⚙️ 调试/运行

1. 执行 `npm install` 安装所有工程依赖。
2. 使用 Visual Studio Code 运行调试（直接按下`F5`即可），或执行 `npm run dev:backend` 启动后端开发服务器。
3. 执行 `npm run dev:frontend` 启动前端开发服务器，访问 `http://localhost:5173` 即可开始开发。
4. 或执行 `npm run dev` 同时启动后端和前端，访问 `http://localhost:5173` 也可开始开发。

## 内置对象

Javascript 运行时会注入一个全局对象 `fishpi`，提供了所有鱼排接口，并已关联登录用户。具体接口参考 [fishpi.js](https://github.com/FishPiOffical/fishpi.js)。