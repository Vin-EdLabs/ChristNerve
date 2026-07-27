/** Convert a title/name into a URL-safe kebab-case slug. */
export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/** Listing slug: kebab title + member id suffix, e.g. akosua-kente-boutique-42 */
export const generateListingSlug = (title: string, memberId: number): string => {
  const base = generateSlug(title) || 'listing';
  return `${base}-${memberId}`;
};
