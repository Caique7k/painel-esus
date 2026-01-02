import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
dotenv.config();

import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import fastifyStatic from '@fastify/static';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app
    .getHttpAdapter()
    .getInstance()
    .register(fastifyStatic, {
      root: path.join(process.cwd(), 'audios'),
      prefix: '/audios/',
    });

  await app.listen(3001, '0.0.0.0');
}

bootstrap();
