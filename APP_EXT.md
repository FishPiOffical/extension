# FishPi 扩展商店 APP 扩展与主题对接 API 文档

本系统为 APP（移动端、桌面端客户端或特定宿主环境）提供了专属的扩展 (`app-extension`) 与主题 (`app-theme`) 的分发、鉴权及上传/发布管理。所有的 API 的默认基本根路径（Base URL）均带有 `/api` 前缀。

---

## 一、 接口公共说明

### 1. 统一响应格式

所有请求在成功时通过拦截器进行统一包装：
```json
{
  "code": 0,
  "data": {}, // 真正的返回数据
  "msg": ""
}
```

在请求失败或抛出异常时，通过异常过滤器统一返回格式：
```json
{
  "code": 400, // 对应的 HTTP 状态码或自定义错误码
  "data": {},
  "msg": "异常提示信息"
}
```

### 2. 鉴权机制 (Authorization)

**JWT Bearer Token**：
所有写操作及部分限制性的读操作均需要用户身份。支持通过 HTTP Header 携带 `Authorization: Bearer <token>` 进行身份校验。

---

## 二、 账户鉴权接口

### 1. 换取系统登录 Token

客户端（如 FishPi APP）在拥有用户的 FishPi `apiKey` 后，可以通过此接口直接在扩展商店进行静默登录并拿到扩展商店专属的 JWT 鉴权 Token。

* **请求路径**：`GET /api/auth/getToken`
* **请求头 (Headers)**：
  * `fishpi-key`: `string` (必填，用户的 FishPi API Key 值)
* **请求示例**：
  ```http
  GET /api/auth/getToken HTTP/1.1
  Host: ext.adventext.fun
  fishpi-key: your-fishpi-api-key-here
  ```
* **正确返回示例 (`data` 内层数据)**：
  ```json
  {
    "code": 0,
    "data": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "1631234567890",
        "username": "seven",
        "isAdmin": false
      }
    },
    "msg": ""
  }
  ```

---

## 三、 APP 扩展/主题载入与列表分发

通过传入特定的用户 ID（例如 FishPi 用户的 `oId`），APP 能够拉取该用户已购买并且处于“启用”状态的所有扩展及主题列表。

### 1. 获取用户已启用的应用扩展 (App Extension) 列表

* **请求路径**：`GET /api/items/:userId/app-extension`
* **请求参数**：
  * `userId`: `string` (路径参数，用户 ID)
* **正确返回示例 (`data` 内层数据)**：
  ```json
  [
    {
      "id": 12,
      "name": "极简聊天助手",
      "identifier": "me.seven.chat-helper",
      "author": "seven",
      "version": "1.0.2",
      "url": "http://ext.adventext.fun/api/items/12/app-extension.js"
    }
  ]
  ```

### 2. 获取用户已启用的应用主题 (App Theme) 列表

* **请求路径**：`GET /api/items/:userId/app-theme`
* **请求参数**：
  * `userId`: `string` (路径参数，用户 ID)
* **正确返回示例 (`data` 内层数据)**：
  ```json
  [
    {
      "id": 15,
      "name": "暗黑宇宙极客",
      "identifier": "me.seven.dark-space",
      "author": "seven",
      "version": "1.0.0",
      "url": "http://ext.adventext.fun/api/items/15/app-theme.json"
    }
  ]
  ```

### 3. 读取应用扩展 JS 代码

* **请求路径**：`GET /api/items/:id/app-extension.js`
* **请求参数**：
  * `id`: `number` (路径参数，商品/扩展的真实 ID)
  * `userId`: `string` (可选，查询参数。若扩展公开通过审核，可免填；若扩展未公开或未通过审核，需提供该扩展作者的 `userId` 才能越权调用读取)
* **返回值**：
  * 返回 `Content-Type: application/javascript` 类型的纯 JavaScript 静态执行文件内容。

### 4. 读取应用主题 JSON 结构

* **请求路径**：`GET /api/items/:id/app-theme.json`
* **请求参数**：
  * `id`: `number` (路径参数，商品/主题的真实 ID)
  * `userId`: `string` (可选，查询参数。验证逻辑与上方应用扩展一致)
* **返回值**：
  * 返回 `Content-Type: application/json` 的主题配置数据 JSON 结构。

---

## 四、 上传/发布扩展或主题接口 (Upload)

创作者在客户端中开发或配置完毕后，可以通过此接口直接将扩展、主题、应用扩展或应用主题打包发布/上架到扩展商店中。

* **请求路径**：`POST /api/items/upload`
* **请求头 (Headers)**：
  * `Authorization`: `Bearer <token>` (必填，通过 /api/auth/getToken 或 login 获取的登录 Token)
* **请求体 (JSON Body)**：
  ```json
  {
    "name": "写周写月小工具",
    "description": "适合 FishPi APP 的客户端扩展辅助程序，自动生成周报模板说明。",
    "identifier": "me.seven.weekly-reporter", // 可选，扩展的唯一标识符（包名形式优先）
    "price": "0", // 必填，扩展定价，单位：积分（字符串类型传入，系统自动转换为整数）
    "type": "app-extension", // 必填，商品类型，可选值为: 'app-extension' | 'app-theme'
    "code": "export const activate = async (window, document, fishpi) => { console.log('Weekly Reporter Active'); }", // 必填，具体的运行代码或配置内容
    "language": "javascript", // 必填，代码/配置的编写语言。'javascript' | 'json' | 'css' 等
    "upgradeFromId": 12, // 可选，若为更新已有扩展，填写原本的商品 ID 以指明版本递增与覆盖关系
    "isDraft": false // 可选，是否作为草稿创建。true: 暂存不直接进入待审流程，false: 创建并直接提交审核（默认 false）
  }
  ```
* **正确返回示例 (`data` 内层数据)**：
  ```json
  {
    "code": 0,
    "data": {
      "id": 24,
      "name": "写周写月小工具",
      "description": "适合 FishPi APP 的客户端扩展辅助程序，自动生成周报模板说明。",
      "identifier": "me.seven.weekly-reporter",
      "type": "app-extension",
      "code": "export const activate = async (window, document, fishpi) => { console.log('Weekly Reporter Active'); }",
      "language": "javascript",
      "price": 0,
      "status": "pending", // 若 isDraft 为 true，则此处显示为 'draft'
      "version": "1.0.0",
      "author": {
        "id": "1631234567890",
        "username": "seven"
      }
    },
    "msg": ""
  }
  ```


