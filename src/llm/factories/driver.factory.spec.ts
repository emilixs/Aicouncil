import { DriverFactory } from './driver.factory';
import { ConfigService } from '@nestjs/config';
import { DriverType } from '@prisma/client';
import { OpenAIDriver } from '../drivers/openai.driver';
import { ClaudeDriver } from '../drivers/claude.driver';
import { GrokDriver } from '../drivers/grok.driver';
import {
  LLMAuthenticationException,
  LLMInvalidRequestException,
} from '../exceptions/llm.exception';

// Mock all SDK modules to prevent real instantiation
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');

// Spy on driver constructors so we can verify args without real SDK calls
jest.mock('../drivers/openai.driver');
jest.mock('../drivers/claude.driver');
jest.mock('../drivers/grok.driver');

describe('DriverFactory', () => {
  let factory: DriverFactory;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn(),
    } as any;
    factory = new DriverFactory(configService);
  });

  describe('createDriver() - OPENAI', () => {
    it('returns an OpenAIDriver instance when OPENAI_API_KEY is set', () => {
      configService.get.mockReturnValue('sk-openai-key');
      const driver = factory.createDriver(DriverType.OPENAI);
      expect(driver).toBeInstanceOf(OpenAIDriver);
    });

    it('instantiates OpenAIDriver with the API key from config', () => {
      configService.get.mockReturnValue('sk-openai-key');
      factory.createDriver(DriverType.OPENAI);
      expect(OpenAIDriver).toHaveBeenCalledWith('sk-openai-key');
    });

    it('reads OPENAI_API_KEY from ConfigService', () => {
      configService.get.mockReturnValue('sk-openai-key');
      factory.createDriver(DriverType.OPENAI);
      expect(configService.get).toHaveBeenCalledWith('OPENAI_API_KEY');
    });

    it('throws LLMAuthenticationException when OPENAI_API_KEY is missing', () => {
      configService.get.mockReturnValue(undefined);
      expect(() => factory.createDriver(DriverType.OPENAI)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('throws LLMAuthenticationException when OPENAI_API_KEY is empty string', () => {
      configService.get.mockReturnValue('');
      expect(() => factory.createDriver(DriverType.OPENAI)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('throws LLMAuthenticationException when OPENAI_API_KEY is whitespace only', () => {
      configService.get.mockReturnValue('   ');
      expect(() => factory.createDriver(DriverType.OPENAI)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('includes "OpenAI" in authentication error message', () => {
      configService.get.mockReturnValue(undefined);
      expect(() => factory.createDriver(DriverType.OPENAI)).toThrow(/OpenAI/);
    });
  });

  describe('createDriver() - ANTHROPIC', () => {
    it('returns a ClaudeDriver instance when ANTHROPIC_API_KEY is set', () => {
      configService.get.mockReturnValue('sk-ant-key');
      const driver = factory.createDriver(DriverType.ANTHROPIC);
      expect(driver).toBeInstanceOf(ClaudeDriver);
    });

    it('instantiates ClaudeDriver with the API key from config', () => {
      configService.get.mockReturnValue('sk-ant-key');
      factory.createDriver(DriverType.ANTHROPIC);
      expect(ClaudeDriver).toHaveBeenCalledWith('sk-ant-key');
    });

    it('reads ANTHROPIC_API_KEY from ConfigService', () => {
      configService.get.mockReturnValue('sk-ant-key');
      factory.createDriver(DriverType.ANTHROPIC);
      expect(configService.get).toHaveBeenCalledWith('ANTHROPIC_API_KEY');
    });

    it('throws LLMAuthenticationException when ANTHROPIC_API_KEY is missing', () => {
      configService.get.mockReturnValue(undefined);
      expect(() => factory.createDriver(DriverType.ANTHROPIC)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('throws LLMAuthenticationException when ANTHROPIC_API_KEY is empty string', () => {
      configService.get.mockReturnValue('');
      expect(() => factory.createDriver(DriverType.ANTHROPIC)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('throws LLMAuthenticationException when ANTHROPIC_API_KEY is whitespace only', () => {
      configService.get.mockReturnValue('   ');
      expect(() => factory.createDriver(DriverType.ANTHROPIC)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('includes "Anthropic" in authentication error message', () => {
      configService.get.mockReturnValue(undefined);
      expect(() => factory.createDriver(DriverType.ANTHROPIC)).toThrow(/Anthropic/);
    });
  });

  describe('createDriver() - GROK', () => {
    it('returns a GrokDriver instance when XAI_API_KEY is set', () => {
      configService.get.mockReturnValue('xai-key');
      const driver = factory.createDriver(DriverType.GROK);
      expect(driver).toBeInstanceOf(GrokDriver);
    });

    it('instantiates GrokDriver with the API key from config', () => {
      configService.get.mockReturnValue('xai-key');
      factory.createDriver(DriverType.GROK);
      expect(GrokDriver).toHaveBeenCalledWith('xai-key');
    });

    it('reads XAI_API_KEY from ConfigService', () => {
      configService.get.mockReturnValue('xai-key');
      factory.createDriver(DriverType.GROK);
      expect(configService.get).toHaveBeenCalledWith('XAI_API_KEY');
    });

    it('throws LLMAuthenticationException when XAI_API_KEY is missing', () => {
      configService.get.mockReturnValue(undefined);
      expect(() => factory.createDriver(DriverType.GROK)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('throws LLMAuthenticationException when XAI_API_KEY is empty string', () => {
      configService.get.mockReturnValue('');
      expect(() => factory.createDriver(DriverType.GROK)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('throws LLMAuthenticationException when XAI_API_KEY is whitespace only', () => {
      configService.get.mockReturnValue('   ');
      expect(() => factory.createDriver(DriverType.GROK)).toThrow(
        LLMAuthenticationException,
      );
    });

    it('includes "xAI" in authentication error message', () => {
      configService.get.mockReturnValue(undefined);
      expect(() => factory.createDriver(DriverType.GROK)).toThrow(/xAI/);
    });
  });

  describe('createDriver() - unsupported type', () => {
    it('throws LLMInvalidRequestException for an unsupported driver type', () => {
      // Cast to bypass TypeScript check to simulate a runtime unknown value
      expect(() => factory.createDriver('UNKNOWN_DRIVER' as DriverType)).toThrow(
        LLMInvalidRequestException,
      );
    });

    it('includes the unsupported driver type in the error message', () => {
      expect(() => factory.createDriver('UNKNOWN_DRIVER' as DriverType)).toThrow(
        /UNKNOWN_DRIVER/,
      );
    });
  });
});
