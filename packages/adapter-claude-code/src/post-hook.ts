import { capForProvider, decideFromCharCount, isSecretPath } from '@garrepa/core';
import type { GarrepaConfig } from './config';
import { SUMMARY_MAX_CHARS } from './constants';
import {
  GIT_DUMP_INSTRUCTION,
  MCP_DESIGN_INSTRUCTION,
  MCP_TEXT_INSTRUCTION,
  TEST_OUTPUT_INSTRUCTION,
} from './instructions';
import { bashCommandFromInput, extractGitDump } from './git-response';
import {
  containsLikelySecret,
  containsSecretPathInput,
  extractCompressibleMcp,
  isMcpToolName,
  isSensitiveMcpToolName,
} from './mcp-response';
import { parseGitDumpCommand } from './parse-git-command';
import { parseTestCommand } from './parse-test-command';
import type { PostToolUseHookResponse, PostToolUsePayload } from './types';

export interface PostHookDeps {
  loadConfig(cwd: string): GarrepaConfig;
  summarize(content: string, instruction: string, config: GarrepaConfig): Promise<string>;
}

export type PostHookOutput =
  | { type: 'pass' }
  | { type: 'replace'; response: PostToolUseHookResponse };

function instructionForMcpTool(toolName: string): string {
  return toolName.toLowerCase().includes('figma')
    ? MCP_DESIGN_INSTRUCTION
    : MCP_TEXT_INSTRUCTION;
}

function compressedMcpText(sourceLength: number, summary: string): string {
  const header =
    `[Garrepa compressed this MCP result from ${sourceLength} characters. ` +
    `Run a narrower MCP query if exact omitted detail is required.]\n\n`;
  return header + summary.slice(0, Math.max(0, SUMMARY_MAX_CHARS - header.length));
}

function compressedGitText(sourceLength: number, summary: string): string {
  const header =
    `[Garrepa compressed this git dump from ${sourceLength} characters. ` +
    `Re-run a narrower git command if exact omitted detail is required.]\n\n`;
  return header + summary.slice(0, Math.max(0, SUMMARY_MAX_CHARS - header.length));
}

function compressedTestText(sourceLength: number, summary: string): string {
  const header =
    `[Garrepa compressed test output from ${sourceLength} characters. ` +
    `Re-run with a filter flag (e.g. --testNamePattern) if exact output is needed.]\n\n`;
  return header + summary.slice(0, Math.max(0, SUMMARY_MAX_CHARS - header.length));
}

/**
 * PostToolUse decision for large MCP results, git dumps, and test output.
 * Every unsupported shape and unexpected error leaves the original result intact.
 */
export async function handlePostToolUse(
  payload: PostToolUsePayload,
  deps: PostHookDeps,
): Promise<PostHookOutput> {
  try {
    if (payload.tool_name === 'Bash') {
      const gitResult = await decideGitDump(payload, deps);
      if (gitResult.type === 'replace') return gitResult;
      return await decideTestOutput(payload, deps);
    }
    return await decideMcpPostToolUse(payload, deps);
  } catch {
    return { type: 'pass' };
  }
}

async function replaceWithSummary(
  sourceLength: number,
  prunedText: string,
  instruction: string,
  deps: PostHookDeps,
  cwd: string,
  wrap: (replacement: string) => unknown,
  compressed: (sourceLength: number, summary: string) => string,
): Promise<PostHookOutput> {
  const config = deps.loadConfig(cwd);
  if (!decideFromCharCount(sourceLength, config.threshold).delegate) {
    return { type: 'pass' };
  }

  let rawSummary: string;
  try {
    rawSummary = await deps.summarize(prunedText, instruction, config);
  } catch {
    return { type: 'pass' };
  }

  const summary = rawSummary.trim();
  if (summary.length === 0 || summary.length >= sourceLength) {
    return { type: 'pass' };
  }

  const replacementText = compressed(sourceLength, summary);
  if (replacementText.length >= sourceLength) {
    return { type: 'pass' };
  }

  return {
    type: 'replace',
    response: {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: wrap(replacementText),
      },
    },
  };
}

async function decideGitDump(
  payload: PostToolUsePayload,
  deps: PostHookDeps,
): Promise<PostHookOutput> {
  const command = bashCommandFromInput(payload.tool_input);
  if (command == null) return { type: 'pass' };

  const match = parseGitDumpCommand(command);
  if (match == null || match.paths.some((filePath) => isSecretPath(filePath))) {
    return { type: 'pass' };
  }

  const extracted = extractGitDump(payload.tool_response);
  if (extracted == null || containsLikelySecret(extracted.stdout)) {
    return { type: 'pass' };
  }

  return replaceWithSummary(
    extracted.stdout.length,
    capForProvider(extracted.stdout),
    GIT_DUMP_INSTRUCTION,
    deps,
    payload.cwd,
    (replacement) => extracted.rebuild(replacement),
    compressedGitText,
  );
}

async function decideTestOutput(
  payload: PostToolUsePayload,
  deps: PostHookDeps,
): Promise<PostHookOutput> {
  const command = bashCommandFromInput(payload.tool_input);
  if (command == null) return { type: 'pass' };

  if (parseTestCommand(command) == null) return { type: 'pass' };

  const extracted = extractGitDump(payload.tool_response);
  if (extracted == null || containsLikelySecret(extracted.stdout)) {
    return { type: 'pass' };
  }

  return replaceWithSummary(
    extracted.stdout.length,
    capForProvider(extracted.stdout),
    TEST_OUTPUT_INSTRUCTION,
    deps,
    payload.cwd,
    (replacement) => extracted.rebuild(replacement),
    compressedTestText,
  );
}

async function decideMcpPostToolUse(
  payload: PostToolUsePayload,
  deps: PostHookDeps,
): Promise<PostHookOutput> {
  if (!isMcpToolName(payload.tool_name) || isSensitiveMcpToolName(payload.tool_name)) {
    return { type: 'pass' };
  }
  if (containsSecretPathInput(payload.tool_input)) {
    return { type: 'pass' };
  }

  const extracted = extractCompressibleMcp(payload.tool_response);
  if (extracted == null || containsLikelySecret(extracted.text)) {
    return { type: 'pass' };
  }

  const config = deps.loadConfig(payload.cwd);
  if (config.mcp?.excludeTools?.includes(payload.tool_name) === true) {
    return { type: 'pass' };
  }

  return replaceWithSummary(
    extracted.text.length,
    extracted.prunedText,
    instructionForMcpTool(payload.tool_name),
    deps,
    payload.cwd,
    (replacement) => extracted.rebuild(replacement),
    compressedMcpText,
  );
}
