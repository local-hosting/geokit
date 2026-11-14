/**
 * Parse HTML boolean-ish attributes used by gk-control-* elements.
 *
 * - Absent → `defaultWhenAbsent`
 * - default-true attrs: anything except explicit `"false"` is true
 * - default-false attrs: `"true"` or empty string (`attr` present) is true
 */
export function parseBooleanAttribute(
  value: string | null | undefined,
  defaultWhenAbsent: boolean = false
): boolean {
  if (value === null || value === undefined) {
    return defaultWhenAbsent;
  }

  if (defaultWhenAbsent) {
    return value !== 'false';
  }

  return value === 'true' || value === '';
}

/** Whether two raw attribute values differ after boolean parsing. */
export function booleanAttributeChanged(
  oldValue: string | null,
  newValue: string | null,
  defaultWhenAbsent: boolean
): boolean {
  return (
    parseBooleanAttribute(oldValue, defaultWhenAbsent) !==
    parseBooleanAttribute(newValue, defaultWhenAbsent)
  );
}
