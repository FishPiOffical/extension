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
    id: number
    username: string
    avatar: string
  }
  purchasedBy?: Array<{ id: number; username: string }>
  isEnabled?: boolean
  upgradeFrom?: Item | number
  upgradeFromId?: number
}

export interface UploadItemData {
  name: string
  description: string
  price: number
  type: 'extension' | 'theme'
  code: string
  language: string
  upgradeFromId?: number
  isDraft?: boolean
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
  return request.post<{ isEnabled: boolean }>(`/items/${id}/toggle`, { isEnabled })
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
