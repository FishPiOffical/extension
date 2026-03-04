import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from 'typeorm';
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

  @Column({ comment: '发布者ID' })
  authorId: string;

  @Column({ comment: '作品ID' })
  itemId: number;

  @Column({ nullable: true, comment: '父评论ID' })
  parentId: number;

  @ManyToOne(() => Item, item => item.comments, { createForeignKeyConstraints: false })
  item: Item;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  author: User;

  @ManyToOne(() => Comment, comment => comment.replies, { nullable: true, createForeignKeyConstraints: false })
  parent: Comment;

  @OneToMany(() => Comment, comment => comment.parent)
  replies: Comment[];
}
