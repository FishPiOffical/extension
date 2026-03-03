import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getConfig } from './utils/config';
import { ResponseInterceptor } from './utils/response.interceptor';
import { AllExceptionsFilter } from './utils/exception.filter';
import { json, urlencoded } from 'express';
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });
  app.enableCors();

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');

  const config = getConfig();
  const port = config.port;

  await app.listen(port);
  console.log(`Backend server is running on http://localhost:${port}`);
}
bootstrap();
