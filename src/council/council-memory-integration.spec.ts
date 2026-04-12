/**
 * Integration tests for memory injection and generation in CouncilService.
 *
 * These tests verify that:
 * 1. CouncilService accepts MemoryService as a dependency
 * 2. buildExpertContext accepts and injects memory text
 * 3. Memory retrieval happens before each expert turn
 * 4. Memory generation fires after session concludes
 * 5. ExpertTurnStartEvent includes injectedMemoryIds
 */
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CouncilService } from './council.service';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { DriverFactory } from '../llm/factories/driver.factory';
import { MemoryService } from '../memory/memory.service';
import { SessionStatus, MemoryType } from '@prisma/client';

const mockSessionService = {
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockMessageService = {
  findBySession: jest.fn(),
  findLatestBySession: jest.fn(),
  create: jest.fn(),
  countBySession: jest.fn(),
};

const mockDriverFactory = {
  createDriver: jest.fn(),
};

const mockEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(),
};

const mockMemoryService = {
  getRelevantMemories: jest.fn(),
  formatMemoriesForInjection: jest.fn(),
  generateSessionMemory: jest.fn(),
};

describe('CouncilService — Memory Integration', () => {
  let service: CouncilService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouncilService,
        { provide: SessionService, useValue: mockSessionService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: DriverFactory, useValue: mockDriverFactory },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: MemoryService, useValue: mockMemoryService },
      ],
    }).compile();

    service = module.get<CouncilService>(CouncilService);
    jest.clearAllMocks();
  });

  it('should be defined with MemoryService dependency', () => {
    expect(service).toBeDefined();
  });

  describe('memory injection during discussion', () => {
    it('should retrieve relevant memories before building expert context', async () => {
      const mockSession = {
        id: 'sess1',
        problemStatement: 'Design an API',
        status: SessionStatus.PENDING,
        statusDisplay: 'pending',
        maxMessages: 20,
        consensusReached: false,
        experts: [
          {
            id: 'exp1',
            name: 'API Expert',
            specialty: 'API Design',
            systemPrompt: 'You are an API expert',
            driverType: 'OPENAI',
            config: { model: 'gpt-5.4-mini' },
            memoryEnabled: true,
            memoryMaxInject: 5,
          },
        ],
      };

      const mockDriver = {
        chat: jest.fn().mockResolvedValue({
          content: 'I agree with the approach. Consensus reached.',
        }),
      };

      mockSessionService.findOne.mockResolvedValue(mockSession);
      mockMessageService.countBySession.mockResolvedValue(0);
      mockMessageService.findLatestBySession.mockResolvedValue([]);
      mockMessageService.create.mockResolvedValue({
        id: 'msg1',
        content: 'I agree with the approach. Consensus reached.',
        expertId: 'exp1',
        expertName: 'API Expert',
      });
      mockDriverFactory.createDriver.mockReturnValue(mockDriver);
      mockMemoryService.getRelevantMemories.mockResolvedValue({
        memories: [
          {
            id: 'mem1',
            content: 'Previous API discussion insights',
            type: 'SESSION_SUMMARY',
          },
        ],
        ids: ['mem1'],
      });
      mockMemoryService.formatMemoriesForInjection.mockReturnValue(
        'Relevant Memory from Past Sessions:\n---\nPrevious API discussion insights\n---',
      );
      mockSessionService.update.mockResolvedValue({});
      mockMemoryService.generateSessionMemory.mockResolvedValue(undefined);

      await service.startDiscussion('sess1');

      // Verify memory was retrieved for the expert
      expect(mockMemoryService.getRelevantMemories).toHaveBeenCalledWith(
        'exp1',
        'Design an API',
        5,
      );
      expect(mockMemoryService.formatMemoriesForInjection).toHaveBeenCalled();
    });

    it('should skip memory retrieval when expert has memoryEnabled=false', async () => {
      const mockSession = {
        id: 'sess1',
        problemStatement: 'Design an API',
        status: SessionStatus.PENDING,
        statusDisplay: 'pending',
        maxMessages: 20,
        consensusReached: false,
        experts: [
          {
            id: 'exp1',
            name: 'API Expert',
            specialty: 'API Design',
            systemPrompt: 'You are an API expert',
            driverType: 'OPENAI',
            config: { model: 'gpt-5.4-mini' },
            memoryEnabled: false,
            memoryMaxInject: 5,
          },
        ],
      };

      const mockDriver = {
        chat: jest.fn().mockResolvedValue({
          content: 'Consensus reached.',
        }),
      };

      mockSessionService.findOne.mockResolvedValue(mockSession);
      mockMessageService.countBySession.mockResolvedValue(0);
      mockMessageService.findLatestBySession.mockResolvedValue([]);
      mockMessageService.create.mockResolvedValue({
        id: 'msg1',
        content: 'Consensus reached.',
        expertId: 'exp1',
        expertName: 'API Expert',
      });
      mockDriverFactory.createDriver.mockReturnValue(mockDriver);
      mockSessionService.update.mockResolvedValue({});

      await service.startDiscussion('sess1');

      expect(mockMemoryService.getRelevantMemories).not.toHaveBeenCalled();
    });
  });

  describe('memory generation after session', () => {
    it('should generate memory for each expert after session concludes', async () => {
      const mockSession = {
        id: 'sess1',
        problemStatement: 'Design an API',
        status: SessionStatus.PENDING,
        statusDisplay: 'pending',
        maxMessages: 20,
        consensusReached: false,
        experts: [
          {
            id: 'exp1',
            name: 'Expert 1',
            specialty: 'API Design',
            systemPrompt: 'You are expert 1',
            driverType: 'OPENAI',
            config: { model: 'gpt-5.4-mini' },
            memoryEnabled: true,
            memoryMaxInject: 5,
          },
          {
            id: 'exp2',
            name: 'Expert 2',
            specialty: 'Security',
            systemPrompt: 'You are expert 2',
            driverType: 'OPENAI',
            config: { model: 'gpt-5.4-mini' },
            memoryEnabled: true,
            memoryMaxInject: 5,
          },
        ],
      };

      const mockDriver = {
        chat: jest.fn().mockResolvedValue({
          content: 'I agree. Consensus reached.',
        }),
      };

      mockSessionService.findOne.mockResolvedValue(mockSession);
      mockMessageService.countBySession.mockResolvedValue(0);
      mockMessageService.findLatestBySession.mockResolvedValue([]);
      mockMessageService.create.mockResolvedValue({
        id: 'msg1',
        content: 'I agree. Consensus reached.',
        expertId: 'exp1',
        expertName: 'Expert 1',
      });
      mockDriverFactory.createDriver.mockReturnValue(mockDriver);
      mockMemoryService.getRelevantMemories.mockResolvedValue({
        memories: [],
        ids: [],
      });
      mockMemoryService.formatMemoriesForInjection.mockReturnValue('');
      mockSessionService.update.mockResolvedValue({});
      mockMemoryService.generateSessionMemory.mockResolvedValue(undefined);

      await service.startDiscussion('sess1');

      // Memory generation is now non-blocking — flush microtasks
      await new Promise((r) => process.nextTick(r));

      expect(mockMemoryService.generateSessionMemory).toHaveBeenCalledWith('exp1', 'sess1');
      expect(mockMemoryService.generateSessionMemory).toHaveBeenCalledWith('exp2', 'sess1');
    });
  });

  describe('ExpertTurnStartEvent with injectedMemoryIds', () => {
    it('should include injectedMemoryIds in EXPERT_TURN_START event', async () => {
      const mockSession = {
        id: 'sess1',
        problemStatement: 'Design an API',
        status: SessionStatus.PENDING,
        statusDisplay: 'pending',
        maxMessages: 20,
        consensusReached: false,
        experts: [
          {
            id: 'exp1',
            name: 'Expert 1',
            specialty: 'API Design',
            systemPrompt: 'You are expert 1',
            driverType: 'OPENAI',
            config: { model: 'gpt-5.4-mini' },
            memoryEnabled: true,
            memoryMaxInject: 5,
          },
        ],
      };

      const mockDriver = {
        chat: jest.fn().mockResolvedValue({
          content: 'Consensus reached.',
        }),
      };

      mockSessionService.findOne.mockResolvedValue(mockSession);
      mockMessageService.countBySession.mockResolvedValue(0);
      mockMessageService.findLatestBySession.mockResolvedValue([]);
      mockMessageService.create.mockResolvedValue({
        id: 'msg1',
        content: 'Consensus reached.',
        expertId: 'exp1',
        expertName: 'Expert 1',
      });
      mockDriverFactory.createDriver.mockReturnValue(mockDriver);
      mockMemoryService.getRelevantMemories.mockResolvedValue({
        memories: [{ id: 'mem1', content: 'Past insight' }],
        ids: ['mem1'],
      });
      mockMemoryService.formatMemoriesForInjection.mockReturnValue('Memory text');
      mockSessionService.update.mockResolvedValue({});
      mockMemoryService.generateSessionMemory.mockResolvedValue(undefined);

      await service.startDiscussion('sess1');

      // Find the EXPERT_TURN_START event emission
      const turnStartCalls = mockEventEmitter.emit.mock.calls.filter(
        (call) => call[0] === 'discussion.expert.turn.start',
      );
      expect(turnStartCalls.length).toBeGreaterThan(0);
      expect(turnStartCalls[0][1]).toHaveProperty('injectedMemoryIds', ['mem1']);
    });
  });
});
