import { decide } from './delegation';
import type { Provider, ThresholdConfig, RouterResult } from './types';

export async function route(
  content: string,
  instruction: string,
  config: ThresholdConfig,
  provider: Provider,
): Promise<RouterResult> {
  const decision = decide(content, config);

  if (!decision.delegate) {
    return { output: content, delegated: false };
  }

  const output = await provider.summarize(content, instruction);
  return { output, delegated: true };
}
