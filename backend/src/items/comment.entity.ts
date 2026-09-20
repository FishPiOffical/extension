import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { User } from '../users/user.entity';
import { Item } from './item.entity';

@Entity()
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text', { comment: '评论内容' })
  content: string;

  @CreateDateColumn({ comment: '发布时间' })
  createdAt: Date;

  @Column({ default: false, comment: '是否屏蔽' })
  isBlocked: boolean;

  @Column({ default: 0, comment: '被举报次数' })
  reportCount: number;

  @Column({ default: false, comment: '管理员已处理位' })
  isHandled: boolean;

  @Column({ comment: '发布者ID', length: 64 })
  @Index()
  authorId: string;

  @Column({ comment: '作品ID' })
  @Index()
  itemId: number;

  @Column({ nullable: true, comment: '父评论ID' })
  @Index()
  parentId: number;

  // 以下字段为运行时回填字段，不参与 ORM 映射
  item?: Item;
  author?: User;
  parent?: Comment;
  replies?: Comment[];
}
