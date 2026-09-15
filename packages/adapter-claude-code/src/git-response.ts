function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface BashToolOutput {
  stdout: string;
  stderr: string;
  interrupted: boolean;
  isImage: boolean;
  [key: string]: unknown;
}

export interface ExtractedGitDump {
  stdout: string;
  rebuild(replacement: string): BashToolOutput;
}

/**
 * Accepts a successful Bash tool_response with a textual stdout dump.
 * Images, interrupted runs, and missing stdout pass through.
 */
export function extractGitDump(response: unknown): ExtractedGitDump | null {
  if (!isRecord(response)) return null;
  if (response['interrupted'] === true || response['isImage'] === true) return null;
  if (typeof response['stdout'] !== 'string' || response['stdout'].length === 0) {
    return null;
  }

  const original = response;
  const stdout = response['stdout'];
  return {
    stdout,
    rebuild: (replacement) => ({
      ...original,
      stdout: replacement,
      stderr: typeof original['stderr'] === 'string' ? original['stderr'] : '',
      interrupted: false,
      isImage: false,
    }),
  };
}

export function bashCommandFromInput(input: unknown): string | null {
  if (!isRecord(input) || typeof input['command'] !== 'string') return null;
  return input['command'];
}
