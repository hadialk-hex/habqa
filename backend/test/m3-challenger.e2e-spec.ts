import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from '../src/dashboard/dashboard.service';
import { BroadcastsService } from '../src/broadcasts/broadcasts.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { InboxService } from '../src/inbox/inbox.service';

describe('Challenger 1 Milestone 3 E2E/Unit Verification Tests', () => {
  let dashboardService: DashboardService;
  let broadcastsService: BroadcastsService;

  const mockPrisma = {
    conversation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    message: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    autoReplyRule: {
      count: jest.fn(),
    },
    platformConnection: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    broadcast: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    subscriber: {
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        BroadcastsService,
        { provide: PrismaService, useValue: mockPrisma },
        // BroadcastsService.execute() now sends through InboxService (see
        // broadcasts.service.ts) — mocked here since these tests only
        // exercise the cron/scheduling logic, either via a spied execute()
        // or with no due broadcasts, never the real send path.
        { provide: InboxService, useValue: { sendMessage: jest.fn() } },
      ],
    }).compile();

    dashboardService = module.get<DashboardService>(DashboardService);
    broadcastsService = module.get<BroadcastsService>(BroadcastsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Dashboard Analytics Trend Math Verification', () => {
    async function runStatsTest(counts: {
      totalSubscribers: any[];
      prevSubscribers: any[];
      totalAutoReplies: number;
      prevAutoReplies: number;
      activeConversations: number;
      prevConversations: number;
      totalRules: number;
      prevRules: number;
    }) {
      mockPrisma.conversation.findMany
        .mockResolvedValueOnce(counts.totalSubscribers) // current subscribers
        .mockResolvedValueOnce(counts.prevSubscribers) // prev subscribers
        .mockResolvedValueOnce([]); // recentConversations in getStats

      mockPrisma.message.count
        .mockResolvedValueOnce(counts.totalAutoReplies)
        .mockResolvedValueOnce(counts.prevAutoReplies);

      mockPrisma.conversation.count
        .mockResolvedValueOnce(counts.activeConversations)
        .mockResolvedValueOnce(counts.prevConversations);

      mockPrisma.autoReplyRule.count
        .mockResolvedValueOnce(counts.totalRules)
        .mockResolvedValueOnce(counts.prevRules);

      mockPrisma.platformConnection.findMany.mockResolvedValue([]);
      mockPrisma.message.findMany.mockResolvedValue([]);

      return dashboardService.getStats('tenant-id');
    }

    it('Scenario: Previous period count is 0 and current is 0 (should return 0.0)', async () => {
      const stats = await runStatsTest({
        totalSubscribers: [],
        prevSubscribers: [],
        totalAutoReplies: 0,
        prevAutoReplies: 0,
        activeConversations: 0,
        prevConversations: 0,
        totalRules: 0,
        prevRules: 0,
      });

      expect(stats.subscribersTrend).toBe(0);
      expect(stats.autoRepliesTrend).toBe(0);
      expect(stats.conversationsTrend).toBe(0);
      expect(stats.rulesTrend).toBe(0);
    });

    it('Scenario: Previous period count is 0 and current is >0 (should return 100.0)', async () => {
      const stats = await runStatsTest({
        totalSubscribers: [{ customerId: 'c1' }],
        prevSubscribers: [],
        totalAutoReplies: 5,
        prevAutoReplies: 0,
        activeConversations: 10,
        prevConversations: 0,
        totalRules: 1,
        prevRules: 0,
      });

      expect(stats.subscribersTrend).toBe(100);
      expect(stats.autoRepliesTrend).toBe(100);
      expect(stats.conversationsTrend).toBe(100);
      expect(stats.rulesTrend).toBe(100);
    });

    it('Scenario: Extremely large counts (checking float overflow or precision anomalies)', async () => {
      // Test with MAX_SAFE_INTEGER
      const stats = await runStatsTest({
        totalSubscribers: new Array(1), // not using long arrays in mock, we'll mock return length
        prevSubscribers: [],
        totalAutoReplies: Number.MAX_SAFE_INTEGER,
        prevAutoReplies: 1,
        activeConversations: Number.MAX_SAFE_INTEGER,
        prevConversations: Number.MAX_SAFE_INTEGER,
        totalRules: Number.MAX_SAFE_INTEGER,
        prevRules: 1,
      });

      // Override the subscribers length check as we mocked findMany result length
      mockPrisma.conversation.findMany.mockReset();
      // Setup mock to return length of Number.MAX_SAFE_INTEGER is impractical directly,
      // but let's test how calcTrend handles MAX_SAFE_INTEGER and large values for autoReplies
      expect(stats.autoRepliesTrend).toBeDefined();
      expect(stats.autoRepliesTrend).toBeGreaterThan(0);
      expect(stats.conversationsTrend).toBe(0); // curr === prev
    });

    it('Scenario: Negative counts (hypothetical overflow/boundary checks)', async () => {
      const stats = await runStatsTest({
        totalSubscribers: [],
        prevSubscribers: [],
        totalAutoReplies: -5,
        prevAutoReplies: -10,
        activeConversations: -10,
        prevConversations: -5,
        totalRules: 5,
        prevRules: -5,
      });

      // Let's trace trend calculation:
      // autoRepliesTrend: curr = -5, prev = -10
      // pct = ((-5 - (-10)) / -10) * 100 = (5 / -10) * 100 = -50%
      expect(stats.autoRepliesTrend).toBe(-50);

      // conversationsTrend: curr = -10, prev = -5
      // pct = ((-10 - (-5)) / -5) * 100 = (-5 / -5) * 100 = 100%
      expect(stats.conversationsTrend).toBe(100); // Decreased from -5 to -10, but returned +100% trend!
    });
  });

  describe('2. Campaign Scheduling, Cron, and Concurrency Verification', () => {
    it('should verify minutely cron executing multiple campaigns sequentially rather than concurrently', async () => {
      const scheduledCampaigns = [
        {
          id: 'c1',
          tenantId: 'tenant-1',
          name: 'C1',
          status: 'SCHEDULED',
          scheduledAt: new Date(),
        },
        {
          id: 'c2',
          tenantId: 'tenant-1',
          name: 'C2',
          status: 'SCHEDULED',
          scheduledAt: new Date(),
        },
      ];

      mockPrisma.broadcast.findMany.mockResolvedValue(scheduledCampaigns);

      // Spy/Mock execute to delay execution
      const executionTimes: { id: string; start: number; end: number }[] = [];
      const executeSpy = jest
        .spyOn(broadcastsService, 'execute')
        .mockImplementation(async (tenantId, id) => {
          const start = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async work
          const end = Date.now();
          executionTimes.push({ id, start, end });
          return { id, status: 'SENT' } as any;
        });

      await broadcastsService.handleScheduledBroadcasts();

      expect(executeSpy).toHaveBeenCalledTimes(2);

      // If execution was concurrent, C2 should have started before C1 finished.
      // If execution was sequential, C2 must start after C1 ends.
      const c1Time = executionTimes.find((t) => t.id === 'c1')!;
      const c2Time = executionTimes.find((t) => t.id === 'c2')!;

      expect(c1Time).toBeDefined();
      expect(c2Time).toBeDefined();

      // Sequential execution check: B2 starts after B1 ends
      const wasSequential =
        c2Time.start >= c1Time.end || c1Time.start >= c2Time.end;
      expect(wasSequential).toBe(true); // Verification that execution is sequential, not concurrent!
    });

    it('should demonstrate double-execution race condition due to lack of immediate status update / lock', async () => {
      const scheduledCampaign = {
        id: 'campaign-race',
        tenantId: 'tenant-1',
        name: 'Race Campaign',
        status: 'SCHEDULED',
        scheduledAt: new Date(),
      };

      // Set up: first cron run fetches campaign-race because status is SCHEDULED.
      mockPrisma.broadcast.findMany.mockResolvedValueOnce([scheduledCampaign]);
      // Second cron run (after 1 min) also fetches it because status is still SCHEDULED while running.
      mockPrisma.broadcast.findMany.mockResolvedValueOnce([scheduledCampaign]);

      // Mock execute to simulate long execution (takes 500ms)
      const executeCount = { start: 0, finish: 0 };
      const executeSpy = jest
        .spyOn(broadcastsService, 'execute')
        .mockImplementation(async (tenantId, id) => {
          executeCount.start++;
          await new Promise((resolve) => setTimeout(resolve, 200)); // takes 200ms
          executeCount.finish++;
          return { id, status: 'SENT' } as any;
        });

      // Start the first cron execution (simulate first minute)
      const firstCronRun = broadcastsService.handleScheduledBroadcasts();

      // Simulate second cron run firing 50ms later (while first is still in progress)
      await new Promise((resolve) => setTimeout(resolve, 50));
      const secondCronRun = broadcastsService.handleScheduledBroadcasts();

      // Await both runs to complete
      await Promise.all([firstCronRun, secondCronRun]);

      // Assert: The campaign was executed TWICE!
      expect(executeSpy).toHaveBeenCalledTimes(2);
      expect(executeCount.start).toBe(2);
      expect(executeCount.finish).toBe(2);
    });
  });
});
