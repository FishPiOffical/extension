import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

const modules = ConfigService.isConfigured()
  ? [
      TypeOrmModule.forRoot({
        type: 'mysql',
        ...ConfigService.getConfig().db,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // 迁移过的数据库建议在 config.json 中设置 db.synchronize = false，
        // 避免启动时 TypeORM 自动改表结构导致数据被重置为默认值。
        synchronize: ConfigService.getConfig().db?.synchronize ?? true,
      }),
      AuthModule,
      UsersModule,
      ItemsModule,
      ConfigModule,
    ]
  : [ConfigModule];

@Module({
  imports: [
    ...modules,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/'], // 排除 API 路径
    }),
  ],
})
export class AppModule {}
