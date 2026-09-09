import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
// Load .env from monorepo root regardless of cwd
dotenvConfig({ path: resolve(__dirname, '..', '.env') });

import { readFileSync } from 'node:fs';
import { route, DEFAULT_THRESHOLD } from '../packages/core/src/index.js';
import { AnthropicProvider } from '../packages/provider-anthropic/src/index.js';

const apiKey = process.env['ANTHROPIC_API_KEY'];
if (!apiKey) {
  console.error(
    'Error: ANTHROPIC_API_KEY environment variable is not set.\n' +
      'Export it before running: export ANTHROPIC_API_KEY=sk-ant-...',
  );
  process.exit(1);
}

const filePath = process.argv[2];

const content = filePath
  ? readFileSync(filePath, 'utf8')
  : `
JIRA-4821 — Checkout flow breaks when applying a discount code on the cart page

Status: In Progress
Priority: High
Reporter: Maria S.
Assignee: Dev Team
Sprint: Sprint 34

## Summary

Users who apply a discount code on the cart page and then navigate to the checkout page
encounter a broken experience: the discount is not reflected in the order summary,
and in some cases the "Place Order" button becomes unresponsive. This was first reported
by three enterprise customers on 2024-11-12 and reproduced consistently in staging.

## Background

The cart service stores discount codes in a short-lived Redis key tied to the session.
When the user lands on checkout, the checkout service queries a separate order-preview
endpoint which currently does NOT read from the session Redis key — it recomputes the
subtotal from scratch. This architectural mismatch is the root cause.

## Steps to Reproduce

1. Add at least one item to the cart (any SKU).
2. Enter a valid 10%-off discount code (e.g. SAVE10) in the cart sidebar.
3. Observe the cart total update correctly.
4. Click "Proceed to Checkout".
5. On the checkout page, observe that the order summary shows the original price.
6. Click "Place Order" — button may freeze if the discount object is partially attached
   to the session but not fully resolved.

## Expected Behaviour

- The discount code and reduced price must persist through to checkout.
- "Place Order" must remain responsive regardless of discount state.
- The final invoice must reflect the discounted price.

## Acceptance Criteria

- Applying a valid discount code on the cart page reduces the displayed total immediately.
- Navigating from cart to checkout preserves the discount; the checkout order summary
  shows the discounted subtotal, tax, and grand total.
- An invalid or expired code shows an inline error message within 500 ms and does not
  alter the cart total.
- The "Place Order" button is never disabled or frozen due to discount resolution state.
- End-to-end test covers the happy path (valid code → checkout → order placed) and the
  sad path (expired code → error shown → cart total unchanged).
- The fix must not regress guest checkout (no session) or logged-in checkout flows.
- Discount persistence must survive a hard browser refresh on the checkout page
  (stored in a durable mechanism, not only in-memory state).

## Technical Notes

- The checkout service order-preview endpoint lives in services/checkout/preview.go.
- The Redis session key format is session:<session_id>:discount.
- Preferred fix: pass the discount code as a query param to the preview endpoint and
  let checkout validate it independently, removing the Redis coupling.
- Alternatively, the cart service could write to a DB-backed cart object that checkout
  reads; discuss with the platform team before proceeding with this approach.

## Out of Scope

- Stacking multiple discount codes (separate ticket: JIRA-4830).
- Discount code analytics dashboard.
`.trim();

async function main(): Promise<void> {
  const instruction = 'Extract the acceptance criteria as bullet points.';

  const provider = new AnthropicProvider({ apiKey });

  console.log('Running route()...\n');

  const result = await route(content, instruction, DEFAULT_THRESHOLD, provider);

  console.log(`Delegated: ${result.delegated}`);
  console.log('\n--- Output ---\n');
  console.log(result.output);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
