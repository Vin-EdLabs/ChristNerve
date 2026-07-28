/** YouTube helpers for sermons + live stream UI. */
export function extractYoutubeId(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const url = raw.trim();
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.replace('/', '').split('/')[0];
      return id || null;
    }
    if (host.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      for (const key of ['embed', 'shorts', 'live']) {
        const i = parts.indexOf(key);
        if (i >= 0 && parts[i + 1]) return parts[i + 1];
      }
    }
  } catch {
    if (/^[\w-]{11}$/.test(url)) return url;
  }
  return null;
}

export function youtubeThumbnail(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(
  id: string,
  opts?: { autoplay?: boolean }
): string {
  const params = new URLSearchParams({
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
    iv_load_policy: '3',
    fs: '1',
  });
  if (opts?.autoplay) {
    params.set('autoplay', '1');
    params.set('mute', '0');
  }
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
