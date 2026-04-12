/**
 * Tests for memory config fields on Expert DTOs.
 *
 * Verifies that CreateExpertDto accepts memoryEnabled, memoryMaxEntries,
 * memoryMaxInject fields and that ExpertResponseDto exposes them.
 */
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateExpertDto } from './create-expert.dto';
import { ExpertResponseDto } from './expert-response.dto';

describe('CreateExpertDto — memory fields', () => {
  const validBase = {
    name: 'Test Expert',
    specialty: 'Testing',
    systemPrompt: 'You are a test expert with memory capabilities',
    driverType: 'OPENAI',
    config: { model: 'gpt-4' },
  };

  it('should accept memoryEnabled as optional boolean', async () => {
    const dto = plainToInstance(CreateExpertDto, {
      ...validBase,
      memoryEnabled: true,
    });
    const errors = await validate(dto);
    const memoryEnabledErrors = errors.filter((e) => e.property === 'memoryEnabled');
    expect(memoryEnabledErrors).toHaveLength(0);
  });

  it('should accept memoryMaxEntries as optional integer', async () => {
    const dto = plainToInstance(CreateExpertDto, {
      ...validBase,
      memoryMaxEntries: 100,
    });
    const errors = await validate(dto);
    const maxEntriesErrors = errors.filter((e) => e.property === 'memoryMaxEntries');
    expect(maxEntriesErrors).toHaveLength(0);
  });

  it('should accept memoryMaxInject as optional integer', async () => {
    const dto = plainToInstance(CreateExpertDto, {
      ...validBase,
      memoryMaxInject: 10,
    });
    const errors = await validate(dto);
    const maxInjectErrors = errors.filter((e) => e.property === 'memoryMaxInject');
    expect(maxInjectErrors).toHaveLength(0);
  });

  it('should reject memoryMaxEntries below 1', async () => {
    const dto = plainToInstance(CreateExpertDto, {
      ...validBase,
      memoryMaxEntries: 0,
    });
    const errors = await validate(dto);
    const maxEntriesErrors = errors.filter((e) => e.property === 'memoryMaxEntries');
    expect(maxEntriesErrors.length).toBeGreaterThan(0);
  });

  it('should reject memoryMaxEntries above 500', async () => {
    const dto = plainToInstance(CreateExpertDto, {
      ...validBase,
      memoryMaxEntries: 501,
    });
    const errors = await validate(dto);
    const maxEntriesErrors = errors.filter((e) => e.property === 'memoryMaxEntries');
    expect(maxEntriesErrors.length).toBeGreaterThan(0);
  });

  it('should reject memoryMaxInject below 1', async () => {
    const dto = plainToInstance(CreateExpertDto, {
      ...validBase,
      memoryMaxInject: 0,
    });
    const errors = await validate(dto);
    const maxInjectErrors = errors.filter((e) => e.property === 'memoryMaxInject');
    expect(maxInjectErrors.length).toBeGreaterThan(0);
  });

  it('should reject memoryMaxInject above 20', async () => {
    const dto = plainToInstance(CreateExpertDto, {
      ...validBase,
      memoryMaxInject: 21,
    });
    const errors = await validate(dto);
    const maxInjectErrors = errors.filter((e) => e.property === 'memoryMaxInject');
    expect(maxInjectErrors.length).toBeGreaterThan(0);
  });

  it('should pass validation without memory fields (all optional)', async () => {
    const dto = plainToInstance(CreateExpertDto, validBase);
    const errors = await validate(dto);
    // Only check that no memory-related errors exist
    const memoryErrors = errors.filter((e) =>
      ['memoryEnabled', 'memoryMaxEntries', 'memoryMaxInject'].includes(e.property),
    );
    expect(memoryErrors).toHaveLength(0);
  });
});

describe('ExpertResponseDto — memory fields', () => {
  it('should expose memoryEnabled field', () => {
    const dto = new ExpertResponseDto({
      id: 'exp1',
      name: 'Test',
      specialty: 'Testing',
      systemPrompt: 'prompt',
      driverType: 'OPENAI' as any,
      config: { model: 'gpt-4' },
      memoryEnabled: true,
      memoryMaxEntries: 50,
      memoryMaxInject: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(dto.memoryEnabled).toBe(true);
  });

  it('should expose memoryMaxEntries field', () => {
    const dto = new ExpertResponseDto({
      id: 'exp1',
      name: 'Test',
      specialty: 'Testing',
      systemPrompt: 'prompt',
      driverType: 'OPENAI' as any,
      config: { model: 'gpt-4' },
      memoryEnabled: true,
      memoryMaxEntries: 100,
      memoryMaxInject: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(dto.memoryMaxEntries).toBe(100);
  });

  it('should expose memoryMaxInject field', () => {
    const dto = new ExpertResponseDto({
      id: 'exp1',
      name: 'Test',
      specialty: 'Testing',
      systemPrompt: 'prompt',
      driverType: 'OPENAI' as any,
      config: { model: 'gpt-4' },
      memoryEnabled: true,
      memoryMaxEntries: 50,
      memoryMaxInject: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(dto.memoryMaxInject).toBe(7);
  });

  it('should include memory fields in fromPrisma', () => {
    const mockExpert = {
      id: 'exp1',
      name: 'Test',
      specialty: 'Testing',
      systemPrompt: 'prompt',
      driverType: 'OPENAI',
      config: { model: 'gpt-4' },
      memoryEnabled: true,
      memoryMaxEntries: 50,
      memoryMaxInject: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dto = ExpertResponseDto.fromPrisma(mockExpert as any);
    expect(dto.memoryEnabled).toBe(true);
    expect(dto.memoryMaxEntries).toBe(50);
    expect(dto.memoryMaxInject).toBe(5);
  });
});
