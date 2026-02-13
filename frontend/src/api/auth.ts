import request from '../utils/request'

export interface LoginData {
  username: string
  password: string
}

export interface RegisterData {
  username: string
  password: string
}

export interface AuthResponse {
  access_token: string
  user: {
    id: number
    username: string
    isAdmin: boolean
    points: number
  }
}

/**
 * User login
 */
export function login(data: LoginData) {
  return request.post<AuthResponse>('/auth/login', data)
}

/**
 * User registration
 */
export function register(data: RegisterData) {
  return request.post<AuthResponse>('/auth/register', data)
}
