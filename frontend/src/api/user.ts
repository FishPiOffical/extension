import request from '../utils/request'

export interface UserProfile {
  id: string
  username: string
  nickname?: string
  avatar?: string
  isAdmin: boolean
  points: number
  createdAt: string
}

/**
 * Get current user profile
 */
export function getUserProfile() {
  return request.get<UserProfile>('/users/profile')
}

/**
 * Get user profile by username
 */
export function getUser(username: string) {
  return request.get<UserProfile>(`/users/${username}`)
}

/**
 * Get user comments with pagination
 */
export function getUserComments(id: string, page: number = 1, limit: number = 10) {
  return request.get<{ items: any[], total: number }>(`/users/${id}/comments`, { params: { page, limit } })
}
