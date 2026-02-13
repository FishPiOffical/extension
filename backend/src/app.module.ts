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
        synchronize: true,
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
