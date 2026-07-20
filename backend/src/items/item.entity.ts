import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, ManyToMany, JoinTable, OneToMany, Index } from 'typeorm';
import { User } from '../users/user.entity';
import { Comment } from './comment.entity';

export enum ItemType {
  EXTENSION = 'extension',
  THEME = 'theme',
  APP_EXTENSION = 'app-extension',
  APP_THEME = 'app-theme',
}

export enum ItemStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export const ItemTypeLabels = {
  [ItemType.EXTENSION]: '扩展',
  [ItemType.THEME]: '主题',
  [ItemType.APP_EXTENSION]: 'APP扩展',
  [ItemType.APP_THEME]: 'APP主题',
};

@Entity()
@Index(['status', 'createdAt'])  // 复合索引，优化列表查询
@Index(['status', 'type'])        // 复合索引，优化按类型筛选
@Index(['upgradeFromId', 'status']) // 优化子查询性能
export class Item {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '项目名称' })
  name: string;

  @Column('text', { comment: '项目描述' })
  description: string;

  @Column({ type: 'simple-enum', enum: ItemType, comment: '项目类型' })
  type: ItemType;

  @Column('longtext', { comment: '项目代码' })
  code: string;

  @Column({ comment: '编程语言' })
  language: string;

  @Column({ type: 'simple-enum', enum: ItemStatus, default: ItemStatus.PENDING, comment: '项目状态' })
  status: ItemStatus;

  @Column({ default: 0, comment: '项目价格' })
  price: number;

  @Column({ default: 1, comment: '版本' })
  version: number;

  @Column({ type: 'simple-array', nullable: true, comment: '生效网址' })
  matchUrls: string[];

  @ManyToOne(() => User, user => user.items)
  author: User;

  @Column({ nullable: true, comment: '项目标识符', length: 100 })
  @Index() // 添加索引，用于快速查找
  identifier: string;

  @Column({ nullable: true })
  upgradeFromId: number;

  @ManyToOne(() => Item, { nullable: true })
  upgradeFrom: Item;

  @ManyToMany(() => Item)
  @JoinTable()
  dependencies: Item[];

  @ManyToMany(() => User, user => user.purchasedItems)
  @JoinTable()
  purchasedBy: User[];

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @Column({ nullable: true, comment: '审核意见' })
  reviewComment: string;

  @OneToMany(() => Comment, comment => comment.item)
  comments: Comment[];
}
