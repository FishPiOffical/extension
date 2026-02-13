import { Controller, Get, Request, Response } from '@nestjs/common';
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
}
