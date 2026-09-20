import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from './item.entity';
import { UserItemState } from './user-item-state.entity';
import { Comment } from './comment.entity';
import { GlobalStorage } from './global-storage.entity';
import { ItemCode } from './item-code.entity';
import { ItemDependency } from './item-dependency.entity';
import { ItemPurchase } from './item-purchase.entity';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { UsersModule } from '../users/users.module';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Item,
      ItemCode,
      ItemDependency,
      ItemPurchase,
      UserItemState,
      Comment,
      GlobalStorage,
      User,
    ]),
    forwardRef(() => UsersModule),
  ],
  providers: [ItemsService],
  controllers: [ItemsController],
  exports: [ItemsService],
})
export class ItemsModule {}
