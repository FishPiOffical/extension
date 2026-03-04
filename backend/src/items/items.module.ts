import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from './item.entity';
import { UserItemState } from './user-item-state.entity';
import { Comment } from './comment.entity';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, UserItemState, Comment]),
    forwardRef(() => UsersModule),
  ],
  providers: [ItemsService],
  controllers: [ItemsController],
  exports: [ItemsService],
})
export class ItemsModule {}
