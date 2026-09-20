import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ItemsModule } from '../items/items.module';
import { Comment } from '../items/comment.entity';
import { Item } from '../items/item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Comment, Item]),
    forwardRef(() => ItemsModule),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
