import { describe, it, expect } from 'vitest';
import { WRITE_PRESETS, getPresetInstruction, COMMIT_MESSAGE_INSTRUCTION } from './presets';

describe('write preset registry', () => {
  it('resolves commit-message to the conventional-commits instruction template', () => {
    expect(getPresetInstruction('commit-message')).toBe(COMMIT_MESSAGE_INSTRUCTION);
    expect(COMMIT_MESSAGE_INSTRUCTION).toBe(
      'Write a concise, conventional-commits-style commit message summarizing this diff. Output only the commit message, nothing else.',
    );
  });

  it('registers commit-message in the preset map', () => {
    expect(WRITE_PRESETS.get('commit-message')).toBe(COMMIT_MESSAGE_INSTRUCTION);
  });

  it('returns undefined for an unknown preset', () => {
    expect(getPresetInstruction('not-a-real-preset')).toBeUndefined();
  });
});
