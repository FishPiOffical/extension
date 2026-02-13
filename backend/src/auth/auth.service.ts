import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import Fishpi, { IUserLite } from 'fishpi';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(user: IUserLite) {
    const userDetail = await this.usersService.getUser(user.userName);
    await this.usersService.save(userDetail)
    const isAdmin = userDetail?.role === '管理员';
    const payload = { username: user.userName, sub: user.oId, isAdmin };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.oId,
        username: user.userName,
        isAdmin,
      },
    };
  }
}
