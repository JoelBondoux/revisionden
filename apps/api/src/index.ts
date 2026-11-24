import { createApp } from './app';

// The version is injected at deploy time from the repo's VERSION file.
declare const __APP_VERSION__: string | undefined;

export default createApp({
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
});
