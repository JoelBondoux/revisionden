import { createWorker } from './worker';

// The version is injected at deploy time from the repo's VERSION file (wrangler --define).
declare const __APP_VERSION__: string | undefined;

export default createWorker(typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev');
