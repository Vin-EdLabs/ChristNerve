/**
 * Convert a string to a URL-safe kebab-case slug.
 * e.g. "Akosua's Kente Boutique" → "akosuas-kente-boutique"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}
