import request from '@/utils/request'

export interface ConfigData {
  db: {
    host: string
    port: number
    username: string
    password: string
    database: string
    entityPrefix: string
  }
  port: number
  jwtSecret: string
  goldenKey: string
}

export interface ConfigStatus {
  configured: boolean
}

export function getConfigStatus() {
  return request.get<ConfigStatus>('/config/status')
}

export function setupConfig(config: ConfigData) {
  return request.post<{ message: string }>('/config', config)
}

export function getConfig() {
  return request.get<ConfigData>('/config')
}

export function updateConfig(config: Partial<ConfigData>) {
  return request.put<{ message: string }>('/config', config)
}