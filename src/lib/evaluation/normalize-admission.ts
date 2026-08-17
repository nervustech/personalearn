/** Normalize admission numbers for roster comparison. */
export function normalizeAdmissionNumber(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

/** Uppercase letters+digits only (drops spaces, dashes, punctuation). */
export function compactAdmissionNumber(
  value: string | null | undefined
): string | null {
  const normalized = normalizeAdmissionNumber(value);
  if (!normalized) return null;
  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  return compact || null;
}

/** Digit core for matching "ADM-1196" to roster "1196" when unique. */
export function admissionDigits(
  value: string | null | undefined
): string | null {
  const compact = compactAdmissionNumber(value);
  if (!compact) return null;
  const digits = compact.replace(/\D/g, "");
  return digits.length >= 2 ? digits : null;
}

/** Candidate keys from most specific to most lenient. */
export function admissionLookupKeys(
  value: string | null | undefined
): string[] {
  const keys: string[] = [];
  const normalized = normalizeAdmissionNumber(value);
  if (normalized) keys.push(normalized);
  const compact = compactAdmissionNumber(value);
  if (compact && !keys.includes(compact)) keys.push(compact);
  const digits = admissionDigits(value);
  if (digits && !keys.includes(digits)) keys.push(digits);
  return keys;
}
