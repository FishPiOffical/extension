import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThan, Repository } from 'typeorm';
import { promisify } from 'util';
import { gzip, gunzip } from 'zlib';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { Item, ItemStatus, ItemType, ItemTypeLabels } from './item.entity';
import { Comment } from './comment.entity';
import { UserItemState } from './user-item-state.entity';
import { GlobalStorage } from './global-storage.entity';
import { ItemCode } from './item-code.entity';
import { ItemDependency } from './item-dependency.entity';
import { ItemPurchase } from './item-purchase.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { FingerTo } from 'fishpi';
import { ConfigService } from 'src/config/config.service';

type ViewBuildOptions = {
  includeCode?: boolean;
  includeDependencies?: boolean;
  includeUpgradeFrom?: boolean;
};

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private itemsRepository: Repository<Item>,
    @InjectRepository(ItemCode)
    private itemCodeRepository: Repository<ItemCode>,
    @InjectRepository(ItemDependency)
    private itemDependencyRepository: Repository<ItemDependency>,
    @InjectRepository(ItemPurchase)
    private itemPurchaseRepository: Repository<ItemPurchase>,
    @InjectRepository(UserItemState)
    private itemStateRepository: Repository<UserItemState>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(GlobalStorage)
    private globalStorageRepository: Repository<GlobalStorage>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
  ) {}

  private readonly approvedItemsCache = new Map<number, any>();
  private readonly CACHE_DIR = path.join(process.cwd(), 'cache', 'items');
  private readonly gzipAsync = promisify(gzip);
  private readonly gunzipAsync = promisify(gunzip);

  private uniqueNumberIds(ids: number[]): number[] {
    return Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
  }

  private uniqueStringIds(ids: string[]): string[] {
    return Array.from(new Set(ids.filter(Boolean)));
  }

  private async writeApprovedItemCache(item: any): Promise<void> {
    try {
      await fsp.mkdir(this.CACHE_DIR, { recursive: true });
      const compressed = await this.gzipAsync(JSON.stringify(item));
      await fsp.writeFile(path.join(this.CACHE_DIR, `${item.id}.json.gz`), compressed);
    } catch (e) {
      console.error(`Failed to write item cache [${item.id}]:`, e);
    }
  }

  private async getLatestCodeForProject(itemId: number, status?: ItemStatus): Promise<ItemCode | null> {
    const where: any = { itemId };
    if (status) {
      where.status = status;
    }
    const rows = await this.itemCodeRepository.find({
      where,
      order: { version: 'DESC', createdAt: 'DESC' },
      take: 1,
    });
    return rows[0] || null;
  }

  private async getLatestCodeMapByProjectIds(itemIds: number[], status?: ItemStatus): Promise<Map<number, ItemCode>> {
    const projectIds = this.uniqueNumberIds(itemIds);
    const out = new Map<number, ItemCode>();
    if (projectIds.length === 0) {
      return out;
    }

    const qb = this.itemCodeRepository.createQueryBuilder('code')
      .where('code.itemId IN (:...projectIds)', { projectIds })
      .orderBy('code.itemId', 'ASC')
      .addOrderBy('code.version', 'DESC')
      .addOrderBy('code.createdAt', 'DESC');

    if (status) {
      qb.andWhere('code.status = :status', { status });
    }

    const rows = await qb.getMany();
    for (const row of rows) {
      if (!out.has(row.itemId)) {
        out.set(row.itemId, row);
      }
    }
    return out;
  }

  private async resolveProjectByAnyId(id: number): Promise<Item> {
    const code = await this.itemCodeRepository.findOne({ where: { id } });
    if (code) {
      const project = await this.itemsRepository.findOne({ where: { id: code.itemId } });
      if (!project) {
        throw new NotFoundException('找不到项目');
      }
      return project;
    }

    const project = await this.itemsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('找不到项目');
    }
    return project;
  }

  private async resolveCodeByAnyId(id: number, preferredStatus?: ItemStatus): Promise<{ code: ItemCode; project: Item }> {
    let code = await this.itemCodeRepository.findOne({ where: { id } });

    if (!code) {
      const project = await this.itemsRepository.findOne({ where: { id } });
      if (!project) {
        throw new NotFoundException('找不到项目');
      }

      code = await this.getLatestCodeForProject(project.id, preferredStatus);
      if (!code && preferredStatus) {
        code = await this.getLatestCodeForProject(project.id);
      }
      if (!code) {
        throw new NotFoundException('找不到版本');
      }
      return { code, project };
    }

    const project = await this.itemsRepository.findOne({ where: { id: code.itemId } });
    if (!project) {
      throw new NotFoundException('找不到项目');
    }

    return { code, project };
  }

  private async resolveCodeForOperation(id: number, allowed: ItemStatus[]): Promise<{ code: ItemCode; project: Item }> {
    const direct = await this.itemCodeRepository.findOne({ where: { id } });
    if (direct && allowed.includes(direct.status)) {
      const project = await this.itemsRepository.findOne({ where: { id: direct.itemId } });
      if (!project) {
        throw new NotFoundException('找不到项目');
      }
      return { code: direct, project };
    }

    const project = await this.itemsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('找不到项目');
    }

    const rows = await this.itemCodeRepository.find({
      where: { itemId: project.id, status: In(allowed) as any },
      order: { version: 'DESC', createdAt: 'DESC' },
      take: 1,
    });
    const code = rows[0];
    if (!code) {
      throw new NotFoundException('找不到版本');
    }

    return { code, project };
  }

  private async hasProjectPurchase(itemId: number, userId: string): Promise<boolean> {
    return (await this.itemPurchaseRepository.count({ where: { itemId, userId } })) > 0;
  }

  private async ensureProjectPurchase(itemId: number, userId: string): Promise<void> {
    if (!(await this.hasProjectPurchase(itemId, userId))) {
      await this.itemPurchaseRepository.save(this.itemPurchaseRepository.create({ itemId, userId }));
    }
  }

  private async replaceDependencies(projectId: number, dependencyProjectIds: number[] = []): Promise<void> {
    await this.itemDependencyRepository.delete({ itemId: projectId });
    const depIds = this.uniqueNumberIds(dependencyProjectIds).filter((id) => id !== projectId);
    if (depIds.length === 0) {
      return;
    }

    const deps = await this.itemsRepository.find({ where: { id: In(depIds) } });
    await this.itemDependencyRepository.save(
      deps.map((dep) => this.itemDependencyRepository.create({ itemId: projectId, dependencyItemId: dep.id })),
    );
  }

  private async buildItemViewsFromCodes(codes: ItemCode[], options: ViewBuildOptions = {}): Promise<any[]> {
    if (!codes || codes.length === 0) {
      return [];
    }

    const includeCode = options.includeCode ?? false;
    const includeDependencies = options.includeDependencies ?? true;
    const includeUpgradeFrom = options.includeUpgradeFrom ?? true;

    const projectIds = this.uniqueNumberIds(codes.map((code) => code.itemId));
    const projects = await this.itemsRepository.find({ where: { id: In(projectIds) } });
    const projectMap = new Map(projects.map((project) => [project.id, project]));

    const authorIds = this.uniqueStringIds(projects.map((project) => project.authorId));
    const authors = authorIds.length > 0
      ? await this.usersRepository.find({ where: { id: In(authorIds) } })
      : [];
    const authorMap = new Map(authors.map((author) => [author.id, author]));

    const dependencyMap = new Map<number, any[]>();
    if (includeDependencies) {
      const links = await this.itemDependencyRepository.find({ where: { itemId: In(projectIds) } });
      const depProjectIds = this.uniqueNumberIds(links.map((link) => link.dependencyItemId));
      const depCodeMap = await this.getLatestCodeMapByProjectIds(depProjectIds, ItemStatus.APPROVED);
      const depCodes = Array.from(depCodeMap.values());
      const depViews = await this.buildItemViewsFromCodes(depCodes, {
        includeCode: false,
        includeDependencies: false,
        includeUpgradeFrom: false,
      });
      const depViewMap = new Map<number, any>();
      depViews.forEach((depView) => {
        depViewMap.set(depView.projectId, depView);
      });

      links.forEach((link) => {
        const depView = depViewMap.get(link.dependencyItemId);
        if (!depView) {
          return;
        }
        if (!dependencyMap.has(link.itemId)) {
          dependencyMap.set(link.itemId, []);
        }
        dependencyMap.get(link.itemId).push(depView);
      });
    }

    const upgradeMap = new Map<number, any>();
    if (includeUpgradeFrom) {
      const parentCodeIds = this.uniqueNumberIds(codes.map((code) => code.upgradeFromCodeId).filter(Boolean));
      if (parentCodeIds.length > 0) {
        const parentCodes = await this.itemCodeRepository.find({ where: { id: In(parentCodeIds) } });
        const parentViews = await this.buildItemViewsFromCodes(parentCodes, {
          includeCode,
          includeDependencies: false,
          includeUpgradeFrom: false,
        });
        parentViews.forEach((view) => {
          upgradeMap.set(view.id, view);
        });
      }
    }

    const views = codes
      .map((code) => {
        const project = projectMap.get(code.itemId);
        if (!project) {
          return null;
        }

        const view: any = {
          id: code.id,
          projectId: project.id,
          name: project.name,
          description: project.description,
          type: project.type,
          price: project.price,
          identifier: project.identifier,
          authorId: project.authorId,
          author: authorMap.get(project.authorId) || null,
          language: code.language,
          status: code.status,
          version: code.version,
          matchUrls: code.matchUrls,
          reviewComment: code.reviewComment,
          upgradeFromId: code.upgradeFromCodeId || null,
          createdAt: code.createdAt,
          code: includeCode ? code.code : undefined,
          dependencies: includeDependencies ? (dependencyMap.get(project.id) || []) : [],
          upgradeFrom: includeUpgradeFrom ? (upgradeMap.get(code.upgradeFromCodeId) || null) : null,
        };

        return view;
      })
      .filter(Boolean);

    return views;
  }

  private validateCodeByType(type: ItemType, code: string): void {
    if (type === ItemType.APP_EXTENSION) {
      if (!code) {
        throw new BadRequestException('代码不能为空');
      }
      const regex = /\/\/\s*==FishPiPlugin==[\s\S]*?\/\/\s*==\/FishPiPlugin==/;
      if (!regex.test(code)) {
        throw new BadRequestException('APP扩展内容前端必须包含 // ==FishPiPlugin== 与 // ==/FishPiPlugin== 元数据');
      }
      return;
    }

    if (type === ItemType.APP_THEME) {
      if (!code) {
        throw new BadRequestException('配置内容不能为空');
      }
      try {
        const parsed = JSON.parse(code);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new BadRequestException('APP主题内容必须是一个有效的JSON对象');
        }
      } catch (e: any) {
        throw new BadRequestException('APP主题内容必须是一个合法的JSON格式: ' + e.message);
      }
      return;
    }

    if (!code) {
      throw new BadRequestException('代码不能为空');
    }
  }

  private async sendPublishNotice(itemView: any): Promise<void> {
    if (itemView.status !== ItemStatus.PENDING) {
      return;
    }

    const config = ConfigService.getConfig();
    if (!config?.noticeGoldenKey || !config?.noticeUsers) {
      return;
    }

    const noticeFinger = FingerTo(config.noticeGoldenKey);
    config.noticeUsers.split(',').forEach((username) => {
      noticeFinger.sendNotice(
        username.trim(),
        `用户${itemView.author?.username}发布了新的${ItemTypeLabels[itemView.type]}《${itemView.name}》[待审核](https://ext.adventext.fun/admin)`,
      );
    });
  }

  public async findApprovedItemById(id: number): Promise<any | null> {
    const cached = this.approvedItemsCache.get(id);
    if (cached?.code !== undefined) {
      return cached;
    }

    try {
      const compressed = await fsp.readFile(path.join(this.CACHE_DIR, `${id}.json.gz`));
      const decompressed = await this.gunzipAsync(compressed);
      const item = JSON.parse(decompressed.toString('utf-8'));
      if (item?.code !== undefined) {
        this.approvedItemsCache.set(id, item);
        return item;
      }
    } catch {
      // cache miss
    }

    let code = await this.itemCodeRepository.findOne({ where: { id } });
    if (!code) {
      const project = await this.itemsRepository.findOne({ where: { id } });
      if (!project) {
        return null;
      }
      code = await this.getLatestCodeForProject(project.id, ItemStatus.APPROVED);
    }

    if (!code) {
      return null;
    }

    const [view] = await this.buildItemViewsFromCodes([code], {
      includeCode: true,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });

    if (!view) {
      return null;
    }

    if (view.status === ItemStatus.APPROVED) {
      this.approvedItemsCache.set(view.id, view);
      this.writeApprovedItemCache(view);
    }

    return view;
  }

  async create(
    data: Partial<Item>,
    authorId: string,
    upgradeFromId?: number,
    isDraft: boolean = false,
    dependencyIds?: number[],
  ): Promise<any> {
    const versionCode = (data as any).code || '';
    const versionLanguage = (data as any).language;
    const versionMatchUrls = (data as any).matchUrls;

    this.validateCodeByType(data.type, versionCode);

    const author = await this.usersService.findById(authorId);
    if (!author) {
      throw new NotFoundException('找不到此用户');
    }

    let project: Item;
    let fromCode: ItemCode | null = null;
    let nextVersion = 1;

    if (upgradeFromId) {
      const resolved = await this.resolveCodeByAnyId(upgradeFromId);
      fromCode = resolved.code;
      project = resolved.project;

      if (project.authorId !== authorId) {
        throw new UnauthorizedException('无权升级此项目');
      }

      const existing = await this.itemCodeRepository.findOne({
        where: [
          { itemId: project.id, status: ItemStatus.PENDING },
          { itemId: project.id, status: ItemStatus.DRAFT },
        ],
      });
      if (existing) {
        throw new BadRequestException('该作品已有正在进行的升级或草稿');
      }

      nextVersion = (fromCode.version || 0) + 1;

      project.name = data.name;
      project.description = data.description;
      project.type = data.type;
      project.price = data.price ?? 0;
    } else {
      project = this.itemsRepository.create({
        name: data.name,
        description: data.description,
        type: data.type,
        price: data.price ?? 0,
        authorId,
        identifier: data.identifier || null,
      });
    }

    if (project.identifier && data.identifier && project.identifier !== data.identifier) {
      throw new BadRequestException('一旦设定，标识符不可修改');
    }

    if (!project.identifier && data.identifier) {
      project.identifier = data.identifier;
    }

    const savedProject = await this.itemsRepository.save(project);

    const codeRow = this.itemCodeRepository.create({
      itemId: savedProject.id,
      version: nextVersion,
      language: versionLanguage,
      status: isDraft ? ItemStatus.DRAFT : ItemStatus.PENDING,
      matchUrls: data.type === ItemType.APP_EXTENSION || data.type === ItemType.APP_THEME ? null : versionMatchUrls,
      code: versionCode,
      reviewComment: null,
      upgradeFromCodeId: fromCode?.id || null,
    });

    const savedCode = await this.itemCodeRepository.save(codeRow);

    if (data.type === ItemType.APP_EXTENSION || data.type === ItemType.APP_THEME) {
      await this.replaceDependencies(savedProject.id, []);
    } else if (dependencyIds) {
      await this.replaceDependencies(savedProject.id, dependencyIds);
    }

    const [view] = await this.buildItemViewsFromCodes([savedCode], {
      includeCode: true,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });

    await this.sendPublishNotice(view);
    return view;
  }

  async findAll(
    status?: ItemStatus,
    search?: string,
    type?: ItemType,
    page?: number,
    limit?: number,
  ): Promise<{ items: any[]; total: number }> {
    const qb = this.itemsRepository.createQueryBuilder('item');

    if (type) {
      qb.andWhere('item.type = :type', { type });
    }

    if (search) {
      qb.andWhere('(item.name LIKE :search OR item.description LIKE :search)', { search: `%${search}%` });
    }

    const projects = await qb.getMany();
    const projectIds = projects.map((project) => project.id);

    let codeMap: Map<number, ItemCode>;
    if (status) {
      codeMap = await this.getLatestCodeMapByProjectIds(projectIds, status);
    } else {
      codeMap = await this.getLatestCodeMapByProjectIds(projectIds);
    }

    let codes = Array.from(codeMap.values());
    codes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = codes.length;
    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      codes = codes.slice(skip, skip + limit);
    }

    const items = await this.buildItemViewsFromCodes(codes, {
      includeCode: false,
      includeDependencies: true,
      includeUpgradeFrom: status === ItemStatus.PENDING || status === ItemStatus.DRAFT,
    });

    return { items, total };
  }

  async findByAuthor(username: string): Promise<any[]> {
    const author = await this.usersRepository.findOne({ where: { username } });
    if (!author) {
      return [];
    }

    const projects = await this.itemsRepository.find({ where: { authorId: author.id } });
    const codeMap = await this.getLatestCodeMapByProjectIds(
      projects.map((project) => project.id),
      ItemStatus.APPROVED,
    );
    const codes = Array.from(codeMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return this.buildItemViewsFromCodes(codes, {
      includeCode: false,
      includeDependencies: true,
      includeUpgradeFrom: false,
    });
  }

  async addComment(itemId: number, userId: string, content: string, parentId?: number): Promise<Comment> {
    const project = await this.resolveProjectByAnyId(itemId);

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('找不到此用户');
    }

    if (parentId) {
      const parent = await this.commentRepository.findOne({ where: { id: parentId } });
      if (!parent) {
        throw new NotFoundException('找不到父评论');
      }
    }

    const comment = this.commentRepository.create({
      content,
      authorId: userId,
      itemId: project.id,
      parentId,
    });

    return this.commentRepository.save(comment);
  }

  async getComments(itemId: number): Promise<Comment[]> {
    const project = await this.resolveProjectByAnyId(itemId);

    const roots = await this.commentRepository.find({
      where: { itemId: project.id, parentId: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (roots.length === 0) {
      return [];
    }

    const rootIds = roots.map((comment) => comment.id);
    const replies = await this.commentRepository.find({
      where: { parentId: In(rootIds) },
      order: { createdAt: 'ASC' },
    });

    const authorIds = this.uniqueStringIds([
      ...roots.map((comment) => comment.authorId),
      ...replies.map((comment) => comment.authorId),
    ]);
    const authors = authorIds.length > 0
      ? await this.usersRepository.find({ where: { id: In(authorIds) } })
      : [];
    const authorMap = new Map(authors.map((author) => [author.id, author]));

    const rootMap = new Map<number, Comment>();
    roots.forEach((root) => {
      root.author = authorMap.get(root.authorId) || null;
      root.replies = [];
      rootMap.set(root.id, root);
    });

    replies.forEach((reply) => {
      reply.author = authorMap.get(reply.authorId) || null;
      const parent = rootMap.get(reply.parentId);
      if (parent) {
        parent.replies.push(reply);
      }
    });

    return roots;
  }

  async blockComment(commentId: number, adminId: string): Promise<Comment> {
    const admin = await this.usersService.findById(adminId);
    if (!admin || !admin.isAdmin) {
      throw new ForbiddenException('仅管理员可执行此操作');
    }

    const comment = await this.commentRepository.findOne({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('找不到此评论');
    }

    comment.isBlocked = true;
    comment.isHandled = true;
    return this.commentRepository.save(comment);
  }

  async reportComment(commentId: number): Promise<Comment> {
    const comment = await this.commentRepository.findOne({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('找不到此评论');
    }
    comment.reportCount += 1;
    return this.commentRepository.save(comment);
  }

  async getReportedComments(adminId: string): Promise<Comment[]> {
    const admin = await this.usersService.findById(adminId);
    if (!admin || !admin.isAdmin) {
      throw new ForbiddenException('仅管理员可访问');
    }

    const comments = await this.commentRepository.find({
      where: { reportCount: MoreThan(0), isHandled: false },
      order: { reportCount: 'DESC', createdAt: 'DESC' },
    });

    if (comments.length === 0) {
      return [];
    }

    const authorIds = this.uniqueStringIds(comments.map((comment) => comment.authorId));
    const itemIds = this.uniqueNumberIds(comments.map((comment) => comment.itemId));

    const [authors, items] = await Promise.all([
      authorIds.length > 0 ? this.usersRepository.find({ where: { id: In(authorIds) } }) : Promise.resolve([]),
      itemIds.length > 0 ? this.itemsRepository.find({ where: { id: In(itemIds) } }) : Promise.resolve([]),
    ]);

    const authorMap = new Map(authors.map((author) => [author.id, author]));
    const itemMap = new Map(items.map((item) => [item.id, item]));

    comments.forEach((comment) => {
      comment.author = authorMap.get(comment.authorId) || null;
      comment.item = itemMap.get(comment.itemId) || null;
    });

    return comments;
  }

  async ignoreReport(commentId: number, adminId: string): Promise<Comment> {
    const admin = await this.usersService.findById(adminId);
    if (!admin || !admin.isAdmin) {
      throw new ForbiddenException('仅管理员可执行');
    }

    const comment = await this.commentRepository.findOne({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('找不到此评论');
    }

    comment.isHandled = true;
    return this.commentRepository.save(comment);
  }

  // 组装单个版本详情响应，供 id 与 identifier 两种入口复用
  private async buildDetailPayload(code: ItemCode, project: Item, userId?: string): Promise<any> {
    const [view] = await this.buildItemViewsFromCodes([code], {
      includeCode: true,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });

    if (!view) {
      throw new NotFoundException('没找到');
    }

    const isPurchased = userId ? await this.hasProjectPurchase(project.id, userId) : false;
    const purchaseCount = await this.itemPurchaseRepository.count({ where: { itemId: project.id } });

    let isEnabled = true;
    let isAutoUpdate = true;
    if (userId) {
      const state = await this.itemStateRepository.findOne({ where: { userId, itemId: project.id } });
      if (state) {
        isEnabled = state.isEnabled;
        isAutoUpdate = state.isAutoUpdate;
      }
    }

    return { ...view, isEnabled, isAutoUpdate, isPurchased, purchaseCount };
  }

  async findOne(id: number, userId?: string): Promise<any> {
    const { code, project } = await this.resolveCodeByAnyId(id, ItemStatus.APPROVED);

    if (code.status !== ItemStatus.APPROVED && project.authorId !== userId) {
      throw new ForbiddenException('Item not approved');
    }

    return this.buildDetailPayload(code, project, userId);
  }

  // 按项目标识符读取详情，version 省略时取最新的已审核版本
  async findOneByIdentifier(identifier: string, version?: number, userId?: string): Promise<any> {
    if (!identifier) {
      throw new NotFoundException('没找到');
    }

    const project = await this.itemsRepository.findOne({ where: { identifier } });
    if (!project) {
      throw new NotFoundException('没找到');
    }

    let code: ItemCode | null = null;

    if (version !== undefined && version !== null && !Number.isNaN(version)) {
      code = await this.itemCodeRepository.findOne({ where: { itemId: project.id, version } });
    } else {
      code = await this.getLatestCodeForProject(project.id, ItemStatus.APPROVED);
      if (!code) {
        code = await this.getLatestCodeForProject(project.id);
      }
    }

    if (!code) {
      throw new NotFoundException('找不到版本');
    }

    if (code.status !== ItemStatus.APPROVED && project.authorId !== userId) {
      throw new ForbiddenException('Item not approved');
    }

    return this.buildDetailPayload(code, project, userId);
  }

  async getRecursiveDependencies(itemId: number): Promise<any[]> {
    const project = await this.resolveProjectByAnyId(itemId);

    const visited = new Set<number>();
    let frontier = [project.id];

    while (frontier.length > 0) {
      const links = await this.itemDependencyRepository.find({ where: { itemId: In(frontier) } });
      const next: number[] = [];
      for (const link of links) {
        if (!visited.has(link.dependencyItemId)) {
          visited.add(link.dependencyItemId);
          next.push(link.dependencyItemId);
        }
      }
      frontier = next;
    }

    if (visited.size === 0) {
      return [];
    }

    const codeMap = await this.getLatestCodeMapByProjectIds(Array.from(visited), ItemStatus.APPROVED);
    const codes = Array.from(codeMap.values());
    return this.buildItemViewsFromCodes(codes, {
      includeCode: false,
      includeDependencies: false,
      includeUpgradeFrom: false,
    });
  }

  async findVersions(id: number, userId?: string): Promise<any[]> {
    const project = await this.resolveProjectByAnyId(id);
    const where: any = { itemId: project.id };
    if (project.authorId !== userId) {
      where.status = ItemStatus.APPROVED;
    }

    const codes = await this.itemCodeRepository.find({
      where,
      order: { version: 'DESC', createdAt: 'DESC' },
    });

    return this.buildItemViewsFromCodes(codes, {
      includeCode: false,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });
  }

  async review(id: number, status: ItemStatus, comment?: string): Promise<any> {
    const { code, project } = await this.resolveCodeByAnyId(id);

    code.status = status;
    if (comment !== undefined) {
      code.reviewComment = comment;
    }

    const savedCode = await this.itemCodeRepository.save(code);

    if (status === ItemStatus.APPROVED) {
      const states = await this.itemStateRepository.find({
        where: { itemId: project.id, isAutoUpdate: true },
      });

      for (const state of states) {
        state.selectedCodeId = savedCode.id;
        await this.itemStateRepository.save(state);
      }

      this.approvedItemsCache.set(savedCode.id, null);
      await fsp.unlink(path.join(this.CACHE_DIR, `${savedCode.id}.json.gz`)).catch(() => undefined);
    }

    const [view] = await this.buildItemViewsFromCodes([savedCode], {
      includeCode: true,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });

    const config = ConfigService.getConfig();
    if (config?.noticeGoldenKey && view?.author?.username) {
      const statusResult = {
        [ItemStatus.APPROVED]: '通过审核',
        [ItemStatus.REJECTED]: '未通过审核',
        [ItemStatus.PENDING]: '待审核',
        [ItemStatus.DRAFT]: '草稿',
      }[status] || '未知状态';

      FingerTo(config.noticeGoldenKey).sendNotice(
        view.author.username,
        `您的${ItemTypeLabels[view.type]}《[${view.name}](https://ext.adventext.fun/item/${view.id})》${statusResult}${comment ? `，评审意见：${comment}` : ''}`,
      );
    }

    return view;
  }

  async addTestItem(itemId: number, userId: string): Promise<any> {
    const { code, project } = await this.resolveCodeByAnyId(itemId);
    if (code.status !== ItemStatus.PENDING) {
      throw new BadRequestException('只能挂载待审核的项目');
    }

    await this.ensureProjectPurchase(project.id, userId);

    let state = await this.itemStateRepository.findOne({ where: { userId, itemId: project.id } });
    if (!state) {
      state = this.itemStateRepository.create({
        userId,
        itemId: project.id,
        selectedCodeId: code.id,
        isEnabled: true,
        isAutoUpdate: false,
      });
    } else {
      state.selectedCodeId = code.id;
      state.isEnabled = true;
    }
    await this.itemStateRepository.save(state);

    const [view] = await this.buildItemViewsFromCodes([code], {
      includeCode: true,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });

    if (view?.dependencies?.length > 0) {
      for (const dep of view.dependencies) {
        if (dep.price === 0) {
          try {
            await this.purchase(dep.id, userId);
          } catch {
            // ignore
          }
        }
      }
    }

    return view;
  }

  async purchase(itemId: number, userId: string): Promise<any> {
    const { code, project } = await this.resolveCodeByAnyId(itemId);

    if (code.status !== ItemStatus.APPROVED) {
      throw new BadRequestException('未通过审核');
    }

    const alreadyPurchased = await this.hasProjectPurchase(project.id, userId);

    if (!alreadyPurchased) {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new NotFoundException('找不到此用户');
      }

      const dbUser = await this.usersService.getUser(user.username);
      const points = dbUser.points;

      if (project.price > 0 && points < project.price) {
        throw new BadRequestException('积分不足，无法获取！');
      }

      if (project.price > 0 && user.id !== project.authorId) {
        const typeLabel = ItemTypeLabels[project.type];
        await this.usersService.updatePoints(user.username, -project.price, `购买${typeLabel} ${project.name}`);
        const author = await this.usersService.findById(project.authorId);
        if (author?.username) {
          await this.usersService.updatePoints(author.username, project.price * 0.7, `出售${typeLabel} ${project.name}`);
        }
        await this.usersService.updatePoints('admin', project.price * 0.3, `买卖${typeLabel} ${project.name} 手续费`);
      }

      await this.ensureProjectPurchase(project.id, userId);
    }

    const latestApproved = await this.getLatestCodeForProject(project.id, ItemStatus.APPROVED);

    let state = await this.itemStateRepository.findOne({ where: { userId, itemId: project.id } });
    if (!state) {
      state = this.itemStateRepository.create({
        userId,
        itemId: project.id,
        selectedCodeId: code.id,
        isEnabled: true,
        isAutoUpdate: latestApproved ? latestApproved.id === code.id : true,
      });
    } else {
      state.selectedCodeId = code.id;
      state.isAutoUpdate = latestApproved ? latestApproved.id === code.id : state.isAutoUpdate;
    }
    await this.itemStateRepository.save(state);

    const [view] = await this.buildItemViewsFromCodes([code], {
      includeCode: false,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });

    if (view?.dependencies?.length > 0) {
      for (const dep of view.dependencies) {
        if (dep.price === 0) {
          try {
            await this.purchase(dep.id, userId);
          } catch {
            // ignore
          }
        }
      }
    }

    return view;
  }

  async removePurchase(itemId: number, userId: string): Promise<void> {
    const project = await this.resolveProjectByAnyId(itemId);
    await this.itemPurchaseRepository.delete({ itemId: project.id, userId });
    await this.itemStateRepository.delete({ userId, itemId: project.id });
  }

  async getUserPurchases(userId: string, type?: ItemType): Promise<any[]> {
    const [purchases, states] = await Promise.all([
      this.itemPurchaseRepository.find({ where: { userId } }),
      this.itemStateRepository.find({ where: { userId } }),
    ]);

    const purchasedProjectIds = new Set(purchases.map((row) => row.itemId));
    const stateProjectIds = new Set(states.map((row) => row.itemId));

    const authoredProjects = await this.itemsRepository.find({ where: { authorId: userId } });
    const authoredProjectIds = new Set(authoredProjects.map((p) => p.id));

    const candidateProjectIds = this.uniqueNumberIds([
      ...Array.from(purchasedProjectIds),
      ...Array.from(stateProjectIds),
    ]);

    const projects = candidateProjectIds.length > 0
      ? await this.itemsRepository.find({ where: { id: In(candidateProjectIds) } })
      : [];

    const stateMap = new Map(states.map((row) => [row.itemId, row]));

    const selectedCodes: ItemCode[] = [];
    for (const project of projects) {
      if (type && project.type !== type) {
        continue;
      }

      const state = stateMap.get(project.id);
      let selected: ItemCode = null;

      if (state?.selectedCodeId) {
        const byState = await this.itemCodeRepository.findOne({ where: { id: state.selectedCodeId, itemId: project.id } });
        if (byState) {
          selected = byState;
        }
      }

      if (!selected) {
        selected = await this.getLatestCodeForProject(project.id, ItemStatus.APPROVED);
      }

      if (!selected && authoredProjectIds.has(project.id) && state) {
        selected = await this.getLatestCodeForProject(project.id);
      }

      if (!selected) {
        continue;
      }

      const visible = purchasedProjectIds.has(project.id) || (authoredProjectIds.has(project.id) && !!state);
      if (visible) {
        selectedCodes.push(selected);
      }
    }

    const views = await this.buildItemViewsFromCodes(selectedCodes, {
      includeCode: false,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });

    return views.map((view) => {
      const state = stateMap.get(view.projectId);
      return {
        ...view,
        isEnabled: state ? state.isEnabled : true,
        isAutoUpdate: state ? state.isAutoUpdate : true,
      };
    });
  }

  async toggleItemState(itemId: number, userId: string, isEnabled: boolean): Promise<any> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('找不到此用户');
    }

    const { code, project } = await this.resolveCodeByAnyId(itemId);
    const owned = project.authorId === userId || await this.hasProjectPurchase(project.id, userId);
    if (!owned) {
      throw new UnauthorizedException('您尚未拥有此项目');
    }

    let state = await this.itemStateRepository.findOne({ where: { userId, itemId: project.id } });
    if (!state) {
      state = this.itemStateRepository.create({
        userId,
        itemId: project.id,
        selectedCodeId: code.id,
        isEnabled,
        isAutoUpdate: true,
      });
    }

    state.isEnabled = isEnabled;

    if (isEnabled) {
      state.selectedCodeId = code.id;
      const latestApproved = await this.getLatestCodeForProject(project.id, ItemStatus.APPROVED);
      state.isAutoUpdate = latestApproved ? latestApproved.id === code.id : true;
    }

    await this.itemStateRepository.save(state);
    return { isEnabled: state.isEnabled, isAutoUpdate: state.isAutoUpdate };
  }

  async setAutoUpdate(itemId: number, userId: string, isAutoUpdate: boolean): Promise<any> {
    const { code, project } = await this.resolveCodeByAnyId(itemId);
    const owned = project.authorId === userId || await this.hasProjectPurchase(project.id, userId);
    if (!owned) {
      throw new UnauthorizedException('您尚未拥有此项目');
    }

    let state = await this.itemStateRepository.findOne({ where: { userId, itemId: project.id } });
    if (!state) {
      state = this.itemStateRepository.create({
        userId,
        itemId: project.id,
        selectedCodeId: code.id,
        isEnabled: true,
        isAutoUpdate,
      });
    } else {
      state.isAutoUpdate = isAutoUpdate;
      if (isAutoUpdate) {
        const latestApproved = await this.getLatestCodeForProject(project.id, ItemStatus.APPROVED);
        if (latestApproved) {
          state.selectedCodeId = latestApproved.id;
        }
      }
    }

    await this.itemStateRepository.save(state);
    return { isAutoUpdate: state.isAutoUpdate };
  }

  async withdraw(id: number, userId: string): Promise<any> {
    const { code, project } = await this.resolveCodeForOperation(id, [ItemStatus.PENDING]);
    if (project.authorId !== userId) {
      throw new UnauthorizedException('无权操作');
    }

    code.status = ItemStatus.DRAFT;
    const saved = await this.itemCodeRepository.save(code);
    const [view] = await this.buildItemViewsFromCodes([saved], {
      includeCode: false,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });
    return view;
  }

  async delete(id: number, userId: string): Promise<void> {
    const { code, project } = await this.resolveCodeForOperation(id, [ItemStatus.DRAFT]);
    if (project.authorId !== userId) {
      throw new UnauthorizedException('无权操作');
    }

    await this.itemCodeRepository.delete({ id: code.id });

    const left = await this.itemCodeRepository.count({ where: { itemId: project.id } });
    if (left === 0) {
      await this.itemStateRepository.delete({ itemId: project.id });
      await this.itemDependencyRepository.delete({ itemId: project.id });
      await this.itemDependencyRepository.delete({ dependencyItemId: project.id });
      await this.itemPurchaseRepository.delete({ itemId: project.id });
      await this.commentRepository.delete({ itemId: project.id });
      await this.itemsRepository.delete({ id: project.id });
    }

    this.approvedItemsCache.delete(code.id);
    await fsp.unlink(path.join(this.CACHE_DIR, `${code.id}.json.gz`)).catch(() => undefined);
  }

  async findMyItems(userId: string, type?: ItemType): Promise<any[]> {
    const where: any = { authorId: userId };
    if (type) {
      where.type = type;
    }

    const projects = await this.itemsRepository.find({ where });
    const projectIds = projects.map((project) => project.id);
    if (projectIds.length === 0) {
      return [];
    }

    const rows = await this.itemCodeRepository.createQueryBuilder('code')
      .where('code.itemId IN (:...projectIds)', { projectIds })
      .andWhere('code.status != :draft', { draft: ItemStatus.DRAFT })
      .orderBy('code.itemId', 'ASC')
      .addOrderBy('code.version', 'DESC')
      .addOrderBy('code.createdAt', 'DESC')
      .getMany();

    const latestMap = new Map<number, ItemCode>();
    for (const row of rows) {
      if (!latestMap.has(row.itemId)) {
        latestMap.set(row.itemId, row);
      }
    }

    return this.buildItemViewsFromCodes(Array.from(latestMap.values()), {
      includeCode: false,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });
  }

  async findMyDrafts(userId: string, type?: ItemType): Promise<any[]> {
    const where: any = { authorId: userId };
    if (type) {
      where.type = type;
    }

    const projects = await this.itemsRepository.find({ where });
    const projectIds = projects.map((project) => project.id);
    if (projectIds.length === 0) {
      return [];
    }

    const drafts = await this.itemCodeRepository.find({
      where: { itemId: In(projectIds), status: ItemStatus.DRAFT },
      order: { createdAt: 'DESC', version: 'DESC' },
    });

    return this.buildItemViewsFromCodes(drafts, {
      includeCode: false,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });
  }

  async updateDraft(id: number, data: Partial<Item>, userId: string, dependencyIds?: number[]): Promise<any> {
    const { code, project } = await this.resolveCodeForOperation(id, [ItemStatus.DRAFT]);
    if (project.authorId !== userId) {
      throw new UnauthorizedException('无权修改此草稿');
    }

    if (project.identifier && data.identifier && project.identifier !== data.identifier) {
      throw new BadRequestException('一旦设定，标识符不可修改');
    }

    const draftCode = (data as any).code;
    const effectiveCode = draftCode !== undefined ? draftCode : code.code;

    this.validateCodeByType((data.type || project.type) as ItemType, effectiveCode);

    if (data.name !== undefined) project.name = data.name;
    if (data.description !== undefined) project.description = data.description;
    if (data.price !== undefined) project.price = data.price;
    if (data.type !== undefined) project.type = data.type;
    if (!project.identifier && data.identifier) project.identifier = data.identifier;

    await this.itemsRepository.save(project);

    if ((data as any).language !== undefined) code.language = (data as any).language;
    if ((data as any).code !== undefined) code.code = (data as any).code;
    if ((data as any).matchUrls !== undefined) {
      code.matchUrls = project.type === ItemType.APP_EXTENSION || project.type === ItemType.APP_THEME
        ? null
        : (data as any).matchUrls;
    }

    const savedCode = await this.itemCodeRepository.save(code);

    if (dependencyIds && project.type !== ItemType.APP_EXTENSION && project.type !== ItemType.APP_THEME) {
      await this.replaceDependencies(project.id, dependencyIds);
    } else if (project.type === ItemType.APP_EXTENSION || project.type === ItemType.APP_THEME) {
      await this.replaceDependencies(project.id, []);
    }

    const [view] = await this.buildItemViewsFromCodes([savedCode], {
      includeCode: true,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });
    return view;
  }

  async updateIdentifier(id: number, identifier: string, userId: string): Promise<any> {
    const project = await this.resolveProjectByAnyId(id);
    if (project.authorId !== userId) {
      throw new UnauthorizedException('无权修改此作品');
    }

    if (project.identifier) {
      throw new BadRequestException('一旦设定，标识符不可修改');
    }

    if (!identifier || identifier.length < 3) {
      throw new BadRequestException('标识符长度至少为3位');
    }

    const existing = await this.itemsRepository.findOne({ where: { identifier } });
    if (existing && existing.id !== project.id) {
      throw new BadRequestException('该标识符已被其他作品占用');
    }

    project.identifier = identifier;
    await this.itemsRepository.save(project);

    const latestCode = await this.getLatestCodeForProject(project.id);
    if (!latestCode) {
      return project;
    }

    const [view] = await this.buildItemViewsFromCodes([latestCode], {
      includeCode: false,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });
    return view;
  }

  async publishDraft(id: number, userId: string): Promise<any> {
    const { code, project } = await this.resolveCodeForOperation(id, [ItemStatus.DRAFT]);
    if (project.authorId !== userId) {
      throw new UnauthorizedException('无权发布此草稿');
    }

    code.status = ItemStatus.PENDING;
    const saved = await this.itemCodeRepository.save(code);

    const [view] = await this.buildItemViewsFromCodes([saved], {
      includeCode: true,
      includeDependencies: true,
      includeUpgradeFrom: true,
    });

    await this.sendPublishNotice(view);
    return view;
  }

  async getStorage(userId: string, itemId: number): Promise<Record<string, any>> {
    const project = await this.resolveProjectByAnyId(itemId);
    const state = await this.itemStateRepository.findOne({ where: { userId, itemId: project.id } });
    return state?.storage || {};
  }

  async setStorageItem(userId: string, itemId: number, key: string, value: any): Promise<void> {
    const project = await this.resolveProjectByAnyId(itemId);

    let state = await this.itemStateRepository.findOne({ where: { userId, itemId: project.id } });
    if (!state) {
      const latestApproved = await this.getLatestCodeForProject(project.id, ItemStatus.APPROVED);
      state = this.itemStateRepository.create({
        userId,
        itemId: project.id,
        selectedCodeId: latestApproved?.id || null,
        storage: {},
        isEnabled: true,
        isAutoUpdate: true,
      });
    }

    if (!state.storage) {
      state.storage = {};
    }
    state.storage[key] = value;

    if (JSON.stringify(state.storage).length > 256 * 1024) {
      throw new BadRequestException('存储数据超过限制 (256KB)');
    }

    await this.itemStateRepository.save(state);
  }

  async removeStorageItem(userId: string, itemId: number, key: string): Promise<void> {
    const project = await this.resolveProjectByAnyId(itemId);
    const state = await this.itemStateRepository.findOne({ where: { userId, itemId: project.id } });
    if (state?.storage) {
      delete state.storage[key];
      await this.itemStateRepository.save(state);
    }
  }

  async clearStorage(userId: string, itemId: number): Promise<void> {
    const project = await this.resolveProjectByAnyId(itemId);
    const state = await this.itemStateRepository.findOne({ where: { userId, itemId: project.id } });
    if (state) {
      state.storage = {};
      await this.itemStateRepository.save(state);
    }
  }

  async getGlobalStorage(itemId: number): Promise<Record<string, any>> {
    const project = await this.resolveProjectByAnyId(itemId);
    if (!project.identifier) {
      return {};
    }

    const gs = await this.globalStorageRepository.findOne({ where: { identifier: project.identifier } });
    return gs?.storage || {};
  }

  async setGlobalStorageItem(itemId: number, key: string, value: any): Promise<void> {
    const project = await this.resolveProjectByAnyId(itemId);
    if (!project.identifier) {
      throw new BadRequestException('该作品尚未设置标识符，无法使用 globalStorage');
    }

    let gs = await this.globalStorageRepository.findOne({ where: { identifier: project.identifier } });
    if (!gs) {
      gs = this.globalStorageRepository.create({ identifier: project.identifier, storage: {} });
    }

    if (!gs.storage) {
      gs.storage = {};
    }

    gs.storage[key] = value;

    if (JSON.stringify(gs.storage).length > 1024 * 1024 * 10) {
      throw new BadRequestException('公用存储数据超过限制 (10MB)');
    }

    await this.globalStorageRepository.save(gs);
  }

  async removeGlobalStorageItem(itemId: number, key: string): Promise<void> {
    const project = await this.resolveProjectByAnyId(itemId);
    if (!project.identifier) {
      return;
    }

    const gs = await this.globalStorageRepository.findOne({ where: { identifier: project.identifier } });
    if (gs?.storage) {
      delete gs.storage[key];
      await this.globalStorageRepository.save(gs);
    }
  }

  async clearGlobalStorage(itemId: number): Promise<void> {
    const project = await this.resolveProjectByAnyId(itemId);
    if (!project.identifier) {
      return;
    }

    const gs = await this.globalStorageRepository.findOne({ where: { identifier: project.identifier } });
    if (gs) {
      gs.storage = {};
      await this.globalStorageRepository.save(gs);
    }
  }
}
