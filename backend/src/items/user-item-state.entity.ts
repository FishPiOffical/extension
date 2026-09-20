import { Entity, PrimaryGeneratedColumn, Column, Unique, Index } from 'typeorm';
import { User } from '../users/user.entity';
import { Item } from './item.entity';

@Entity()
@Unique(['userId', 'itemId'])
export class UserItemState {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64 })
  @Index()
  userId: string;

  @Column()
  @Index()
  itemId: number;

  @Column({ nullable: true, comment: '当前选中的版本ID' })
  @Index()
  selectedCodeId: number;

  @Column({ default: true, comment: '是否启用' })
  isEnabled: boolean;

  @Column({ default: true, comment: '是否自动更新' })
  isAutoUpdate: boolean;

  @Column({ type: 'simple-json', nullable: true, comment: '配置数据' })
  storage: Record<string, any>;

  // 以下字段为运行时回填字段，不参与 ORM 映射
  user?: User;
  item?: Item;
}
