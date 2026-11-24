import type { AppConfig } from '../env';
import { createAnthropicProvider } from './anthropic';
import { createOpenAiProvider } from './openai';
import type { AiProvider, ProviderName } from './types';

/** The providers whose API keys are set. A missing key leaves that provider switched off. */
export function createProviders(config: AppConfig): Partial<Record<ProviderName, AiProvider>> {
  const gateway = { gatewayUrl: config.aiGatewayUrl, gatewayToken: config.ai.gatewayToken };
  return {
    ...(config.ai.anthropicApiKey
      ? { anthropic: createAnthropicProvider({ ...gateway, apiKey: config.ai.anthropicApiKey }) }
      : {}),
    ...(config.ai.openaiApiKey
      ? { openai: createOpenAiProvider({ ...gateway, apiKey: config.ai.openaiApiKey }) }
      : {}),
  };
}
