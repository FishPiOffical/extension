import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import Fishpi, { UserInfo } from 'fishpi';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async save(user: UserInfo): Promise<User> {
    let account: User = await this.findById(user.oId);
    if (account) {
      account.username = user.userName;
      account.nickname = user.userNickname;
      account.isAdmin = user.role === '管理员';
      account.avatar = user.avatar;
      await this.usersRepository.update({ id: account.id }, account);
      return account;
    }
    account = {
      id: user.oId,
      username: user.userName,
      nickname: user.userNickname,
      isAdmin: user.role === '管理员',
      avatar: user.avatar,
      createdAt: new Date(),
      items: [],
      purchasedItems: [],
    }
    return this.usersRepository.save(account);
  }

  async findOne(username: string, includeRelations: boolean = false): Promise<User | undefined> {
    if (includeRelations) {
      return this.usersRepository.findOne({ where: { username }, relations: ['items', 'purchasedItems'] });
    }
    return this.usersRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async updatePoints(userId: string, points: number): Promise<void> {
    
  }

  getUser(username: string) {
    return new Fishpi().user(username);
  }
}
