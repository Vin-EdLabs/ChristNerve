"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSlug = generateSlug;
/**
 * Convert a string to a URL-safe kebab-case slug.
 * e.g. "Akosua's Kente Boutique" → "akosuas-kente-boutique"
 */
function generateSlug(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}
//# sourceMappingURL=slug.js.map