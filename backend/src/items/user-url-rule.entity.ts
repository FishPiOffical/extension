import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity()
export class UserUrlRule {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'simple-json', nullable: true, comment: '白名单地址' })
  allowUrls: string[];

  @Column({ type: 'simple-json', nullable: true, comment: '黑名单地址' })
  blockUrls: string[];
}
