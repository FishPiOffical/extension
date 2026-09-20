import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique, Index } from 'typeorm';
import { ItemStatus } from './item.entity';

@Entity()
@Unique(['itemId', 'version'])
@Index(['itemId', 'status'])
@Index(['status', 'createdAt'])
export class ItemCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  itemId: number;

  @Column({ default: 1, comment: '版本号' })
  version: number;

  @Column({ comment: '编程语言' })
  language: string;

  @Column({ type: 'simple-enum', enum: ItemStatus, default: ItemStatus.PENDING, comment: '审核状态' })
  status: ItemStatus;

  @Column({ type: 'simple-array', nullable: true, comment: '生效网址' })
  matchUrls: string[];

  @Column({ nullable: true, comment: '升级来源版本ID' })
  @Index()
  upgradeFromCodeId: number;

  @Column('longtext', { comment: '项目代码内容' })
  code: string;

  @Column({ nullable: true, comment: '审核意见' })
  reviewComment: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
