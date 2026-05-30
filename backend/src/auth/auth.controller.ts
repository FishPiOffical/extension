import { Controller, Get, Request, Response, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import Fishpi from 'fishpi';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('login')
  async login(@Request() req, @Response() res) {
    const fishpi = new Fishpi();
    if (req.query['openid.mode'] === 'id_res') {
      const user = await fishpi.authVerify(req.query);
      if (user) {
        const authResult = await this.authService.login(user);
        res.redirect(`/?token=${authResult.access_token}`);
      }
    } else {
      const domain = new URL(req.headers.referer || `${req.protocol}://${req.headers.host}`).origin;
      res.redirect(fishpi.generateAuthURL(domain + req.path));
    }
  }

  @Get('getToken')
  async getToken(@Request() req) {
    const apiKey = req.headers['fishpi-key'];
    if (!apiKey) {
      throw new BadRequestException('未提供 fishpi-key');
    }
    const keyStr = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    const fishpi = new Fishpi(keyStr);
    try {
      const user = await fishpi.account.info();
      if (!user) {
        throw new BadRequestException('获取用户信息失败');
      }
      return await this.authService.login({
        userName: user.userName,
        oId: user.oId,
        userAvatarURL: user.avatar,
      } as any);
    } catch (error: any) {
      throw new BadRequestException(error.message || '获取用户信息或登录失败');
    }
  }
}
