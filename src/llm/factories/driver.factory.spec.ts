jest.mock('../drivers/openai.driver', () => ({
  OpenAIDriver: jest.fn().mockImplementation(() => ({ chat: jest.fn() })),
}));
jest.mock('../drivers/claude.driver', () => ({
  ClaudeDriver: jest.fn().mockImplementation(() => ({ chat: jest.fn() })),
}));
jest.mock('../drivers/grok.driver', () => ({
  GrokDriver: jest.fn().mockImplementation(() => ({ chat: jest.fn() })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DriverType } from '@prisma/client';
import { DriverFactory } from './driver.factory';
import { OpenAIDriver } from '../drivers/openai.driver';
import { ClaudeDriver } from '../drivers/claude.driver';
import { GrokDriver } from '../drivers/grok.driver';
import {
  LLMAuthenticationException,
  LLMInvalidRequestException,
} from '../exceptions/llm.exception';

describe('DriverFactory', () => {
  let factory: DriverFactory;
  let configService: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverFactory,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    factory = module.get<DriverFactory>(DriverFactory);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('createDriver - OPENAI', () => {
    it('creates an OpenAIDriver when OPENAI_API_KEY is configured', () => {
      (configService.get as jest.Mock).mockReturnValue('sk-openai-key');

      const driver = factory.createDriver(DriverType.OPENAI);

      expect(OpenAIDriver).toHaveBeenCalledWith('sk-openai-key');
      expect(driver).toBeDefined();
    });

    it('throws LLMAuthenticationException when OPENAI_API_KEY is missing', () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      expect(() => factory.createDriver(DriverType.OPENAI)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('throws LLMAuthenticationException when OPENAI_API_KEY is empty string', () => {
      (configService.get as jest.Mock).mockReturnValue('');

      expect(() => factory.createDriver(DriverType.OPENAI)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('throws LLMAuthenticationException when OPENAI_API_KEY is whitespace', () => {
      (configService.get as jest.Mock).mockReturnValue('   ');

      expect(() => factory.createDriver(DriverType.OPENAI)).toThrow(
        LLMAuthenticationException,
      );
    });
  });

  describe('createDriver - ANTHROPIC', () => {
    it('creates a ClaudeDriver when ANTHROPIC_API_KEY is configured', () => {
      (configService.get as jest.Mock).mockReturnValue('sk-ant-key');

      const driver = factory.createDriver(DriverType.ANTHROPIC);

      expect(ClaudeDriver).toHaveBeenCalledWith('sk-ant-key');
      expect(driver).toBeDefined();
    });

    it('throws LLMAuthenticationException when ANTHROPIC_API_KEY is missing', () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      expect(() => factory.createDriver(DriverType.ANTHROPIC)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('throws LLMAuthenticationException when ANTHROPIC_API_KEY is empty', () => {
      (configService.get as jest.Mock).mockReturnValue('');

      expect(() => factory.createDriver(DriverType.ANTHROPIC)).toThrow(
        LLMAuthenticationException,
      );
    });
  });

  describe('createDriver - GROK', () => {
    it('creates a GrokDriver when XAI_API_KEY is configured', () => {
      (configService.get as jest.Mock).mockReturnValue('xai-key');

      const driver = factory.createDriver(DriverType.GROK);

      expect(GrokDriver).toHaveBeenCalledWith('xai-key');
      expect(driver).toBeDefined();
    });

    it('throws LLMAuthenticationException when XAI_API_KEY is missing', () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      expect(() => factory.createDriver(DriverType.GROK)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('throws LLMAuthenticationException when XAI_API_KEY is whitespace', () => {
      (configService.get as jest.Mock).mockReturnValue('  \t  ');

      expect(() => factory.createDriver(DriverType.GROK)).toThrow(
        LLMAuthenticationException,
      );
    });
  });

  describe('createDriver - unsupported type', () => {
    it('throws LLMInvalidRequestException for unsupported driver type', () => {
      expect(() => factory.createDriver('UNKNOWN' as DriverType)).toThrow(
        LLMInvalidRequestException,
      );
    });

    it('includes driver type in error message', () => {
      expect(() => factory.createDriver('UNKNOWN' as DriverType)).toThrow(
        'Unsupported driver type: UNKNOWN',
      );
    });
  });

  describe('createDriver - config key mapping', () => {
    it('reads OPENAI_API_KEY for OPENAI type', () => {
      (configService.get as jest.Mock).mockReturnValue('key');
      factory.createDriver(DriverType.OPENAI);
      expect(configService.get).toHaveBeenCalledWith('OPENAI_API_KEY');
    });

    it('reads ANTHROPIC_API_KEY for ANTHROPIC type', () => {
      (configService.get as jest.Mock).mockReturnValue('key');
      factory.createDriver(DriverType.ANTHROPIC);
      expect(configService.get).toHaveBeenCalledWith('ANTHROPIC_API_KEY');
    });

    it('reads XAI_API_KEY for GROK type', () => {
      (configService.get as jest.Mock).mockReturnValue('key');
      factory.createDriver(DriverType.GROK);
      expect(configService.get).toHaveBeenCalledWith('XAI_API_KEY');
    });
  });
});
