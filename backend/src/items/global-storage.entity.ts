import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity()
@Unique(['identifier'])
export class GlobalStorage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '作品标识符', length: 100 })
  identifier: string;

  @Column({ type: 'simple-json', nullable: true, comment: '共享配置数据' })
  storage: Record<string, any>;
}
