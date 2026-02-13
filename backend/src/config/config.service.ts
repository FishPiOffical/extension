import { Injectable } from '@nestjs/common';
import { existsSync, writeFileSync } from 'fs';
import { configPath } from '../utils/config';

@Injectable()
export class ConfigService {
  private static configPath = configPath;

  static isConfigured(): boolean {
    return existsSync(this.configPath);
  }

  saveConfig(config: any): void {
    writeFileSync(ConfigService.configPath, JSON.stringify(config, null, 2));
    // 等待 2 秒后重启应用以应用新配置
    setTimeout(() => {
      console.log('Configuration saved. Please restart the application to apply the new settings.');
      process.exit(0);
    }, 2000);
  }

  static getConfig(): any {
    if (ConfigService.isConfigured()) {
      return require(ConfigService.configPath);
    }
    return null;
  }
}