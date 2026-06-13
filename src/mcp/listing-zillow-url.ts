/** Derive a Zillow search URL from a map-host listing label (address before price suffix). */

function listingAddressFromName(name: string): string {
  const trimmed = name.trim();
  const priceMatch = trimmed.match(/\s[-·]\s\$/);
  if (priceMatch?.index != null && priceMatch.index > 0) {
    return trimmed.slice(0, priceMatch.index).trim();
  }
  const dash = trimmed.indexOf(' - ');
  return (dash > 0 ? trimmed.slice(0, dash) : trimmed).trim();
}

function slugifyAddress(address: string): string {
  return address
    .replace(/,/g, '')
    .trim()
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Build `https://www.zillow.com/homes/{slug}_rb/` when the label looks like a street address. */
export function zillowUrlFromListingName(name: string | undefined): string | undefined {
  if (!name?.trim()) return undefined;
  const address = listingAddressFromName(name);
  // Require city (comma-separated) so we do not guess from bare street names.
  if (!address.includes(',')) return undefined;
  const slug = slugifyAddress(address);
  if (!slug) return undefined;
  return `https://www.zillow.com/homes/${slug}_rb/`;
}
