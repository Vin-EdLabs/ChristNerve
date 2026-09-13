import { useEffect, useState } from 'react';

/**
 * Counts up from a fixed anchor time (e.g. `room.started_at`) rather than from when this
 * component happened to mount — so it stays correct across remounts, minimizing, and refreshes.
 * Formatted mm:ss (or h:mm:ss past an hour).
 */
export function useElapsedTimer(sinceIso?: string | null): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!sinceIso) return '00:00';
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
