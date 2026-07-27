import bcrypt from 'bcryptjs';

/** Normalize Ghana-style numbers to local form starting with 0. */
export function normalizePhone(raw: string): string {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length >= 12) {
    digits = `0${digits.slice(3)}`;
  }
  if (digits.length === 9 && !digits.startsWith('0')) {
    digits = `0${digits}`;
  }
  return digits;
}

export function phoneVariants(raw: string): string[] {
  const n = normalizePhone(raw);
  const last9 = n.slice(-9);
  const variants = new Set<string>([n, last9, `0${last9}`, `233${last9}`]);
  return [...variants].filter(Boolean);
}

/** Must be local mobile form: 0 + 9 digits (e.g. 0244123456). */
export function isValidMemberPhone(raw: string): boolean {
  const n = normalizePhone(raw);
  return /^0\d{9}$/.test(n);
}

export function defaultPinFromPhone(raw: string): string | null {
  const n = normalizePhone(raw);
  if (n.length < 4) return null;
  return n.slice(-4);
}

export function isValidPin(raw: string): boolean {
  return /^\d{4}$/.test(String(raw || '').trim());
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(String(pin).trim(), 10);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(String(pin).trim(), hash);
}
