# backend AGENTS 指南

## 目标
本目录后端已从 ORM 实体关系映射重构为逻辑外键模型，核心目标是降低联表开销、提高查询可控性、减少隐式关系加载带来的性能波动。

## 架构总览
1. 取消实体上的关系装饰器
2. 使用逻辑外键字段表达关联
3. 通过批量 ID 聚合 + IN 查询回填响应对象
4. 将项目主信息与版本内容严格拆分
5. 以 item_code 承载版本链（一对多）

## 关键数据模型
### item 主表
- 定位为项目元信息主表，不保存版本差异字段
- 关键逻辑字段
  - authorId: 作者逻辑外键
  - identifier: 项目标识
  - name/description/type/price: 项目基础属性

### item_code
- 一个 item 对应多条版本记录（1:N）
- 关键字段
  - id: 版本ID（接口层主用）
  - itemId: 项目ID
  - version: 版本号
  - status: 审核状态
  - language/matchUrls/code/reviewComment: 版本差异内容
  - upgradeFromCodeId: 版本链父节点

### item_dependency
- 维护项目依赖关系
- 关键字段
  - itemId
  - dependencyItemId

### item_purchase
- 维护用户拥有关系
- 关键字段
  - itemId
  - userId

### user_item_state
- 维护用户对项目的启用、自动更新与存储状态
- 唯一键
  - userId + itemId
- 扩展字段
  - selectedCodeId: 当前用户选中的版本ID

## 查询与回填规范
### 禁止使用
- relations 选项
- leftJoinAndSelect 的关系展开
- relation API 的关系写入

### 标准流程
1. 先查主实体集合（如 item 列表）
2. 收集 authorId、itemId、dependencyItemId、upgradeFromId 等 ID
3. 分别按维度批量 IN 查询
4. 在服务层组装 author、dependencies、upgradeFrom、code 等响应字段

### 评论场景
- comment 仅存 authorId、itemId、parentId
- 获取评论列表时
  - 先查根评论
  - 再批量查 replies
  - 再批量查作者并回填

## 前缀注意事项
- 库表基于 TypeORM entityPrefix
- 运行时和迁移都必须按前缀计算真实物理名

## 迁移策略
采用双阶段 Node 脚本，不再使用 SQL 文件直迁。

### 1) 导出旧数据包
- 脚本: migrations/export-legacy-data.js
- 能力
  - 自动识别旧表前缀
  - 导出旧结构与中间表数据

### 2) 导入并迁移
- 脚本: migrations/import-package-migrate.js
- 能力
  - 导入包数据并自动识别旧结构
  - 将“版本即 item 行”归并为“项目 item + 版本 item_code”
  - 将依赖、购买、评论、状态映射到项目级 itemId
  - 默认清理旧中间表

### 常用命令
- npm run migration:export -- --out migrations/legacy_export.json.gz
- npm run migration:import -- --in migrations/legacy_export.json.gz
- npm run migration:import -- --in migrations/legacy_export.json.gz --keep-legacy
- npm run migration:repair-status -- --in migrations/legacy_export.json.gz --dry-run

### 3) 状态修复（只改 status）
- 脚本: migrations/repair-item-code-status.js
- 适用场景
  - 目标表在导入时缺少 status 列，行插入后被补列默认值 pending
  - 表现为首页/集市为空但 item_code 行数正常
- 特性
  - 只更新 item_code.status，不动其它表与其它列
  - 支持 --dry-run 预览，校验不通过自动回滚

### 状态归一化规则
- 兼容 draft/pending/approved/rejected 字符串
- 兼容数字状态 0..4 映射
- 兼容中文关键词与 approve/reject 等英文关键词
- 无法识别或缺失时回落到 approved（历史上架数据不应因状态缺失而下架）

### schema 同步风险
- TypeORM 默认 synchronize: true，启动时会自动改表
- 若迁移脚本建表类型与实体定义不一致，实体可能新增列并使用默认值回填历史行
- 因此迁移脚本建表必须与实体定义保持一致（尤其是 enum 与列长度）
- 迁移完成后建议在 config.json 中设置 db.synchronize = false

## 接口兼容要求
1. 尽量保持 controller 路径和输入参数不变
2. 尽量保持前端依赖字段不变
  - item.author
  - item.dependencies
  - item.upgradeFrom
  - item.code
  - comment.author
  - comment.item
  - comment.replies
3. 兼容字段通过服务层回填，不通过 ORM 关系自动加载

## 性能与索引建议
1. item(authorId, type)、item(identifier)
2. item_code(itemId, version unique)、item_code(itemId, status)、item_code(upgradeFromCodeId)
3. item_dependency(itemId, dependencyItemId unique)
4. item_purchase(itemId, userId unique)
5. user_item_state(userId, itemId unique)、user_item_state(selectedCodeId)

## 开发约束
1. 新增业务时优先逻辑外键方案，不回退到实体关系装饰器
2. 列表接口严禁 N+1 查询
3. 回填查询必须做 ID 去重
4. 涉及跨版本关系时优先使用统一链路逻辑
5. 数据结构变更必须同步提供可执行迁移脚本

## 验收清单
1. npm run build 通过
2. 主要接口返回结构不破坏
3. 迁移脚本在带前缀数据库可执行
4. 迁移后 latest approved 列表结果正确
5. 购买、依赖、评论、版本切换功能可用
6. 迁移后核对 item_code 状态分布，确认 approved 数量符合预期
7. 迁移后确认 item 表不含 version/status/matchUrls 等版本字段
