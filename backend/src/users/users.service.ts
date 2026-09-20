import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from './user.entity';
import { Comment } from '../items/comment.entity';
import { Item } from '../items/item.entity';
import Fishpi, { FingerTo, UserInfo } from 'fishpi';
import { ConfigService } from 'src/config/config.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Item)
    private itemRepository: Repository<Item>,
  ) {}

  async findUserComments(userId: string, page: number = 1, limit: number = 10): Promise<{ items: Comment[], total: number }> {
    const [items, total] = await this.commentRepository.findAndCount({
      where: { authorId: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const itemIds = Array.from(new Set(items.map(comment => comment.itemId).filter(Boolean)));
    let itemMap = new Map<number, Item>();
    if (itemIds.length > 0) {
      const linkedItems = await this.itemRepository.find({ where: { id: In(itemIds) } });
      itemMap = new Map(linkedItems.map(item => [item.id, item]));
    }

    items.forEach(comment => {
      comment.item = itemMap.get(comment.itemId) || null;
    });

    return { items, total };
  }

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
    }
    return this.usersRepository.save(account);
  }

  async findOne(username: string, includeRelations: boolean = false): Promise<User | undefined> {
    if (includeRelations) {
      return this.usersRepository.findOne({ where: { username } });
    }
    return this.usersRepository.findOne({ where: { username } });
  }

  async findById(id: string): Promise<User | undefined> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async updatePoints(username: string, points: number, remark: string): Promise<void> {
    const goldenKey = ConfigService.getConfig()?.goldenKey;
    if (!goldenKey) {
      throw new Error('Golden key not configured');
    }
    const pointFinger = FingerTo(goldenKey);
    pointFinger.editUserPoints(username, points, remark);
  }

  getUser(username: string) {
    return new Fishpi().user(username);
  }
}
