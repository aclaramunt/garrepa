/**
 * Harness-agnostic secret-path denylist.
 * When a path matches, adapters must not send the contents to a cheap model.
 * In doubt, callers should allow the original tool rather than upload.
 */
export function isSecretPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  const base = parts[parts.length - 1] ?? '';
  const baseLower = base.toLowerCase();

  if (base.startsWith('.env')) return true;
  if (baseLower.endsWith('.pem')) return true;
  if (base === 'id_rsa' || base.startsWith('id_rsa')) return true;
  if (baseLower.includes('credentials')) return true;
  if (parts.some((p) => p.toLowerCase() === 'secrets')) return true;
  return false;
}
