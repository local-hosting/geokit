/**
 * True when `host` sits under a registered `gk-map-collection` custom element.
 * An unupgraded `<gk-map-collection>` tag must not defer map init (maps would stay blank).
 */
export function isUpgradedMapCollectionAncestor(
  host: Element,
  getCollectionCtor: () => CustomElementConstructor | undefined = () =>
    customElements.get('gk-map-collection'),
): boolean {
  const parent = host.closest('gk-map-collection');
  if (!parent) return false;
  const CollectionCtor = getCollectionCtor();
  return Boolean(CollectionCtor && parent instanceof CollectionCtor);
}
