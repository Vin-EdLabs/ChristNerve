/**
 * Normalize Ghana phone numbers for WhatsApp (wa.me).
 * Examples: 0244123456 → 233244123456, +233 24 412 3456 → 233244123456
 */
export const formatGhanaWhatsApp = (phone: string): string => {
  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('233') && digits.length >= 12) {
    return digits.slice(0, 12);
  }

  if (digits.startsWith('0') && digits.length >= 10) {
    return `233${digits.slice(1, 10)}`;
  }

  if (digits.length === 9) {
    return `233${digits}`;
  }

  return digits;
};

export const buildWhatsAppUrl = (
  phone: string,
  message?: string
): string => {
  const formatted = formatGhanaWhatsApp(phone);
  const base = `https://wa.me/${formatted}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
};

export const buildListingWhatsAppMessage = (
  sellerName: string,
  listingTitle: string
): string => {
  return `Hi ${sellerName}, I'm interested in your ${listingTitle} listing on ChristNerve`;
};
