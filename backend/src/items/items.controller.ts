import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Request,
  ForbiddenException,
  ParseIntPipe,
  Res,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ItemsService } from './items.service';
import { UsersService } from '../users/users.service';
import { ItemStatus, ItemType } from './item.entity';
import { defaultAllowGlobals, loaderCode } from '../utils/injection';

@Controller('items')
export class ItemsController {
  constructor(
    private itemsService: ItemsService,
    private usersService: UsersService,
  ) {}

  @Get()
  async findAll() {
    return this.itemsService.findAll(ItemStatus.APPROVED);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  async findPending(@Request() req) {
    if (!req.user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.itemsService.findAll(ItemStatus.PENDING);
  }

  @Get('my-purchases')
  @UseGuards(JwtAuthGuard)
  async getMyPurchases(@Request() req) {
    return this.itemsService.getUserPurchases(req.user.userId);
  }

  @Get('my-published')
  @UseGuards(JwtAuthGuard)
  async getMyPublished(@Request() req) {
    return this.itemsService.findMyItems(req.user.userId);
  }

  @Get('my-drafts')
  @UseGuards(JwtAuthGuard)
  async getMyDrafts(@Request() req) {
    return this.itemsService.findMyDrafts(req.user.userId);
  }

  @Get('author/:username')
  async getByAuthor(@Param('username') username: string) {
    return this.itemsService.findByAuthor(username);
  }

  @Get(':id.js')
  async getItemCode(@Param('id') id: number, @Res() res) {
    const item = await this.itemsService.findOne(id);
    if (item.status !== ItemStatus.APPROVED) {
      throw new ForbiddenException('Item not approved');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/javascript');
    if (item.type !== ItemType.EXTENSION) {
      res.send(`console.warn('Only extension type items can be loaded as scripts');`);
      return;
    }
    const allowGlobals = defaultAllowGlobals;
    const code =`export const activate = async (window, document, token) => {
  const { ${allowGlobals.join(', ')} } = window; // 允许访问这些全局变量
  let globalThis; // 禁止访问 globalThis
  ${item.code}
}
`;
    res.send(code);
  }

  @Get(':id.css')
  async getItemStyle(@Param('id', ParseIntPipe) id: number, @Res() res) {
    const item = await this.itemsService.findOne(id);
    if (item.status !== ItemStatus.APPROVED) {
      throw new ForbiddenException('Item not approved');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'text/css');
    if (item.type !== ItemType.THEME) {
      res.send(`/* Only theme type items can be loaded as styles */`);
      return;
    }
    res.send(item.code);
  }

  @Get(':id/loader.js')
  async getLoader(@Param('id') id: string, @Res() res) {
    const user = await this.usersService.findById(id);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/javascript');
    if (!user) {
      res.send(`
        const scriptSrc = new URL(import.meta.url);
        console.info("${user.username} 还没注册哦~");
        console.info(\`访问 \${scriptSrc.origin} 登录账号添加扩展吧！\`);
      `);
      return;
    }

    const items = await this.itemsService.getUserPurchases(user.id);
    const extensionIds = items.filter(p => p.type === 'extension' && p.isEnabled).map(i => i.id);
    const themeIds = items.filter(p => p.type === 'theme' && p.isEnabled).map(i => i.id);

    res.send(loaderCode()
      .replace(/`{{#Ids}}`/, extensionIds.join(', '))
      .replace(/`{{#Themes}}`/, themeIds.join(', '))
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    // Try to get userId from token if present, but don't require it
    let userId = undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        // We can't easily access JwtService here without injecting it.
        // For simplicity, let's just use the service without userId for now, 
        // OR I can use the JwtAuthGuard and make it return 401 only if token is INVALID but not MISSING.
      } catch (e) {}
    }
    
    return this.itemsService.findOne(id);
  }

  @Get(':id/versions')
  async getVersions(@Param('id', ParseIntPipe) id: number) {
    return this.itemsService.findVersions(id);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  async createItem(
    @Body() body: { name: string; description: string; price: string; type: ItemType; code: string; language: string; upgradeFromId?: number; isDraft?: boolean },
    @Request() req,
  ) {
    return this.itemsService.create(
      {
        name: body.name,
        description: body.description,
        type: body.type,
        code: body.code,
        language: body.language,
        price: parseInt(body.price) || 0,
      },
      req.user.userId,
      body.upgradeFromId,
      body.isDraft || false,
    );
  }

  @Post(':id/withdraw')
  @UseGuards(JwtAuthGuard)
  async withdraw(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.itemsService.withdraw(id, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.itemsService.delete(id, req.user.userId);
  }

  @Post(':id/review')
  @UseGuards(JwtAuthGuard)
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: ItemStatus; comment?: string },
    @Request() req,
  ) {
    if (!req.user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
    return this.itemsService.review(id, body.status, body.comment);
  }

  @Post(':id/purchase')
  @UseGuards(JwtAuthGuard)
  async purchase(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.itemsService.purchase(id, req.user.userId);
  }

  @Post(':id/toggle')
  @UseGuards(JwtAuthGuard)
  async toggleState(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { isEnabled: boolean },
    @Request() req
  ) {
    return this.itemsService.toggleItemState(id, req.user.userId, body.isEnabled);
  }

  @Post('draft/:id/update')
  @UseGuards(JwtAuthGuard)
  async updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; description?: string; price?: string; type?: ItemType; code?: string; language?: string },
    @Request() req,
  ) {
    return this.itemsService.updateDraft(
      id,
      {
        name: body.name,
        description: body.description,
        type: body.type,
        code: body.code,
        language: body.language,
        price: body.price ? parseInt(body.price) : undefined,
      },
      req.user.userId,
    );
  }

  @Post('draft/:id/publish')
  @UseGuards(JwtAuthGuard)
  async publishDraft(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.itemsService.publishDraft(id, req.user.userId);
  }
}