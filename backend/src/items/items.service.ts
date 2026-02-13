import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item, ItemStatus } from './item.entity';
import { UserItemState } from './user-item-state.entity';
import { UsersService } from '../users/users.service';
import Fishpi from 'fishpi';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
    @InjectRepository(UserItemState)
    private itemStateRepository: Repository<UserItemState>,
    private usersService: UsersService,
  ) {}

  async create(data: Partial<Item>, authorId: string, upgradeFromId?: number, isDraft: boolean = false): Promise<Item> {
    const author = await this.usersService.findById(authorId);
    
    let version = 1;
    let upgradeFrom = null;
    if (upgradeFromId) {
      const originalItem = await this.itemsRepository.findOne({ 
        where: { id: upgradeFromId },
        relations: ['author'] 
      });
      
      if (!originalItem) {
        throw new NotFoundException('找不到要升级的项目');
      }
      
      if (originalItem.author.id !== authorId) {
         throw new UnauthorizedException('无权升级此项目');
      }

      // Check if there is already a pending or draft upgrade for this item
      const existingUpgrade = await this.itemsRepository.findOne({
        where: [
          { upgradeFrom: { id: upgradeFromId }, status: ItemStatus.PENDING },
          { upgradeFrom: { id: upgradeFromId }, status: ItemStatus.DRAFT },
        ]
      });

      if (existingUpgrade) {
        throw new BadRequestException('该作品已有正在进行的升级或草稿');
      }

      version = originalItem.version + 1;
      upgradeFrom = originalItem;
    }

    const item = this.itemsRepository.create({
      ...data,
      author,
      version,
      upgradeFrom,
      status: isDraft ? ItemStatus.DRAFT : ItemStatus.PENDING,
    });
    return this.itemsRepository.save(item);
  }

  async findAll(status?: ItemStatus): Promise<Item[]> {
    const query = this.itemsRepository.createQueryBuilder('item')
      .leftJoinAndSelect('item.author', 'author')
      .leftJoinAndSelect('item.purchasedBy', 'purchasedBy')
      .leftJoinAndSelect('item.upgradeFrom', 'upgradeFrom');
    
    if (status) {
      query.where('item.status = :status', { status });
      
      // If we are looking for APPROVED items, only show the latest version of each project
      if (status === ItemStatus.APPROVED) {
        query.andWhere(qb => {
          const subQuery = qb.subQuery()
            .select('1')
            .from(Item, 'next')
            .where('next.upgradeFromId = item.id')
            .andWhere('next.status = :status', { status: ItemStatus.APPROVED })
            .getQuery();
          return 'NOT EXISTS ' + subQuery;
        });
      }
    }
    
    return query.getMany();
  }

  async findByAuthor(username: string): Promise<Item[]> {
    const query = this.itemsRepository.createQueryBuilder('item')
      .leftJoinAndSelect('item.author', 'author')
      .leftJoinAndSelect('item.purchasedBy', 'purchasedBy')
      .leftJoinAndSelect('item.upgradeFrom', 'upgradeFrom')
      .where('author.username = :username', { username })
      .andWhere('item.status = :status', { status: ItemStatus.APPROVED });
    
    // Only show the latest version of each project
    query.andWhere(qb => {
      const subQuery = qb.subQuery()
        .select('1')
        .from(Item, 'next')
        .where('next.upgradeFromId = item.id')
        .andWhere('next.status = :status', { status: ItemStatus.APPROVED })
        .getQuery();
      return 'NOT EXISTS ' + subQuery;
    });
    
    return query.getMany();
  }

  async findOne(id: number, userId?: string): Promise<any> {
    const item = await this.itemsRepository.findOne({
      where: { id },
      relations: ['author', 'purchasedBy'],
    });
    if (!item) {
      throw new NotFoundException('没找到');
    }

    let isEnabled = true;
    if (userId) {
      const state = await this.itemStateRepository.findOne({
        where: { user: { id: userId }, item: { id } }
      });
      if (state) isEnabled = state.isEnabled;
    }

    return { ...item, isEnabled };
  }

  async findVersions(id: number): Promise<Item[]> {
    const item = await this.itemsRepository.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!item) {
      throw new NotFoundException('找不到项目');
    }

    // Find all items with same name, author and type that are APPROVED
    return this.itemsRepository.find({
      where: {
        name: item.name,
        author: { id: item.author.id },
        type: item.type,
        status: ItemStatus.APPROVED,
      },
      order: { version: 'DESC' },
    });
  }

  async review(id: number, status: ItemStatus, comment?: string): Promise<Item> {
    const item = await this.findOne(id);
    item.status = status;
    if (comment) {
      item.reviewComment = comment;
    }
    return this.itemsRepository.save(item);
  }

  async purchase(itemId: number, userId: string): Promise<Item> {
    const item = await this.findOne(itemId);
    const user = await this.usersService.findById(userId);

    if (item.status !== ItemStatus.APPROVED) {
      throw new BadRequestException('未通过审核');
    }

    // Check if already purchased
    const alreadyPurchased = item.purchasedBy?.some(u => u.id === userId);
    if (alreadyPurchased) {
      throw new BadRequestException('已经购入');
    }

    // Find all versions of the same project to check ownership and manage version single-ownership
    const allVersions = await this.itemsRepository.find({
      where: {
        name: item.name,
        author: { id: item.author.id },
        type: item.type,
      },
      relations: ['purchasedBy'],
    });

    let ownsOtherVersion = false;
    for (const v of allVersions) {
      if (v.id !== item.id && v.purchasedBy?.some(u => u.id === userId)) {
        ownsOtherVersion = true;
        // Remove ownership from other versions (User can only own one version at a time)
        v.purchasedBy = v.purchasedBy.filter(u => u.id !== userId);
        await this.itemsRepository.save(v);
      }
    }

    if (!ownsOtherVersion) {
      const dbUser = await this.usersService.getUser(user.username);
      const points = dbUser.points;

      // Check if user has enough points
      if (item.price > 0 && points < item.price) {
        throw new BadRequestException('积分不足，无法获取！');
      }

      if (item.price > 0 && user.id !== item.author.id) {
        const type = {
          javascript: '扩展',
          css: '主题',
        }[item.type];
        await this.usersService.updatePoints(user.username, -item.price, `购买${type} ${item.name}`);
        await this.usersService.updatePoints(item.author.username, item.price * 0.7, `出售${type} ${item.name}`);
        await this.usersService.updatePoints(item.author.username, item.price * 0.3, `买卖${type} ${item.name} 手续费`);
      }
    }

    // Add to purchased list
    if (!item.purchasedBy) {
      item.purchasedBy = [];
    }
    item.purchasedBy.push(user);
    return this.itemsRepository.save(item);
  }

  async getUserPurchases(userId: string): Promise<any[]> {
    const items = await this.itemsRepository.createQueryBuilder('item')
      .leftJoinAndSelect('item.author', 'author')
      .leftJoin('item.purchasedBy', 'purchasedBy')
      .where('purchasedBy.id = :userId', { userId })
      .getMany();

    const states = await this.itemStateRepository.find({
      where: { user: { id: userId } },
      relations: ['item']
    });

    return items.map(item => {
      const state = states.find(s => s.item.id === item.id);
      return {
        ...item,
        isEnabled: state ? state.isEnabled : true
      };
    });
  }

  async toggleItemState(itemId: number, userId: string, isEnabled: boolean): Promise<any> {
    const user = await this.usersService.findById(userId);
    const item = await this.findOne(itemId);

    // Check if user actually owns it
    // Check purchasedBy relations or if it is the author
    const query = this.itemsRepository.createQueryBuilder('item')
      .leftJoin('item.purchasedBy', 'purchasedBy')
      .leftJoin('item.author', 'author')
      .where('item.id = :itemId', { itemId })
      .andWhere('(purchasedBy.id = :userId OR author.id = :userId)', { userId })
      .getOne();
    
    if (!await query) {
      throw new UnauthorizedException('您尚未拥有此项目');
    }

    let state = await this.itemStateRepository.findOne({
      where: { user: { id: userId }, item: { id: itemId } }
    });

    if (!state) {
      state = this.itemStateRepository.create({
        user,
        item,
        isEnabled
      });
    } else {
      state.isEnabled = isEnabled;
    }

    await this.itemStateRepository.save(state);
    return { isEnabled: state.isEnabled };
  }

  async withdraw(id: number, userId: string): Promise<Item> {
    const item = await this.itemsRepository.findOne({
      where: { id },
      relations: ['author']
    });
    if (!item) {
      throw new NotFoundException('找不到项目');
    }
    if (item.author.id !== userId) {
      throw new UnauthorizedException('无权操作');
    }
    if (item.status !== ItemStatus.PENDING) {
      throw new BadRequestException('只有待审核的项目可以撤回');
    }
    item.status = ItemStatus.DRAFT;
    return this.itemsRepository.save(item);
  }

  async delete(id: number, userId: string): Promise<void> {
    const item = await this.itemsRepository.findOne({
      where: { id },
      relations: ['author']
    });
    if (!item) {
      throw new NotFoundException('找不到项目');
    }
    if (item.author.id !== userId) {
      throw new UnauthorizedException('无权操作');
    }
    if (item.status !== ItemStatus.DRAFT) {
      throw new BadRequestException('只有草稿可以删除');
    }
    await this.itemsRepository.remove(item);
  }

  async findMyItems(userId: string): Promise<Item[]> {
    return this.itemsRepository.createQueryBuilder('item')
      .leftJoinAndSelect('item.author', 'author')
      .leftJoinAndSelect('item.upgradeFrom', 'upgradeFrom')
      .where('author.id = :userId', { userId })
      .orderBy('item.version', 'DESC')
      .addOrderBy('item.createdAt', 'DESC')
      .getMany();
  }

  async findMyDrafts(userId: string): Promise<Item[]> {
    return this.itemsRepository.createQueryBuilder('item')
      .leftJoinAndSelect('item.author', 'author')
      .leftJoinAndSelect('item.upgradeFrom', 'upgradeFrom')
      .where('author.id = :userId', { userId })
      .andWhere('item.status = :status', { status: ItemStatus.DRAFT })
      .orderBy('item.createdAt', 'DESC')
      .getMany();
  }

  async updateDraft(id: number, data: Partial<Item>, userId: string): Promise<Item> {
    const item = await this.itemsRepository.findOne({
      where: { id, status: ItemStatus.DRAFT },
      relations: ['author'],
    });

    if (!item) {
      throw new NotFoundException('草稿不存在');
    }

    if (item.author.id !== userId) {
      throw new UnauthorizedException('无权修改此草稿');
    }

    Object.assign(item, data);
    return this.itemsRepository.save(item);
  }

  async publishDraft(id: number, userId: string): Promise<Item> {
    const item = await this.itemsRepository.findOne({
      where: { id, status: ItemStatus.DRAFT },
      relations: ['author'],
    });

    if (!item) {
      throw new NotFoundException('草稿不存在');
    }

    if (item.author.id !== userId) {
      throw new UnauthorizedException('无权发布此草稿');
    }

    item.status = ItemStatus.PENDING;
    return this.itemsRepository.save(item);
  }
}
