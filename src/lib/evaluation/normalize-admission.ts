/** Normalize admission numbers for roster comparison. */
export function normalizeAdmissionNumber(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}
