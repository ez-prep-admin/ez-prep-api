/**
 * Populated document field type with common fields
 */
export interface PopulatedDocument {
  _id?: unknown;
  name?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Type guard to check if a value is a populated document
 */
export function isPopulatedDocument(
  value: unknown,
): value is PopulatedDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    ('_id' in value || 'name' in value)
  );
}
