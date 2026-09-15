/**
 * Instruction templates for `garrepa write <preset>`.
 *
 * Add new presets here as additional map entries. Each value is passed
 * unchanged to Provider.summarize() as the instruction argument.
 */
export const COMMIT_MESSAGE_INSTRUCTION =
  'Write a concise, conventional-commits-style commit message summarizing this diff. Output only the commit message, nothing else.';

export const PR_TITLE_INSTRUCTION =
  'Write a concise pull request title (under 72 characters) summarizing this diff. Use an imperative verb. Output only the title, nothing else.';

export const WRITE_PRESETS: ReadonlyMap<string, string> = new Map([
  ['commit-message', COMMIT_MESSAGE_INSTRUCTION],
  ['pr-title', PR_TITLE_INSTRUCTION],
]);

export function getPresetInstruction(name: string): string | undefined {
  return WRITE_PRESETS.get(name);
}

export function listPresetNames(): string[] {
  return [...WRITE_PRESETS.keys()];
}
