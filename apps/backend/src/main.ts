import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
dotenv.config();

import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  // 🔑 CORS DO FASTIFY (ESSENCIAL PARA SSE)
  await app.register(fastifyCors, {
    origin: [
      'https://esus.dumont.sp.gov.br',
      'https://pec.guatapara.sp.gov.br',
      'http://localhost:3000',
    ],
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
