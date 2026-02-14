import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, ManyToMany, JoinTable } from 'typeorm';
import { User } from '../users/user.entity';

export enum ItemType {
  EXTENSION = 'extension',
  THEME = 'theme',
}

export enum ItemStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity()
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

  @ManyToOne(() => User, user => user.items)
  author: User;

  @Column({ nullable: true })
  upgradeFromId: number;

  @ManyToOne(() => Item, { nullable: true })
  upgradeFrom: Item;

  @ManyToMany(() => User, user => user.purchasedItems)
  @JoinTable()
  purchasedBy: User[];

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @Column({ nullable: true, comment: '审核意见' })
  reviewComment: string;
}
