import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToMany } from 'typeorm';
import { Item } from '../items/item.entity';

@Entity()
export class User {
  @Column({ comment: "用户ID", primary: true, unique: true })
  id: string;

  @Column({ comment: '用户名，唯一' })
  username: string;

  @Column({ comment: '用户昵称' })
  nickname: string;

  @Column({ default: false, comment: '是否为管理员' })
  isAdmin: boolean;

  @Column({ comment: '用户头像URL' })
  avatar: string;

  @CreateDateColumn({ comment: '注册时间' })
  createdAt: Date;

  @OneToMany(() => Item, item => item.author)
  items: Item[];

  @ManyToMany(() => Item, item => item.purchasedBy)
  purchasedItems: Item[];
}
