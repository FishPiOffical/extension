import request from '../utils/request'

export interface Item {
  id: number
  name: string
  description: string
  type: 'extension' | 'theme'
  code: string
  language: string
  status: 'draft' | 'pending' | 'approved' | 'rejected'
  price: number
  version?: number
  createdAt: string
  reviewComment?: string
  author: {
    id: string
    username: string
    avatar: string
  }
  purchaseCount: number
  isEnabled?: boolean
  isAutoUpdate?: boolean
  matchUrls?: string[]
  upgradeFrom?: Item | number
  upgradeFromId?: number
  dependencies?: Item[]
}

export interface Comment {
  id: number
  content: string
  createdAt: string
  isBlocked: boolean
  reportCount: number
  isHandled: boolean
  author: {
    username: string
    avatar: string
    nickname: string
  }
  item?: Item
  replies?: Comment[]
}


export interface UploadItemData {
  name: string
  description: string
  price: number
  type: 'extension' | 'theme'
  code: string
  language: string
  matchUrls?: string[]
  upgradeFromId?: number
  isDraft?: boolean
  dependencyIds?: number[]
}

export interface ReviewItemData {
  status: 'approved' | 'rejected'
  comment?: string
}

/**
 * Get all approved items (marketplace)
 */
export function getItems() {
  return request.get<Item[]>('/items')
}

/**
 * Get items by author
 */
export function getItemsByAuthor(username: string) {
  return request.get<Item[]>(`/items/author/${username}`)
}

/**
 * Get pending items (admin only)
 */
export function getPendingItems() {
  return request.get<Item[]>('/items/pending')
}

/**
 * Get user's purchased items
 */
export function getMyPurchases() {
  return request.get<Item[]>('/items/my-purchases')
}

/**
 * Get user's published items
 */
export function getMyPublishedItems() {
  return request.get<Item[]>('/items/my-published')
}

/**
 * Get user's purchased items (alias for getMyPurchases)
 */
export function getPurchasedItems() {
  return request.get<Item[]>('/items/my-purchases')
}

/**
 * Get item by ID
 */
export function getItemById(id: number) {
  return request.get<Item>(`/items/${id}`)
}

/**
 * Get all versions of an item
 */
export function getItemVersions(id: number) {
  return request.get<Item[]>(`/items/${id}/versions`)
}

export function getItemDependencies(id: number) {
  return request.get<Item[]>(`/items/${id}/dependencies`);
}

/**
 * Upload new item
 */
export function uploadItem(data: UploadItemData) {
  return request.post<Item>('/items/upload', data)
}

/**
 * Review item (admin only)
 */
export function reviewItem(id: number, data: ReviewItemData) {
  return request.post<Item>(`/items/${id}/review`, data)
}

/**
 * Purchase item
 */
export function purchaseItem(id: number) {
  return request.post<Item>(`/items/${id}/purchase`)
}

/**
 * Toggle item enabled state
 */
export function toggleItemState(id: number, isEnabled: boolean) {
  return request.post<{ isEnabled: boolean; isAutoUpdate?: boolean }>(`/items/${id}/toggle`, { isEnabled })
}

/**
 * Set item auto-update state
 */
export function setAutoUpdate(id: number, isAutoUpdate: boolean) {
  return request.post<{ isAutoUpdate: boolean }>(`/items/${id}/auto-update`, { isAutoUpdate })
}

/**
 * Withdraw pending item
 */
export function withdrawItem(id: number) {
  return request.post<Item>(`/items/${id}/withdraw`)
}

/**
 * Delete draft item
 */
export function deleteItem(id: number) {
  return request.delete(`/items/${id}`)
}

/**
 * Get user's draft items
 */
export function getMyDrafts() {
  return request.get<Item[]>('/items/my-drafts')
}

/**
 * Update draft item
 */
export function updateDraft(id: number, data: Partial<UploadItemData>) {
  return request.post<Item>(`/items/draft/${id}/update`, data)
}

/**
 * Publish draft item
 */
export function publishDraft(id: number) {
  return request.post<Item>(`/items/draft/${id}/publish`)
}

/**
 * Get item comments
 */
export function getComments(id: number) {
  return request.get<Comment[]>(`/items/${id}/comments`)
}

/**
 * Add comment
 */
export function addComment(id: number, content: string, parentId?: number) {
  return request.post<Comment>(`/items/${id}/comments`, { content, parentId })
}

/**
 * Block comment (Admin only)
 */
export function blockComment(id: number) {
  return request.post(`/items/comments/${id}/block`)
}

/**
 * Report comment
 */
export function reportComment(id: number) {
  return request.post(`/items/comments/${id}/report`)
}

/**
 * Get reported comments (Admin only)
 */
export function getReportedComments() {
  return request.get<Comment[]>('/items/comments/reported')
}

/**
 * Ignore report (Admin only)
 */
export function ignoreReport(id: number) {
  return request.post(`/items/comments/${id}/ignore`)
}
