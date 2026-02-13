import request from '../utils/request'

export interface UserProfile {
  id: number
  username: string
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
