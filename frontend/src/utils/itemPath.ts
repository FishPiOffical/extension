export interface ItemPathSource {
  id: number
  identifier?: string | null
  version?: number | null
}

/**
 * 详情页路由统一入口：
 * - 设置了 identifier：使用 /ext/:identifier 或 /ext/:identifier/:version
 * - 未设置 identifier：回退到旧的 /item/:id
 *
 * 列表数据都带有 identifier 与 version，因此能精确定位到某个版本；
 * 若只关心项目本身（例如评论关联的作品），不传 version 即可指向最新已审核版本。
 */
export function itemDetailPath(item: ItemPathSource | null | undefined): string {
  if (!item) {
    return '/market'
  }

  const identifier = typeof item.identifier === 'string' ? item.identifier.trim() : ''
  if (identifier) {
    const base = `/ext/${encodeURIComponent(identifier)}`
    return item.version ? `${base}/${item.version}` : base
  }

  return `/item/${item.id}`
}
