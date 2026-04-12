import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConsensusController } from './consensus.controller';
import { ConsensusService } from './consensus.service';

describe('ConsensusController', () => {
  let controller: ConsensusController;
  let service: jest.Mocked<ConsensusService>;

  beforeEach(async () => {
    service = {
      getOutcome: jest.fn(),
      getEvaluations: jest.fn(),
      getPolls: jest.fn(),
      createPoll: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsensusController],
      providers: [{ provide: ConsensusService, useValue: service }],
    }).compile();

    controller = module.get<ConsensusController>(ConsensusController);
  });

  describe('GET /sessions/:id/outcome', () => {
    it('should return the discussion outcome', async () => {
      const outcome = {
        id: 'o1',
        sessionId: 's1',
        executiveSummary: 'Summary',
        decisions: ['D1'],
        actionItems: [],
        keyArguments: [],
        openQuestions: [],
        finalEvaluation: null,
        generatedAt: new Date(),
        generatedBy: 'claude-sonnet',
      };
      service.getOutcome.mockResolvedValue(outcome as any);

      const result = await controller.getOutcome('s1');
      expect(result).toEqual(outcome);
    });

    it('should throw 404 if no outcome exists', async () => {
      service.getOutcome.mockResolvedValue(null);
      await expect(controller.getOutcome('s1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /sessions/:id/evaluations', () => {
    it('should return evaluations for a session', async () => {
      const evals = [{ id: 'e1', roundNumber: 1, convergenceScore: 0.5 }];
      service.getEvaluations.mockResolvedValue(evals as any);

      const result = await controller.getEvaluations('s1');
      expect(result).toEqual(evals);
    });
  });

  describe('POST /sessions/:id/poll', () => {
    it('should create a user-initiated poll', async () => {
      const poll = { id: 'p1', sessionId: 's1', proposal: 'Use REST', createdBy: 'user', status: 'open' };
      service.createPoll.mockResolvedValue(poll as any);

      const result = await controller.createPoll('s1', { proposal: 'Use REST' });
      expect(result).toEqual(poll);
      expect(service.createPoll).toHaveBeenCalledWith('s1', 'Use REST', 'user');
    });
  });

  describe('GET /sessions/:id/polls', () => {
    it('should return polls for a session', async () => {
      const polls = [{ id: 'p1', votes: [] }];
      service.getPolls.mockResolvedValue(polls as any);

      const result = await controller.getPolls('s1');
      expect(result).toEqual(polls);
    });
  });
});
