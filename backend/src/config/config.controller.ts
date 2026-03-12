import { Controller, Post, Body, Get, Put } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigData } from './config.dto';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('status')
  async getConfigStatus() {
    return { configured: ConfigService.isConfigured() };
  }

  @Post()
  async setupConfig(@Body() body: ConfigData) {
    if (ConfigService.isConfigured()) {
      return { message: 'Already configured' };
    }
    this.configService.saveConfig(body);
    return { message: 'Configuration saved' };
  }

  @Put()
  async updateConfig(@Body() body: Partial<ConfigData>) {
    if (!ConfigService.isConfigured()) {
      return { message: 'Not configured yet' };
    }
    const currentConfig = ConfigService.getConfig();
    const updatedConfig = { ...currentConfig, ...body };
    this.configService.saveConfig(updatedConfig);
    return { message: 'Configuration updated' };
  }
}

@Controller('config')
export class ConfigedController {
  constructor(private readonly configService: ConfigService) {}

  @Get('status')
  async getConfigStatus() {
    return { configured: ConfigService.isConfigured() };
  }

}