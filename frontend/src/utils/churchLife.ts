/** Shared list unwrap for API payloads. */
export function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export function canEditChurchMedia(
  accountType: string | null | undefined,
  role?: string | null
): boolean {
  if (accountType === 'member') return false;
  const r = String(role || '').toLowerCase();
  return ['pastor', 'admin', 'super-admin', 'secretary', 'media'].includes(r);
}
