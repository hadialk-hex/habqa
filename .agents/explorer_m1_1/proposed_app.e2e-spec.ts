import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { cleanDatabase, seedDefaultTenant } from './db-cleanup';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Compile NestJS AppModule once for the entire suite to optimize speed
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    // Retrieve global PrismaService instance from thecompiled module
    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Perform database isolation cleanup and seeding before each test case
    await cleanDatabase(prisma);
    await seedDefaultTenant(prisma);
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterAll(async () => {
    // Perform final cleanup and close NestJS application to prevent open handle warnings
    await cleanDatabase(prisma);
    await app.close();
  });
});
