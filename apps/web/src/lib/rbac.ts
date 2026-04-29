export type PermissionMatrix = Record<string, { read?: boolean; create?: boolean; update?: boolean; delete?: boolean }>;

export function can(matrix: PermissionMatrix | null | undefined, section: string, action: keyof PermissionMatrix[string]) {
  if (!matrix) return false;
  const s = matrix[section];
  if (!s) return false;
  return !!s[action];
}
