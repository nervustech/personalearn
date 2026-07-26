import { cn } from "@/lib/utils";

/**
 * PersonaLearn brand mark: a geometric "P" monogram whose bowl junction
 * branches into a connected node — evoking a personalized learning path /
 * neural node. Uses `currentColor` so it inherits the surrounding text color.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(className)}
    >
      <path d="M8 20V4h5a4 4 0 0 1 0 8H8" />
      <path d="M8 12l5 5.5" />
      <circle cx="13.5" cy="18" r="1.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
