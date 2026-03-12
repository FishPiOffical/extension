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
  noticeGoldenKey: string
  noticeUsers: string
}

export interface ConfigStatus {
  configured: boolean
}
