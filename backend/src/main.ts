import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getConfig } from './utils/config';
import { ResponseInterceptor } from './utils/response.interceptor';
import { AllExceptionsFilter } from './utils/exception.filter';
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { join } from "path";

async function bootstrap() {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    cors: true,
  });
  app.enableCors();

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  server.use("/", express.static(join(__dirname, '..', 'public')));
  app.setGlobalPrefix('api');

  const config = getConfig();
  const port = config.port;

  await app.listen(port);
  console.log(`Backend server is running on http://localhost:${port}`);
}
bootstrap();
