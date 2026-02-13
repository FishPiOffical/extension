import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ItemsModule } from './items/items.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';

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
  imports: modules,
})
export class AppModule {}
