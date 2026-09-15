import { decide } from './delegation';
import { capForProvider } from './cap';
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

  const result = await provider.summarize(capForProvider(content), instruction);
  return { output: result.text, delegated: true, usage: result.usage };
}
