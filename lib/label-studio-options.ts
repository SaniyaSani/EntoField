export const DEFAULT_COLLECTION_SOURCE = "quick" as const;
export const DEFAULT_INCLUDE_COLLECTION_IDENTIFIER = false;
export const MAX_LABEL_COPIES = 200;

/** Normalize only on commit, never while the user is replacing the number. */
export function normalizeLabelCopies(value: string | number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? Math.max(1, Math.min(MAX_LABEL_COPIES, Math.floor(numeric)))
    : 1;
}
