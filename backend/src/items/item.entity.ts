import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
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
@Index(['authorId', 'type'])
export class Item {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '项目名称' })
  name: string;

  @Column('text', { comment: '项目描述' })
  description: string;

  @Column({ type: 'simple-enum', enum: ItemType, comment: '项目类型' })
  type: ItemType;

  @Column({ default: 0, comment: '项目价格' })
  price: number;

  @Column({ comment: '作者ID', length: 64 })
  @Index()
  authorId: string;

  @Column({ nullable: true, comment: '项目标识符', length: 100 })
  @Index() // 添加索引，用于快速查找
  identifier: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  // 以下字段为运行时回填字段，不参与 ORM 映射
  author?: User;
  code?: string;
  language?: string;
  status?: ItemStatus;
  version?: number;
  matchUrls?: string[];
  reviewComment?: string;
  versionId?: number;
  upgradeFromVersionId?: number | null;
  upgradeFrom?: Item | null;
  dependencies?: Item[];
  purchasedBy?: User[];
  comments?: Comment[];
}
