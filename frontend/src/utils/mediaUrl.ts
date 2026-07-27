/**
 * Resolve uploaded / relative media paths for <img src>.
 * Avoids doubling when VITE_UPLOADS_URL is `/uploads` or
 * `http://localhost:5001/uploads` and the API already returns `/uploads/...`.
 */
const uploadsBase = (import.meta.env.VITE_UPLOADS_URL || '').replace(/\/$/, '');

export function resolveMediaUrl(
  url?: string | null,
  fallback = ''
): string {
  if (!url) return fallback;
  if (/^(https?:|blob:|data:)/i.test(url)) return url;

  if (url.startsWith('/')) {
    // Relative site path — keep as-is when uploads are same-origin
    if (!uploadsBase || uploadsBase.startsWith('/')) return url;
    try {
      const base = new URL(uploadsBase);
      // url is /uploads/... → http://host:5001/uploads/...
      if (url.startsWith('/uploads')) return `${base.origin}${url}`;
      return `${uploadsBase}/${url.replace(/^\//, '')}`;
    } catch {
      return url;
    }
  }

  const base = uploadsBase || '/uploads';
  return `${base}/${url.replace(/^\//, '')}`;
}
