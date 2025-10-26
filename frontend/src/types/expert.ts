export enum DriverType {
  OPENAI = 'OPENAI',
  ANTHROPIC = 'ANTHROPIC',
}

export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
}

export interface CreateExpertDto {
  name: string;
  specialty: string;
  systemPrompt: string;
  driverType: DriverType;
  config: LLMConfig;
}

export type UpdateExpertDto = Partial<CreateExpertDto>;

export interface ExpertResponse {
  id: string;
  name: string;
  specialty: string;
  systemPrompt: string;
  driverType: DriverType;
  config: LLMConfig;
  createdAt: string;
  updatedAt: string;
}

