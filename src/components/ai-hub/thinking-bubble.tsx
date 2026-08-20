"use client";

export function ThinkingBubble() {
  return (
    <div className="flex items-start gap-3">
      <div
        className="
          inline-flex items-center gap-[5px] rounded-2xl
          border border-primary/20 bg-muted/50 px-4 py-3
          shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_8%,transparent)]
          animate-[pulse_2.4s_ease-in-out_infinite]
        "
      >
        <span className="h-2 w-2 rounded-full bg-primary animate-[wave_1.2s_ease-in-out_infinite] [animation-delay:0ms]" />
        <span className="h-2 w-2 rounded-full bg-primary animate-[wave_1.2s_ease-in-out_infinite] [animation-delay:200ms]" />
        <span className="h-2 w-2 rounded-full bg-primary animate-[wave_1.2s_ease-in-out_infinite] [animation-delay:400ms]" />
      </div>
    </div>
  );
}
