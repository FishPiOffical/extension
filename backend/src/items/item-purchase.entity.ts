import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, Index } from 'typeorm';

@Entity()
@Unique(['itemId', 'userId'])
@Index(['itemId'])
@Index(['userId'])
export class ItemPurchase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  itemId: number;

  @Column({ length: 64 })
  userId: string;

  @CreateDateColumn({ comment: '购买时间' })
  createdAt: Date;
}
