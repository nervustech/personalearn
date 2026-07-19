/** Cap teacher re-eval instructions before they enter the vision prompt. */
export const MAX_REEVAL_INSTRUCTION_CHARS = 2000;

export function normalizeReevalInstruction(
  instruction?: string | null
): string | null {
  if (instruction == null) return null;
  const trimmed = String(instruction).trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_REEVAL_INSTRUCTION_CHARS) {
    throw new Error(
      `Instruction must be at most ${MAX_REEVAL_INSTRUCTION_CHARS} characters`
    );
  }
  return trimmed;
}
