import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique, Index } from 'typeorm';

@Entity()
@Unique(['itemId', 'dependencyItemId'])
@Index(['itemId'])
@Index(['dependencyItemId'])
export class ItemDependency {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  itemId: number;

  @Column()
  dependencyItemId: number;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;
}
