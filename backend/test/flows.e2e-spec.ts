import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase, seedDefaultTenant } from './db-cleanup';
import { randomUUID } from 'crypto';

jest.setTimeout(30000);

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockImplementation((pwd) => Promise.resolve(`hashed_${pwd}`)),
  compare: jest
    .fn()
    .mockImplementation((pwd, hash) =>
      Promise.resolve(hash === `hashed_${pwd}`),
    ),
}));

describe('Flows Engine (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await seedDefaultTenant(prisma);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'flowowner@example.com',
        name: 'Flow Owner',
        password: 'securepassword123',
        tenantName: 'Flow Tenant',
      })
      .expect(201);

    token = res.body.access_token;
    tenantId = res.body.user.tenantId;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('Flows CRUD & Save transactional APIs', () => {
    it('should create a flow with triggers, steps, and branches', async () => {
      const stepId1 = randomUUID();
      const stepId2 = randomUUID();

      const res = await request(app.getHttpServer())
        .post('/flows')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Sales Flow',
          description: 'A flow to handle inbound pricing inquiries',
          isActive: true,
          triggers: [
            {
              type: 'KEYWORD',
              configuration: {
                keywords: 'price, pricing, cost',
                nextStepId: stepId1,
              },
            },
          ],
          steps: [
            {
              id: stepId1,
              type: 'SEND_MESSAGE',
              configuration: {
                text: 'Thanks for reaching out! ||| Hello there!',
                mediaUrl: '',
              },
              metadata: { x: 100, y: 150, name: 'Welcome Message' },
              branches: [
                {
                  label: 'Next',
                  condition: {},
                  nextStepId: stepId2,
                },
              ],
            },
            {
              id: stepId2,
              type: 'ADD_TAG',
              configuration: { tag: 'lead' },
              metadata: { x: 400, y: 150, name: 'Tag Lead' },
              branches: [],
            },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Sales Flow');
      expect(res.body.isActive).toBe(true);
      expect(res.body.triggers).toHaveLength(1);
      expect(res.body.steps).toHaveLength(2);

      // Verify DB storage directly
      const flowInDb = await prisma.flow.findUnique({
        where: { id: res.body.id },
        include: {
          triggers: true,
          steps: {
            include: { branches: true },
          },
        },
      });

      expect(flowInDb).toBeDefined();
      expect(flowInDb!.name).toBe('Sales Flow');
      expect(flowInDb!.triggers[0].type).toBe('KEYWORD');
      expect(flowInDb!.steps[0].type).toBe('SEND_MESSAGE');
      expect(flowInDb!.steps[0].id).toBe(stepId1); // preserved step UUID!
      expect(flowInDb!.steps[0].branches[0].nextStepId).toBe(stepId2);
    });

    it('should retrieve all flows for a tenant', async () => {
      await prisma.flow.create({
        data: {
          tenantId,
          name: 'Flow A',
          isActive: false,
        },
      });

      const res = await request(app.getHttpServer())
        .get('/flows')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Flow A');
    });

    it('should retrieve a single flow with complete details', async () => {
      const flow = await prisma.flow.create({
        data: {
          tenantId,
          name: 'Flow B',
          isActive: true,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/flows/${flow.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(flow.id);
      expect(res.body.name).toBe('Flow B');
    });

    it('should update a flow using transactional save replacing triggers/steps', async () => {
      const flow = await prisma.flow.create({
        data: {
          tenantId,
          name: 'Flow C',
          isActive: false,
        },
      });

      // Insert dummy old triggers/steps to test cascade deletion
      await prisma.flowTrigger.create({
        data: {
          flowId: flow.id,
          type: 'ANY_COMMENT',
        },
      });

      const oldStep = await prisma.flowStep.create({
        data: {
          flowId: flow.id,
          type: 'WAIT_DELAY',
          configuration: { delayAmount: 10, delayUnit: 'minutes' },
        },
      });

      await prisma.flowBranch.create({
        data: {
          stepId: oldStep.id,
          label: 'Default',
        },
      });

      const newStepId = randomUUID();

      const res = await request(app.getHttpServer())
        .put(`/flows/${flow.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Flow C Updated',
          isActive: true,
          triggers: [
            {
              type: 'NEW_SUBSCRIBER',
              configuration: {},
            },
          ],
          steps: [
            {
              id: newStepId,
              type: 'ADD_TAG',
              configuration: { tag: 'customer' },
              metadata: { x: 100, y: 100 },
              branches: [],
            },
          ],
        })
        .expect(200);

      expect(res.body.name).toBe('Flow C Updated');
      expect(res.body.isActive).toBe(true);
      expect(res.body.triggers).toHaveLength(1);
      expect(res.body.triggers[0].type).toBe('NEW_SUBSCRIBER');
      expect(res.body.steps).toHaveLength(1);
      expect(res.body.steps[0].type).toBe('ADD_TAG');
      expect(res.body.steps[0].id).toBe(newStepId);

      // Verify database cleaned up old values
      const triggerCount = await prisma.flowTrigger.count({
        where: { flowId: flow.id },
      });
      const stepCount = await prisma.flowStep.count({
        where: { flowId: flow.id },
      });
      const branchCount = await prisma.flowBranch.count({
        where: { step: { flowId: flow.id } },
      });

      expect(triggerCount).toBe(1);
      expect(stepCount).toBe(1);
      expect(branchCount).toBe(0);
    });

    it('should toggle active status of a flow', async () => {
      const flow = await prisma.flow.create({
        data: {
          tenantId,
          name: 'Flow D',
          isActive: false,
        },
      });

      const res = await request(app.getHttpServer())
        .put(`/flows/${flow.id}/toggle`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: true })
        .expect(200);

      expect(res.body.isActive).toBe(true);

      const flowInDb = await prisma.flow.findUnique({ where: { id: flow.id } });
      expect(flowInDb!.isActive).toBe(true);
    });

    it('should delete a flow and all related elements', async () => {
      const flow = await prisma.flow.create({
        data: {
          tenantId,
          name: 'Flow E',
        },
      });

      await prisma.flowTrigger.create({
        data: {
          flowId: flow.id,
          type: 'ANY_COMMENT',
        },
      });

      await request(app.getHttpServer())
        .delete(`/flows/${flow.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const flowInDb = await prisma.flow.findUnique({ where: { id: flow.id } });
      expect(flowInDb).toBeNull();

      const triggersCount = await prisma.flowTrigger.count({
        where: { flowId: flow.id },
      });
      expect(triggersCount).toBe(0);
    });
  });
});
