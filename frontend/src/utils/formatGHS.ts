/** Format amounts as Ghana Cedi (GHS). */
export const formatGHS = (amount: number | null | undefined): string => {
  const value = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  return `GHS ${new Intl.NumberFormat('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
};

/** Compact price range for listing cards. */
export const formatPriceRange = (
  min?: number | null,
  max?: number | null,
  label?: string | null
): string => {
  if (label && label.trim()) return label;
  if (min != null && max != null && min !== max) {
    return `GHS ${Math.round(min)} – ${Math.round(max)}`;
  }
  if (min != null) return `From GHS ${Math.round(min)}`;
  if (max != null) return `GHS ${Math.round(max)}`;
  return 'Negotiable';
};
