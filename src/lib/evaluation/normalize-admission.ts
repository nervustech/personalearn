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

/**
 * OCR often glues a page suffix onto a real roster number (`8149` + `10` →
 * `814910`). Use the longest unique roster digit-core that is a prefix of the
 * read, when the extra suffix is 1–3 digits.
 */
export function findUniqueDigitPrefixStudent<
  T extends { id?: string; admission_number: string | null },
>(raw: string | null | undefined, roster: T[]): T | null {
  const readDigits = admissionDigits(raw);
  if (!readDigits) return null;

  const hits: { student: T; len: number }[] = [];
  for (const student of roster) {
    const rosterDigits = admissionDigits(student.admission_number);
    if (!rosterDigits || rosterDigits.length < 3) continue;
    if (!readDigits.startsWith(rosterDigits)) continue;
    const extra = readDigits.length - rosterDigits.length;
    if (extra < 1 || extra > 3) continue;
    hits.push({ student, len: rosterDigits.length });
  }
  if (hits.length === 0) return null;

  const maxLen = Math.max(...hits.map((h) => h.len));
  const best = hits.filter((h) => h.len === maxLen);
  const uniqueIds = new Set(
    best.map((h) => h.student.id ?? h.student.admission_number)
  );
  if (uniqueIds.size !== 1) return null;
  return best[0]!.student;
}
