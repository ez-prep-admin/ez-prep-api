import { EntitlementScopeType } from '../enums/entitlement-scope-type.enum';

export interface ProductGrantSnapshot {
  scopeType: EntitlementScopeType;
  scopeId: string;
}

export interface ProductVersionSnapshotInput {
  id: string;
  version: number;
  code: string;
  name: string;
  description?: string | null;
  grants: Array<{
    scopeType: EntitlementScopeType;
    scopeId: string | { toString(): string };
  }>;
}

export interface ProductVersionSnapshot {
  productId: string;
  version: number;
  code: string;
  name: string;
  description?: string;
  grants: ProductGrantSnapshot[];
  frozenAt: Date;
}

/**
 * Build an immutable product-version snapshot for product_versions inserts
 * and for Phase 07 order item snapshots.
 */
export function buildProductVersionSnapshot(
  product: ProductVersionSnapshotInput,
  frozenAt: Date = new Date(),
): ProductVersionSnapshot {
  return {
    productId: product.id,
    version: product.version,
    code: product.code,
    name: product.name,
    description: product.description ?? undefined,
    grants: product.grants.map(g => ({
      scopeType: g.scopeType,
      scopeId: String(g.scopeId),
    })),
    frozenAt,
  };
}

/** Deep-compare grants for material-change detection (order-insensitive). */
export function grantsEqual(
  a: ProductGrantSnapshot[],
  b: ProductGrantSnapshot[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const key = (g: ProductGrantSnapshot) => `${g.scopeType}:${g.scopeId}`;
  const sortedA = [...a].map(key).sort();
  const sortedB = [...b].map(key).sort();
  return sortedA.every((k, i) => k === sortedB[i]);
}
