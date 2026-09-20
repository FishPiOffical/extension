export interface ConfigData {
  db: {
    host: string
    port: number
    username: string
    password: string
    database: string
    entityPrefix: string
    // 数据库迁移完成后建议设为 false，避免 TypeORM 启动时自动改表
    synchronize?: boolean
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
