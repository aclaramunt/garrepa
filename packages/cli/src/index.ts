export { runInit } from './commands/init';
export type { InitOptions, InitDeps } from './commands/init';
export { runSummarize } from './commands/summarize';
export type { SummarizeDeps } from './commands/summarize';
export { runWrite } from './commands/write';
export type { WriteDeps } from './commands/write';
export { WRITE_PRESETS, getPresetInstruction, COMMIT_MESSAGE_INSTRUCTION } from './presets';
export { readConfig, writeConfig, configPath } from './config';
export { createProvider } from './provider-factory';

export const VERSION = '0.0.1';
