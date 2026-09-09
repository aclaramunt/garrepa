import type { Provider } from './types';

/**
 * In-memory Provider stub for unit tests.
 * Exported from @garrepa/core so adapter and provider packages can reuse it
 * without duplicating the mock logic.
 */
export class MockProvider implements Provider {
  callCount = 0;
  lastCall: { content: string; instruction: string } | null = null;

  constructor(private readonly response: string) {}

  async summarize(content: string, instruction: string): Promise<string> {
    this.callCount++;
    this.lastCall = { content, instruction };
    return this.response;
  }
}
