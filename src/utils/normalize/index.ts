/**
 * Convert a string to a URL-safe slug
 *
 * @param text - Text to slugify
 * @returns URL-safe slug
 *
 * @example
 * ```typescript
 * slugify('New York City'); // 'new-york-city'
 * slugify('Los Angeles, CA'); // 'los-angeles-ca'
 * ```
 */
export function slugify(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Normalize a string for comparison
 * Removes special characters, converts to lowercase, and normalizes whitespace
 *
 * @param text - Text to normalize
 * @returns Normalized string
 *
 * @example
 * ```typescript
 * normalize('New York City'); // 'new york city'
 * normalize('Los Angeles, CA'); // 'los angeles ca'
 * ```
 */
export function normalize(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .toLowerCase()
    .trim()
    .replace(/[&@#]/g, ' ') // Replace common special chars with spaces
    .replace(/[^\w\s]/g, '') // Remove remaining special characters
    .replace(/\s+/g, ' ') // Normalize whitespace to single spaces
    .trim();
}

/**
 * Normalize a name for comparison
 * Specialized normalization for geographic names (DMA names, city names, etc.)
 * Handles common abbreviations and variations
 *
 * @param name - Name to normalize
 * @returns Normalized name
 *
 * @example
 * ```typescript
 * normalizeName('Ft. Worth'); // 'fort worth'
 * normalizeName('St. Louis'); // 'saint louis'
 * ```
 */
export function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  let normalized = name.toLowerCase().trim();

  // Handle HTML entities first (before expanding abbreviations)
  normalized = normalized.replace(/&amp;/g, '&');

  // Replace & with spaces first so we can then replace it with 'and'
  normalized = normalized.replace(/\s*&\s*/g, ' and ');

  // Expand common abbreviations
  const abbreviations: Record<string, string> = {
    'ft.': 'fort',
    ft: 'fort',
    'st.': 'saint',
    st: 'saint',
  };

  for (const [abbrev, full] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${abbrev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    normalized = normalized.replace(regex, full);
  }

  // Remove special characters and normalize
  return normalized
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
