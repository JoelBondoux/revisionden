import type { AppConfig } from './env';

export interface PasskeyService {
  rpId: string;
}

export function createPasskeyService(config: AppConfig): PasskeyService {
  return { rpId: config.passkeyRpId };
}
