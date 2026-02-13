import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';
import { User } from '../users/user.entity';
import { Item } from './item.entity';

@Entity()
@Unique(['user', 'item'])
export class UserItemState {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  user: User;

  @ManyToOne(() => Item)
  item: Item;

  @Column({ default: true, comment: '是否启用' })
  isEnabled: boolean;
}
